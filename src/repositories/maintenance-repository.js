import { userDatabaseRequest } from '../supabase.js';

const fields = 'id,vehicle_id,category,performed_on,mileage,notes,created_at';
const base = (userId, extra = '') =>
  `maintenance_records?select=${fields}&user_id=eq.${encodeURIComponent(userId)}${extra}`;

export async function listRecords(token, userId, vehicleId = null) {
  const filter = vehicleId ? `&vehicle_id=eq.${vehicleId}` : '';
  return userDatabaseRequest(token, `${base(userId, filter)}&order=performed_on.desc,id.desc`);
}

export async function findRecord(token, userId, id) {
  const rows = await userDatabaseRequest(token, `${base(userId, `&id=eq.${id}`)}&limit=1`);
  return rows?.[0] || null;
}

export async function insertRecord(token, userId, record) {
  const rows = await userDatabaseRequest(token, 'maintenance_records', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: [{ user_id: userId, ...record }]
  });
  return rows?.[0] || null;
}

export async function replaceRecord(token, userId, id, record) {
  const rows = await userDatabaseRequest(token,
    `maintenance_records?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: record
    });
  return rows?.[0] || null;
}

export async function removeRecord(token, userId, id) {
  const rows = await userDatabaseRequest(token,
    `maintenance_records?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, {
      method: 'DELETE', headers: { Prefer: 'return=representation' }
    });
  return Boolean(rows?.length);
}
