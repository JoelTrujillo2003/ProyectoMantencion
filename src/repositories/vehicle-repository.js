import { userDatabaseRequest } from '../supabase.js';

const fields = 'id,type,brand,model,year,mileage,created_at';

export async function listVehicles(token, userId) {
  return userDatabaseRequest(token,
    `vehicles?select=${fields}&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`);
}

export async function findVehicle(token, userId, id) {
  const rows = await userDatabaseRequest(token,
    `vehicles?select=${fields}&user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}&limit=1`);
  return rows?.[0] || null;
}

export async function insertVehicle(token, userId, vehicle) {
  const rows = await userDatabaseRequest(token, 'vehicles', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: [{ user_id: userId, ...vehicle }]
  });
  return rows?.[0] || null;
}

export async function replaceVehicle(token, userId, id, vehicle) {
  const rows = await userDatabaseRequest(token,
    `vehicles?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: vehicle
    });
  return rows?.[0] || null;
}

export async function removeVehicle(token, userId, id) {
  const rows = await userDatabaseRequest(token,
    `vehicles?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, {
      method: 'DELETE', headers: { Prefer: 'return=representation' }
    });
  return Boolean(rows?.length);
}
