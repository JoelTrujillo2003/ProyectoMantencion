import express from 'express';
import dotenv from 'dotenv';
import { validateVehicle, catalog, rules } from './src/vehicle-validation.js';
import { generateReport, DEFAULT_MODEL } from './src/ai.js';
import { getSocialProviders } from './src/auth-settings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ApiError,
  authenticateRequest,
  getSupabasePublicKey,
  getSubscriptionAsAdmin,
  getUserSubscription,
  upsertSubscriptionAsAdmin,
  userDatabaseRequest
} from './src/supabase.js';
import { accountEntitlements, hasPremiumAccess } from './src/entitlements.js';
import {
  createCheckout,
  getProviderSubscription,
  providerRecord,
  verifyMercadoPagoSignature
} from './src/mercadopago.js';

import { validateFeedback, mapFeedbackError } from './src/feedback.js';

dotenv.config();
if (!process.env.APP_BASE_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.APP_BASE_URL = process.env.RENDER_EXTERNAL_URL;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const app = express();


app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const premiumCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'public', 'premium-vehicles.json'), 'utf8')
);
const premiumVehicleKeys = new Set(
  premiumCatalog.map(vehicle => vehicleKey(vehicle.type, vehicle.brand, vehicle.model))
);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function vehicleKey(type, brand, model) {
  return `${type}\u0000${brand}\u0000${model}`;
}

async function accountFor(token, userId) {
  const [subscription, vehicles] = await Promise.all([
    getUserSubscription(token, userId),
    userDatabaseRequest(
      token,
      `vehicles?select=user_id&user_id=eq.${encodeURIComponent(userId)}`
    )
  ]);
  return accountEntitlements(subscription, vehicles.length);
}

function mapDatabaseEntitlementError(error) {
  if (/VEHICLE_NOT_IN_CATALOG|INVALID_VEHICLE_YEAR|INVALID_MILEAGE/.test(error.message || '')) {
    return new ApiError(400, 'Revisa el modelo, año y kilometraje. El catálogo de la base de datos debe estar actualizado.', 'invalid_vehicle');
  }
  if (error.message?.includes('FREE_VEHICLE_LIMIT')) {
    return new ApiError(
      403,
      'El plan gratuito permite guardar hasta 2 vehículos.',
      'vehicle_limit_reached'
    );
  }
  if (error.message?.includes('PREMIUM_VEHICLE_REQUIRED')) {
    return new ApiError(
      403,
      'Ese modelo está disponible únicamente en Premium.',
      'premium_vehicle_required'
    );
  }
  return error;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/public-config', async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL) {
      throw new ApiError(500, 'Falta configurar Supabase.', 'server_not_configured');
    }
    const publicKey = getSupabasePublicKey();
    res.json({
      ...await getSocialProviders(process.env.SUPABASE_URL, publicKey),
      aiModel: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: publicKey,
      billingConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_PLAN_ID && process.env.MERCADOPAGO_WEBHOOK_SECRET && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.APP_BASE_URL)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account', asyncRoute(async (req, res) => {
  const { token, user } = await authenticateRequest(req);
  res.json(await accountFor(token, user.id));
}));

app.get('/api/vehicles', asyncRoute(async (req, res) => {
  const { token, user } = await authenticateRequest(req);
  const vehicles = await userDatabaseRequest(
    token,
    `vehicles?select=id,type,brand,model,year,mileage,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`
  );
  res.json({ vehicles });
}));

app.post('/api/feedback', asyncRoute(async (req, res) => {
  const { token } = await authenticateRequest(req);
  const payload = validateFeedback(req.body);
  try {
    const id = await userDatabaseRequest(token, 'rpc/submit_feedback', {
      method: 'POST', body: payload
    });
    if (typeof id !== 'string' || !id) {
      throw new ApiError(502, 'No se pudo confirmar el registro del mensaje.', 'feedback_unconfirmed');
    }
    res.status(201).json({ id });
  } catch (error) {
    throw mapFeedbackError(error);
  }
}));

app.post('/api/vehicles', asyncRoute(async (req, res) => {
  const { token, user } = await authenticateRequest(req);
  const vehicle = validateVehicle(req.body);
  const subscription = await getUserSubscription(token, user.id);

  if (
    premiumVehicleKeys.has(vehicleKey(vehicle.type, vehicle.brand, vehicle.model))
    && !hasPremiumAccess(subscription)
  ) {
    throw new ApiError(
      403,
      'Ese modelo está disponible únicamente en Premium.',
      'premium_vehicle_required'
    );
  }

  try {
    const rows = await userDatabaseRequest(token, 'vehicles', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: [{ user_id: user.id, ...vehicle }]
    });
    res.status(201).json({ vehicle: rows[0] });
  } catch (error) {
    throw mapDatabaseEntitlementError(error);
  }
}));

app.post('/api/analizar-vehiculo', asyncRoute(async (req, res) => {
  const { token, user } = await authenticateRequest(req);
  const subscription = await getUserSubscription(token, user.id);
  if (!hasPremiumAccess(subscription)) {
    throw new ApiError(
      403,
      'El diagnóstico con IA está disponible únicamente en Premium.',
      'premium_required'
    );
  }

  const vehicle = validateVehicle(req.body);
  const customQuery = typeof req.body.customQuery === 'string' ? req.body.customQuery.trim().slice(0, 500) : '';
  const info = rules.modelInfo(catalog, vehicle.type, vehicle.brand, vehicle.model);
  res.json(await generateReport(vehicle, customQuery, info));
}));

app.post('/api/subscription/checkout', asyncRoute(async (req, res) => {
  const { user } = await authenticateRequest(req);
  const existing = await getSubscriptionAsAdmin(user.id);

  if (existing?.provider_subscription_id) {
    const providerSubscription = await getProviderSubscription(existing.provider_subscription_id);
    if (providerSubscription.external_reference !== user.id) {
      throw new ApiError(409, 'La suscripción existente no coincide con el usuario.', 'subscription_mismatch');
    }

    await upsertSubscriptionAsAdmin(providerRecord(providerSubscription));
    if (providerSubscription.status === 'authorized') {
      return res.json({ active: true });
    }
    if (providerSubscription.status === 'pending' && providerSubscription.init_point) {
      return res.json({ checkoutUrl: providerSubscription.init_point });
    }
  }

  const providerSubscription = await createCheckout(user);
  await upsertSubscriptionAsAdmin(providerRecord(providerSubscription));
  res.status(201).json({ checkoutUrl: providerSubscription.init_point });
}));

app.post('/api/subscription/sync', asyncRoute(async (req, res) => {
  const { token, user } = await authenticateRequest(req);
  const existing = await getSubscriptionAsAdmin(user.id);
  if (!existing?.provider_subscription_id) {
    throw new ApiError(404, 'No hay una suscripción para sincronizar.', 'subscription_not_found');
  }

  const providerSubscription = await getProviderSubscription(existing.provider_subscription_id);
  if (providerSubscription.external_reference !== user.id) {
    throw new ApiError(409, 'La suscripción no coincide con el usuario.', 'subscription_mismatch');
  }

  await upsertSubscriptionAsAdmin(providerRecord(providerSubscription));
  res.json(await accountFor(token, user.id));
}));

app.post('/api/webhooks/mercadopago', asyncRoute(async (req, res) => {
  const dataId = req.query['data.id'] || req.body?.data?.id;
  const valid = verifyMercadoPagoSignature({
    xSignature: req.get('x-signature'),
    xRequestId: req.get('x-request-id'),
    dataId
  });

  if (!valid) {
    throw new ApiError(401, 'Firma de webhook inválida.', 'invalid_webhook_signature');
  }

  const topic = req.query.type || req.query.topic || req.body?.type;
  if (topic === 'subscription_preapproval') {
    const providerSubscription = await getProviderSubscription(String(dataId));
    await upsertSubscriptionAsAdmin(providerRecord(providerSubscription));
  }

  res.sendStatus(200);
}));

app.use((error, req, res, next) => {
  if (process.env.NODE_ENV !== 'test') console.error('[API]', error.code || 'internal_error', 'status:', error.status || 500);
  const status = error.status || 500;
  res.status(status).json({
    error: status >= 500 && error.code !== 'feedback_not_configured' && !error.code?.startsWith('ai_') ? 'No se pudo completar la operación.' : error.message,
    code: error.code || 'internal_error'
  });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'), () => {
    console.log(`Servidor Garage Premium disponible en http://localhost:${PORT}`);
  });
}
