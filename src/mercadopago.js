import crypto from 'crypto';
import { ApiError } from './supabase.js';

const API_URL = 'https://api.mercadopago.com';

function requireConfig(name) {
  const value = process.env[name];
  if (!value) throw new ApiError(500, `Falta configurar ${name}.`, 'server_not_configured');
  return value;
}

async function mercadoPagoRequest(path, options = {}) {
  const accessToken = requireConfig('MERCADOPAGO_ACCESS_TOKEN');
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(
      502,
      data?.message || 'Mercado Pago rechazó la operación.',
      'payment_provider_error',
      data
    );
  }
  return data;
}

export function createCheckout(user) {
  const planId = requireConfig('MERCADOPAGO_PLAN_ID');
  const baseUrl = requireConfig('APP_BASE_URL').replace(/\/$/, '');

  return mercadoPagoRequest('/preapproval', {
    method: 'POST',
    body: {
      preapproval_plan_id: planId,
      payer_email: user.email,
      external_reference: user.id,
      back_url: `${baseUrl}/?subscription=return`,
      status: 'pending'
    }
  });
}

export function getProviderSubscription(subscriptionId) {
  return mercadoPagoRequest(`/preapproval/${encodeURIComponent(subscriptionId)}`);
}

export function verifyMercadoPagoSignature({ xSignature, xRequestId, dataId }) {
  const secret = requireConfig('MERCADOPAGO_WEBHOOK_SECRET');
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map(part => part.trim().split('='))
  );
  if (!parts.ts || !parts.v1 || !/^[a-f0-9]{64}$/i.test(parts.v1)) return false;

  const normalizedDataId = String(dataId).toLowerCase();
  const manifest = `id:${normalizedDataId};request-id:${xRequestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(parts.v1, 'hex');
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function providerRecord(providerSubscription) {
  const planId = requireConfig('MERCADOPAGO_PLAN_ID');
  if (providerSubscription.preapproval_plan_id !== planId) {
    throw new ApiError(400, 'La suscripción no pertenece al plan configurado.', 'invalid_plan');
  }

  const userId = providerSubscription.external_reference;
  if (!userId) throw new ApiError(400, 'La suscripción no tiene usuario asociado.', 'missing_user');

  return {
    user_id: userId,
    plan: 'premium',
    status: providerSubscription.status,
    provider: 'mercadopago',
    provider_subscription_id: providerSubscription.id,
    current_period_end: null,
    updated_at: new Date().toISOString()
  };
}

