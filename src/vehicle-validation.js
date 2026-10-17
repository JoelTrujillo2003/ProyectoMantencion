import fs from 'node:fs';
import '../public/vehicle-rules.js';
import { ApiError } from './supabase.js';

export const catalog = JSON.parse(fs.readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'));
export const rules = globalThis.GarageVehicleRules;
export function validateVehicle(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Completa los datos del vehículo.', 'invalid_vehicle');
  const { type, brand, model } = body;
  if (![type, brand, model].every(v => typeof v === 'string' && v.length > 0 && v.length <= 80)) {
    throw new ApiError(400, 'Selecciona tipo, marca y modelo del catálogo.', 'invalid_vehicle');
  }
  const info = rules.modelInfo(catalog, type, brand, model);
  if (!info) throw new ApiError(400, 'La marca y el modelo no corresponden al catálogo seleccionado.', 'invalid_vehicle');
  const year = typeof body.year === 'number' ? body.year : /^\d{4}$/.test(body.year || '') ? Number(body.year) : NaN;
  if (!rules.yearsFor(info).includes(year)) throw new ApiError(400, 'Selecciona uno de los años habilitados para este modelo.', 'invalid_vehicle_year');
  const mileage = rules.parseMileage(body.mileage);
  if (Number.isNaN(mileage)) throw new ApiError(400, 'Ingresa un kilometraje entero entre 0 y 999.999.', 'invalid_mileage');
  return { type, brand, model, year, mileage };
}
