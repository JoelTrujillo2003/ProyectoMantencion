const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class ApiError extends Error {
  constructor(status, message, code = 'api_error', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requireConfig(...names) {
  const value = names.map(name => process.env[name]?.trim()).find(Boolean);
  if (!value) throw new ApiError(500, `Falta configurar ${names.join(' o ')}.`, 'server_not_configured');
  return value;
}

export function getSupabasePublicKey() {
  const key = requireConfig('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  let role;
  if (key.startsWith('eyJ')) {
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Supabase validará el formato. */ }
  }
  if (key.startsWith('sb_secret_') || role === 'service_role') {
    throw new ApiError(500, 'La clave pública de Supabase no puede ser una clave secreta.', 'invalid_public_key');
  }
  return key;
}

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || data?.msg || 'Supabase rechazó la operación.',
      data?.code || 'supabase_error',
      data
    );
  }

  return data;
}

function bearerFromRequest(req) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, 'Debes iniciar sesión.', 'authentication_required');
  return match[1];
}

export async function authenticateRequest(req) {
  const token = bearerFromRequest(req);
  const url = requireConfig('SUPABASE_URL');
  const anonKey = getSupabasePublicKey();

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new ApiError(401, 'La sesión venció. Vuelve a iniciar sesión.', 'invalid_session');
  }

  return { token, user: await response.json() };
}

export async function userDatabaseRequest(token, path, options = {}) {
  const url = requireConfig('SUPABASE_URL');
  const anonKey = getSupabasePublicKey();
  const headers = {
    ...JSON_HEADERS,
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  return parseResponse(response);
}

export async function adminDatabaseRequest(path, options = {}) {
  const url = requireConfig('SUPABASE_URL');
  const serviceRoleKey = requireConfig('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = {
    ...JSON_HEADERS,
    apikey: serviceRoleKey,
    // Las claves sb_secret_ no son JWT; solo las legacy van también como Bearer.
    ...(serviceRoleKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${serviceRoleKey}` }),
    ...(options.headers || {})
  };

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  return parseResponse(response);
}

export async function getUserSubscription(token, userId) {
  const rows = await userDatabaseRequest(
    token,
    `subscriptions?select=plan,status,current_period_end,provider_subscription_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  return rows?.[0] || null;
}

export async function getSubscriptionAsAdmin(userId) {
  const rows = await adminDatabaseRequest(
    `subscriptions?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  return rows?.[0] || null;
}

export async function upsertSubscriptionAsAdmin(subscription) {
  const rows = await adminDatabaseRequest('subscriptions?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: [subscription]
  });
  return rows?.[0] || null;
}

