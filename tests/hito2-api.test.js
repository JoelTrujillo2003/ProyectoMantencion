import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://hito2.supabase.test.invalid';
process.env.SUPABASE_ANON_KEY = 'test-public-key';

const nativeFetch = globalThis.fetch;
const owner = 'hito2-user';
const vehicleId = '11111111-1111-4111-8111-111111111111';
let server, base, vehicles, records, calls, missingTable;

function reset() {
  vehicles = [];
  records = [];
  calls = [];
  missingTable = false;
}

function filtered(rows, url) {
  const params = new URL(url).searchParams;
  const id = params.get('id')?.replace(/^eq\./, '');
  const userId = params.get('user_id')?.replace(/^eq\./, '');
  const vehicleId = params.get('vehicle_id')?.replace(/^eq\./, '');
  return rows.filter(row => (!id || String(row.id) === id) &&
    (!userId || row.user_id === userId) &&
    (!vehicleId || String(row.vehicle_id) === vehicleId));
}

globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith(process.env.SUPABASE_URL)) return nativeFetch(url, options);
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: owner, email: 'demo@example.test' });
  if (String(url).includes('/subscriptions?')) return Response.json([]);
  if (String(url).includes('/rest/v1/maintenance_records') && missingTable) {
    return Response.json({ code: 'PGRST205', message: 'table missing' }, { status: 404 });
  }
  const table = String(url).includes('/rest/v1/maintenance_records') ? records : vehicles;
  const method = options.method || 'GET';
  if (method === 'GET') return Response.json(filtered(table, url));
  if (method === 'POST') {
    const body = JSON.parse(options.body)[0];
    const row = { id: table === vehicles ? vehicleId : records.length + 10,
      ...body, created_at: '2026-10-20T12:00:00Z' };
    table.push(row);
    return Response.json([row], { status: 201 });
  }
  const matches = filtered(table, url);
  if (method === 'PATCH') {
    for (const row of matches) Object.assign(row, JSON.parse(options.body));
    return Response.json(matches);
  }
  if (method === 'DELETE') {
    for (const row of matches) table.splice(table.indexOf(row), 1);
    return Response.json(matches);
  }
  throw new Error(`Unexpected upstream method ${method}`);
};

before(async () => {
  const { app } = await import('../server.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  reset();
});
after(async () => {
  globalThis.fetch = nativeFetch;
  await new Promise(resolve => server.close(resolve));
});

const vehicle = { type: 'Moto', brand: 'Bajaj', model: 'Pulsar RS200', year: 2020, mileage: '10.000' };
const record = { vehicle_id: vehicleId, category: 'service', performed_on: '2026-08-10', mileage: '10.000', notes: 'Cambio de aceite y revisión general.' };
const request = (method, route, body, authenticated = true) => nativeFetch(base + route, {
  method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(authenticated ? { Authorization: 'Bearer test-token' } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body)
});

test('vehículos: crear, listar, leer, reemplazar y borrar con códigos REST', async () => {
  reset();
  assert.equal((await request('GET', '/api/vehicles', undefined, false)).status, 401);
  let response = await request('POST', '/api/vehicles', { ...vehicle, user_id: 'victim' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), `/api/vehicles/${vehicleId}`);
  assert.equal((await response.json()).vehicle.user_id, owner);
  response = await request('GET', '/api/vehicles');
  assert.equal((await response.json()).vehicles.length, 1);
  response = await request('GET', `/api/vehicles/${vehicleId}`);
  assert.equal((await response.json()).vehicle.model, 'Pulsar RS200');
  response = await request('PUT', `/api/vehicles/${vehicleId}`, { ...vehicle, mileage: 12000 });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).vehicle.mileage, 12000);
  assert.equal((await request('DELETE', `/api/vehicles/${vehicleId}`)).status, 204);
  assert.equal((await request('GET', `/api/vehicles/${vehicleId}`)).status, 404);
  assert.equal((await request('DELETE', `/api/vehicles/${vehicleId}`)).status, 404);
  assert.ok(calls.some(c => c.url.includes(`user_id=eq.hito2-user&id=eq.${vehicleId}`)));
});

test('mantenciones: CRUD completo y relación con un vehículo propio', async () => {
  reset();
  await request('POST', '/api/vehicles', vehicle);
  let response = await request('POST', '/api/maintenance-records', { ...record, user_id: 'victim' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), '/api/maintenance-records/10');
  assert.equal((await response.json()).record.user_id, owner);
  response = await request('GET', `/api/maintenance-records?vehicle_id=${vehicleId}`);
  assert.equal((await response.json()).records.length, 1);
  response = await request('GET', '/api/maintenance-records/10');
  assert.equal((await response.json()).record.category, 'service');
  response = await request('PUT', '/api/maintenance-records/10', { ...record, category: 'inspection', notes: 'Inspección de frenos y luces.' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).record.category, 'inspection');
  assert.equal((await request('DELETE', '/api/maintenance-records/10')).status, 204);
  assert.equal((await request('GET', '/api/maintenance-records/10')).status, 404);
});

test('errores de validación y ausencia de recurso no se anuncian como éxito', async () => {
  reset();
  assert.equal((await request('POST', '/api/vehicles', { ...vehicle, year: 2000 })).status, 400);
  assert.equal((await request('PUT', '/api/vehicles/x', vehicle)).status, 400);
  assert.equal((await request('POST', '/api/maintenance-records', record, false)).status, 401);
  assert.equal((await request('POST', '/api/maintenance-records', { ...record, performed_on: '2030-01-01' })).status, 400);
  assert.equal((await request('POST', '/api/maintenance-records', { ...record, vehicle_id: 77 })).status, 404);
  assert.equal((await request('PUT', '/api/maintenance-records/77', record)).status, 404);
  missingTable = true;
  const response = await request('GET', '/api/maintenance-records');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'maintenance_not_configured');
});
