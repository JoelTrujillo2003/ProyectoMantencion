import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'));
const premium = JSON.parse(fs.readFileSync(new URL('../public/premium-vehicles.json', import.meta.url), 'utf8'));
const special = new Set(premium.map(v => [v.type, v.brand, v.model].join('\0')));
const rows = [];
for (const [type, brands] of Object.entries(data)) for (const [brand, models] of Object.entries(brands)) {
  for (const [model, info] of Object.entries(models)) {
    if (!Number.isInteger(info.minYear) || !Number.isInteger(info.maxYear) || info.minYear > info.maxYear) throw new Error(`Rango inválido ${brand} ${model}`);
    rows.push({ type, brand, model, min_year: info.minYear, max_year: info.maxYear, allowed_years: info.years || null });
  }
}
for (const item of premium) if (!data[item.type]?.[item.brand]?.[item.model]) throw new Error(`Premium ausente: ${item.model}`);
fs.writeFileSync(new URL('../public/vehicles.js', import.meta.url), '// Generado desde catalog.json. Ejecuta npm run catalog:build después de editarlo.\nwindow.vehicleDB = ' + JSON.stringify(data, null, 2) + ';\nwindow.premiumVehicleCatalog = ' + JSON.stringify(premium) + ';\n');
const sqlJson = JSON.stringify(rows);
const premiumJson = JSON.stringify(premium);
const sql = `-- Generado por npm run catalog:build. Ejecutar después de 001 y 002.\n-- No modifica registros de vehículos existentes. Valida nuevas altas y cambios.\nbegin;
create table if not exists public.vehicle_catalog (
 type text not null, brand text not null, model text not null,
 min_year integer not null, max_year integer not null, allowed_years integer[],
 primary key(type, brand, model), check(min_year <= max_year)
);
alter table public.vehicle_catalog enable row level security;
revoke all on public.vehicle_catalog from anon, authenticated;
grant select on public.vehicle_catalog to anon, authenticated;
drop policy if exists public_read_catalog on public.vehicle_catalog;
create policy public_read_catalog on public.vehicle_catalog for select to anon, authenticated using(true);
insert into public.vehicle_catalog(type,brand,model,min_year,max_year,allowed_years)
select type,brand,model,min_year,max_year,allowed_years
from jsonb_to_recordset($catalog$${sqlJson}$catalog$::jsonb)
as c(type text,brand text,model text,min_year integer,max_year integer,allowed_years integer[])
on conflict(type,brand,model) do update set min_year=excluded.min_year,max_year=excluded.max_year,allowed_years=excluded.allowed_years;
insert into public.premium_vehicle_models(type,brand,model)
select type,brand,model from jsonb_to_recordset($premium$${premiumJson}$premium$::jsonb) as p(type text,brand text,model text)
on conflict(type,brand,model) do nothing;
create or replace function public.validate_catalog_vehicle()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare entry public.vehicle_catalog%rowtype;
begin
 select * into entry from public.vehicle_catalog where type=new.type and brand=new.brand and model=new.model;
 if not found then raise exception 'VEHICLE_NOT_IN_CATALOG'; end if;
 if new.year is null or new.year < entry.min_year or new.year > least(entry.max_year,extract(year from now() at time zone 'America/Santiago')::integer)
 or (entry.allowed_years is not null and not(new.year=any(entry.allowed_years))) then raise exception 'INVALID_VEHICLE_YEAR'; end if;
 if new.mileage is null or new.mileage < 0 or new.mileage > 999999 then raise exception 'INVALID_MILEAGE'; end if;
 return new;
end $$;
revoke all on function public.validate_catalog_vehicle() from public;
drop trigger if exists validate_catalog_vehicle on public.vehicles;
create trigger validate_catalog_vehicle before insert or update of type,brand,model,year,mileage on public.vehicles
for each row execute function public.validate_catalog_vehicle();
commit;\n`;
fs.writeFileSync(new URL('../supabase/migrations/003_catalog_chile.sql', import.meta.url), sql);
console.log(JSON.stringify({ models: rows.length, premium: special.size, byType: Object.fromEntries(Object.entries(data).map(([type, brands]) => [type, {brands: Object.keys(brands).length, models: rows.filter(r => r.type === type).length}])) }, null, 2));
