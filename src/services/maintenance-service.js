import { ApiError } from '../supabase.js';
import { rules } from '../vehicle-validation.js';
import { requireId } from './vehicle-service.js';
import { findVehicle } from '../repositories/vehicle-repository.js';
import * as repository from '../repositories/maintenance-repository.js';

const CATEGORIES = new Set(['inspection', 'service', 'repair']);

function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, 'Usa una fecha con formato AAAA-MM-DD.', 'invalid_maintenance');
  }
  const date = new Date(`${value}T00:00:00Z`);
  const todayInChile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > todayInChile) {
    throw new ApiError(400, 'La fecha de mantención debe ser válida y no puede estar en el futuro.', 'invalid_maintenance');
  }
  return value;
}

export function validateRecord(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Completa el registro de mantención.', 'invalid_maintenance');
  }
  if (typeof body.vehicle_id !== 'string' && typeof body.vehicle_id !== 'number') {
    throw new ApiError(400, 'El identificador del vehículo debe ser válido.', 'invalid_maintenance');
  }
  const vehicleId = requireId(String(body.vehicle_id));
  if (!CATEGORIES.has(body.category)) {
    throw new ApiError(400, 'La categoría debe ser inspection, service o repair.', 'invalid_maintenance');
  }
  const mileage = rules.parseMileage(body.mileage);
  if (Number.isNaN(mileage)) {
    throw new ApiError(400, 'Ingresa un kilometraje entero entre 0 y 999.999.', 'invalid_maintenance');
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length < 5 || notes.length > 1000) {
    throw new ApiError(400, 'La descripción debe tener entre 5 y 1.000 caracteres.', 'invalid_maintenance');
  }
  return { vehicle_id: vehicleId, category: body.category,
    performed_on: validateDate(body.performed_on), mileage, notes };
}

function mapDatabaseError(error) {
  if (['PGRST205', '42P01'].includes(error.code)) {
    return new ApiError(503, 'Falta aplicar la migración 004_maintenance_records.sql.', 'maintenance_not_configured');
  }
  if (error.code === '23503') {
    return new ApiError(404, 'No se encontró el vehículo en tu cuenta.', 'vehicle_not_found');
  }
  return error;
}

async function ensureOwnVehicle(token, userId, id) {
  if (!await findVehicle(token, userId, String(id))) {
    throw new ApiError(404, 'No se encontró el vehículo en tu cuenta.', 'vehicle_not_found');
  }
}

export async function list(token, userId, rawVehicleId) {
  const vehicleId = rawVehicleId === undefined ? null : requireId(String(rawVehicleId));
  try { return await repository.listRecords(token, userId, vehicleId); }
  catch (error) { throw mapDatabaseError(error); }
}

export async function get(token, userId, rawId) {
  try {
    const record = await repository.findRecord(token, userId, requireId(rawId));
    if (!record) throw new ApiError(404, 'No se encontró el registro de mantención.', 'maintenance_not_found');
    return record;
  } catch (error) { throw mapDatabaseError(error); }
}

export async function create(token, userId, body) {
  const record = validateRecord(body);
  await ensureOwnVehicle(token, userId, record.vehicle_id);
  try {
    const saved = await repository.insertRecord(token, userId, record);
    if (!saved) throw new ApiError(502, 'No se pudo confirmar el registro guardado.', 'maintenance_unconfirmed');
    return saved;
  } catch (error) { throw mapDatabaseError(error); }
}

export async function replace(token, userId, rawId, body) {
  const id = requireId(rawId);
  const record = validateRecord(body);
  await ensureOwnVehicle(token, userId, record.vehicle_id);
  try {
    const saved = await repository.replaceRecord(token, userId, id, record);
    if (!saved) throw new ApiError(404, 'No se encontró el registro de mantención.', 'maintenance_not_found');
    return saved;
  } catch (error) { throw mapDatabaseError(error); }
}

export async function remove(token, userId, rawId) {
  try {
    const removed = await repository.removeRecord(token, userId, requireId(rawId));
    if (!removed) throw new ApiError(404, 'No se encontró el registro de mantención.', 'maintenance_not_found');
  } catch (error) { throw mapDatabaseError(error); }
}
