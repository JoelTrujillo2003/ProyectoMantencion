import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'docs', 'hito2', 'Garage-Hito2.postman_collection.json');
const vehicle = { type: 'Moto', brand: 'Bajaj', model: 'Pulsar RS200', year: 2020, mileage: 10000 };
const record = { vehicle_id: '{{vehicle_id}}', category: 'service', performed_on: '2026-08-10', mileage: 10000,
  notes: 'Cambio de aceite y revisión general.' };

function item(name, method, url, body, expected, script = '') {
  const request = { method, url, ...(body ? { header: [{ key: 'Content-Type', value: 'application/json' }],
    body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}) };
  return { name, request, event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
    `pm.test('HTTP ${expected}', () => pm.response.to.have.status(${expected}));`,
    ...(script ? [script] : [])
  ] } }] };
}

const auth = item('00 · Iniciar sesión (correo de prueba)', 'POST',
  '{{supabase_url}}/auth/v1/token?grant_type=password', { email: '{{email}}', password: '{{password}}' }, 200,
  "if (pm.response.code === 200) pm.collectionVariables.set('access_token', pm.response.json().access_token);");
auth.request.header.push({ key: 'apikey', value: '{{supabase_publishable_key}}' });
auth.request.auth = { type: 'noauth' };
auth.request.description = 'Usar valores privados en Postman. Si la cuenta solo usa Google, colocar un access_token vigente en la variable local sin publicarlo.';

const collection = {
  info: { name: 'Garage Premium Moderno · Hito 2',
    description: 'Cliente importable para demostrar HTTP, persistencia y errores. No incluye credenciales reales.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{access_token}}', type: 'string' }] },
  variable: [
    { key: 'base_url', value: 'http://localhost:3000' },
    { key: 'supabase_url', value: 'https://TU_PROYECTO.supabase.co' },
    { key: 'supabase_publishable_key', value: '' },
    { key: 'email', value: '' }, { key: 'password', value: '' },
    { key: 'access_token', value: '' }, { key: 'vehicle_id', value: '' }, { key: 'record_id', value: '' }
  ],
  item: [
    auth,
    { name: '01 · Demostración en vivo: cuatro verbos del recurso vehículos', item: [
      item('1 Crear vehículo', 'POST', '{{base_url}}/api/vehicles', vehicle, 201,
        "if (pm.response.code === 201) pm.collectionVariables.set('vehicle_id', pm.response.json().vehicle.id);"),
      item('2 Leer vehículo persistido', 'GET', '{{base_url}}/api/vehicles/{{vehicle_id}}', null, 200),
      item('3 Reemplazar kilometraje', 'PUT', '{{base_url}}/api/vehicles/{{vehicle_id}}', { ...vehicle, mileage: 12000 }, 200),
      item('4 Borrar vehículo', 'DELETE', '{{base_url}}/api/vehicles/{{vehicle_id}}', null, 204)
    ] },
    { name: '02 · Segundo recurso: historial de mantención', item: [
      item('Preparar vehículo propio', 'POST', '{{base_url}}/api/vehicles', vehicle, 201,
        "if (pm.response.code === 201) pm.collectionVariables.set('vehicle_id', pm.response.json().vehicle.id);"),
      item('Crear mantención', 'POST', '{{base_url}}/api/maintenance-records', record, 201,
        "if (pm.response.code === 201) pm.collectionVariables.set('record_id', pm.response.json().record.id);"),
      item('Listar mantenciones del vehículo', 'GET', '{{base_url}}/api/maintenance-records?vehicle_id={{vehicle_id}}', null, 200),
      item('Leer una mantención', 'GET', '{{base_url}}/api/maintenance-records/{{record_id}}', null, 200),
      item('Reemplazar mantención', 'PUT', '{{base_url}}/api/maintenance-records/{{record_id}}',
        { ...record, category: 'inspection', notes: 'Inspección de frenos y luces.' }, 200),
      item('Borrar mantención', 'DELETE', '{{base_url}}/api/maintenance-records/{{record_id}}', null, 204),
      item('Borrar vehículo de preparación', 'DELETE', '{{base_url}}/api/vehicles/{{vehicle_id}}', null, 204)
    ] },
    { name: '03 · Errores controlados', item: [
      item('Año inválido → 400', 'POST', '{{base_url}}/api/vehicles', { ...vehicle, year: 2000 }, 400),
      item('Mantención inexistente → 404', 'GET', '{{base_url}}/api/maintenance-records/999999999', null, 404)
    ] }
  ]
};

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, JSON.stringify(collection, null, 2) + '\n');
console.log(`Generado ${target}`);
