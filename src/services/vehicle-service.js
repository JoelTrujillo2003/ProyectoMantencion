import fs from 'node:fs';
import { ApiError, getUserSubscription } from '../supabase.js';
import { hasPremiumAccess } from '../entitlements.js';
import { validateVehicle } from '../vehicle-validation.js';
import * as repository from '../repositories/vehicle-repository.js';

const premiumCatalog = JSON.parse(fs.readFileSync(new URL('../../public/premium-vehicles.json', import.meta.url), 'utf8'));
const premiumKeys = new Set(premiumCatalog.map(v => `${v.type}\u0000${v.brand}\u0000${v.model}`));

export function requireId(value) {
  const numeric = /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (typeof value !== 'string' || (!numeric && !uuid)) {
    throw new ApiError(400, 'El identificador debe ser un UUID válido.', 'invalid_id');
  }
  return value;
}

function notFound() {
  return new ApiError(404, 'No se encontró el vehículo en tu cuenta.', 'vehicle_not_found');
}

function mapVehicleDatabaseError(error) {
  if (/VEHICLE_NOT_IN_CATALOG|INVALID_VEHICLE_YEAR|INVALID_MILEAGE/.test(error.message || '')) {
    return new ApiError(400, 'Revisa el modelo, año y kilometraje. El catálogo de la base de datos debe estar actualizado.', 'invalid_vehicle');
  }
  if (error.message?.includes('FREE_VEHICLE_LIMIT')) {
    return new ApiError(403, 'El plan gratuito permite guardar hasta 2 vehículos.', 'vehicle_limit_reached');
  }
  if (error.message?.includes('PREMIUM_VEHICLE_REQUIRED')) {
    return new ApiError(403, 'Ese modelo está disponible únicamente en Premium.', 'premium_vehicle_required');
  }
  return error;
}

async function checkPlan(token, userId, vehicle) {
  const key = `${vehicle.type}\u0000${vehicle.brand}\u0000${vehicle.model}`;
  if (!premiumKeys.has(key)) return;
  const subscription = await getUserSubscription(token, userId);
  if (!hasPremiumAccess(subscription)) {
    throw new ApiError(403, 'Ese modelo está disponible únicamente en Premium.', 'premium_vehicle_required');
  }
}

export async function list(token, userId) {
  return repository.listVehicles(token, userId);
}

export async function get(token, userId, rawId) {
  const vehicle = await repository.findVehicle(token, userId, requireId(rawId));
  if (!vehicle) throw notFound();
  return vehicle;
}

export async function create(token, userId, body) {
  const vehicle = validateVehicle(body);
  await checkPlan(token, userId, vehicle);
  try {
    const saved = await repository.insertVehicle(token, userId, vehicle);
    if (!saved) throw new ApiError(502, 'No se pudo confirmar el vehículo guardado.', 'vehicle_unconfirmed');
    return saved;
  } catch (error) { throw mapVehicleDatabaseError(error); }
}

export async function replace(token, userId, rawId, body) {
  const id = requireId(rawId);
  const vehicle = validateVehicle(body);
  await checkPlan(token, userId, vehicle);
  try {
    const saved = await repository.replaceVehicle(token, userId, id, vehicle);
    if (!saved) throw notFound();
    return saved;
  } catch (error) { throw mapVehicleDatabaseError(error); }
}

export async function remove(token, userId, rawId) {
  const removed = await repository.removeVehicle(token, userId, requireId(rawId));
  if (!removed) throw notFound();
}
