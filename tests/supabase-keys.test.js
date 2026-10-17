import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabasePublicKey, adminDatabaseRequest, userDatabaseRequest } from '../src/supabase.js';

const nativeFetch = globalThis.fetch;
const names = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
afterEach(() => {
  globalThis.fetch = nativeFetch;
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

test('clave secreta nueva autentica al servidor sin enviarse como JWT', async () => {
  process.env.SUPABASE_URL = 'https://supabase.test.invalid';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-test-only';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://supabase.test.invalid/rest/v1/subscriptions');
    assert.equal(options.headers.apikey, 'sb_secret_test_only');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json([]);
  };
  assert.deepEqual(await adminDatabaseRequest('subscriptions'), []);
});

test('configuración legacy conserva autenticación del servidor', async () => {
  process.env.SUPABASE_URL = 'https://supabase.test.invalid';
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-test-only';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.apikey, 'legacy-test-only');
    assert.equal(options.headers.Authorization, 'Bearer legacy-test-only');
    return Response.json([]);
  };
  await adminDatabaseRequest('subscriptions');
});

test('clave pública nueva mantiene el JWT de cada usuario y sus permisos RLS', async () => {
  process.env.SUPABASE_URL = 'https://supabase.test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.apikey, 'sb_publishable_test_only');
    assert.equal(options.headers.Authorization, 'Bearer individual-user-jwt');
    return Response.json([]);
  };
  await userDatabaseRequest('individual-user-jwt', 'vehicles');
});

test('configuración pública rechaza tanto secretos nuevos como service_role legacy', () => {
  const rolePart = Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
  for (const secret of ['sb_secret_test_only', `eyJ.${rolePart}.test`]) {
    process.env.SUPABASE_PUBLISHABLE_KEY = secret;
    assert.throws(() => getSupabasePublicKey(), {code:'invalid_public_key'});
  }
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_ANON_KEY = 'legacy-public-test-only';
  assert.equal(getSupabasePublicKey(), 'legacy-public-test-only');
});
