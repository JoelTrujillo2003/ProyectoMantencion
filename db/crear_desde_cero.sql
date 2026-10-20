-- Garage Premium Moderno · Hito 2
-- Crear desde cero en un proyecto Supabase NUEVO con el esquema auth preinstalado.
-- No ejecutar este archivo combinado sobre la base de producción.


-- ===== 001_freemium.sql =====

begin;

-- 1) Estado de la suscripción. El navegador solo puede leer su propia fila.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'premium' check (plan in ('premium')),
  status text not null default 'pending',
  provider text not null default 'mercadopago',
  provider_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists "users_read_own_subscription" on public.subscriptions;
create policy "users_read_own_subscription"
on public.subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- 2) Catálogo que el servidor y la base consideran exclusivo de Premium.
create table if not exists public.premium_vehicle_models (
  type text not null,
  brand text not null,
  model text not null,
  primary key (type, brand, model)
);

insert into public.premium_vehicle_models (type, brand, model) values
  ('Auto', 'Toyota', 'Land Cruiser'),
  ('Auto', 'Toyota', 'Prado'),
  ('Auto', 'Toyota', 'Tacoma'),
  ('Auto', 'Toyota', 'Tundra'),
  ('Auto', 'Ford', 'F-150'),
  ('Auto', 'Ford', 'Mustang'),
  ('Auto', 'Ford', 'Bronco'),
  ('Auto', 'Subaru', 'WRX'),
  ('Auto', 'Mazda', 'MX-5'),
  ('Moto', 'Yamaha', 'R1'),
  ('Moto', 'Yamaha', 'MT-10'),
  ('Moto', 'Yamaha', 'Super Tenere 1200'),
  ('Moto', 'Honda', 'Africa Twin'),
  ('Moto', 'Honda', 'CBR650R'),
  ('Moto', 'Honda', 'GL1800 Gold Wing'),
  ('Moto', 'Kawasaki', 'Ninja ZX-6R'),
  ('Moto', 'Kawasaki', 'Ninja ZX-10R'),
  ('Moto', 'Kawasaki', 'Z900'),
  ('Moto', 'Kawasaki', 'Z1000'),
  ('Moto', 'KTM', '890 Duke R'),
  ('Moto', 'KTM', '1290 Super Duke R'),
  ('Moto', 'KTM', '1290 Super Adventure'),
  ('Moto', 'BMW', 'R1250GS'),
  ('Moto', 'BMW', 'R1300GS'),
  ('Moto', 'BMW', 'S1000RR'),
  ('Moto', 'BMW', 'S1000XR'),
  ('Moto', 'Triumph', 'Speed Triple'),
  ('Moto', 'Triumph', 'Tiger 1200'),
  ('Moto', 'Ducati', 'Multistrada V4'),
  ('Moto', 'Ducati', 'Panigale V2'),
  ('Moto', 'Ducati', 'Panigale V4'),
  ('Moto', 'Ducati', 'Streetfighter V4'),
  ('Moto', 'Suzuki', 'Hayabusa'),
  ('Moto', 'Suzuki', 'GSX-R600'),
  ('Moto', 'Suzuki', 'GSX-R1000')
on conflict do nothing;

alter table public.premium_vehicle_models enable row level security;
drop policy if exists "authenticated_read_premium_models" on public.premium_vehicle_models;
create policy "authenticated_read_premium_models"
on public.premium_vehicle_models for select
to authenticated
using (true);

grant select on public.premium_vehicle_models to authenticated;

-- 3) Compatibilidad con la tabla vehicles que ya usa el proyecto.
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  model text not null,
  year integer not null,
  mileage integer not null
);

alter table public.vehicles add column if not exists type text;
alter table public.vehicles add column if not exists created_at timestamptz default now();

-- NOT VALID conserva filas antiguas que aún no tienen tipo, pero obliga a que
-- toda fila nueva indique Auto o Moto.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicles_type_valid'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_type_valid
      check (type is not null and type in ('Auto', 'Moto')) not valid;
  end if;
end $$;

alter table public.vehicles enable row level security;

-- Las políticas RLS se combinan con OR. Se eliminan las anteriores para que
-- una política permisiva antigua no deje abierta la tabla.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'vehicles'
  loop
    execute format('drop policy %I on public.vehicles', existing_policy.policyname);
  end loop;
end $$;

create policy "users_read_own_vehicles"
on public.vehicles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_vehicles"
on public.vehicles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_vehicles"
on public.vehicles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_vehicles"
on public.vehicles for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.vehicles from anon;
grant select, insert, update, delete on public.vehicles to authenticated;

-- 4) La base impide saltarse el plan manipulando JavaScript o enviando peticiones directas.
create or replace function public.has_premium_access(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = target_user
      and s.plan = 'premium'
      and s.status in ('authorized', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function public.enforce_vehicle_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  premium boolean;
  saved_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  premium := public.has_premium_access(new.user_id);

  if exists (
    select 1 from public.premium_vehicle_models p
    where p.type = new.type and p.brand = new.brand and p.model = new.model
  ) and not premium then
    raise exception using
      errcode = 'P0001',
      message = 'PREMIUM_VEHICLE_REQUIRED';
  end if;

  if tg_op = 'INSERT' and not premium then
    select count(*) into saved_count
    from public.vehicles v
    where v.user_id = new.user_id;

    if saved_count >= 2 then
      raise exception using
        errcode = 'P0001',
        message = 'FREE_VEHICLE_LIMIT';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.has_premium_access(uuid) from public;
revoke all on function public.enforce_vehicle_entitlements() from public;

drop trigger if exists vehicles_entitlements_guard on public.vehicles;
create trigger vehicles_entitlements_guard
before insert or update on public.vehicles
for each row execute function public.enforce_vehicle_entitlements();

commit;


-- ===== 002_feedback.sql =====

-- Ejecutar en el SQL Editor de TU proyecto Supabase.
-- No modifica vehículos, suscripciones ni usuarios existentes.
begin;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_email text not null,
  category text not null check (category in ('suggestion', 'bug', 'vehicle_request', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  consent boolean not null check (consent = true),
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;
-- Ni visitantes ni usuarios pueden leer o escribir directamente en la tabla.
revoke all on table public.feedback from public, anon, authenticated;
grant all on table public.feedback to service_role;

-- SECURITY DEFINER permite únicamente la inserción validada de abajo.
-- La identidad proviene del JWT verificado por Supabase, nunca del formulario.
create or replace function public.submit_feedback(
  p_type text, p_subject text, p_message text, p_consent boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  inserted_id uuid;
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('suggestion', 'bug', 'vehicle_request', 'other')
     or p_subject is null or char_length(btrim(p_subject)) not between 3 and 120
     or p_message is null or char_length(btrim(p_message)) not between 10 and 2000
     or p_consent is distinct from true then
    raise exception 'INVALID_FEEDBACK' using errcode = '22023';
  end if;
  select email into caller_email from auth.users where id = caller_id;
  if caller_email is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  -- Serializa por usuario: el límite también funciona con envíos simultáneos.
  perform pg_advisory_xact_lock(hashtextextended('garage-feedback:' || caller_id::text, 0));
  if (select count(*) from public.feedback
      where user_id = caller_id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'FEEDBACK_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, contact_email, category, subject, message, consent)
  values (caller_id, caller_email, p_type, btrim(p_subject), btrim(p_message), true)
  returning id into inserted_id;
  return inserted_id;
end;
$$;
revoke all on function public.submit_feedback(text, text, text, boolean) from public, anon;
grant execute on function public.submit_feedback(text, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;


-- ===== 003_catalog_chile.sql =====

-- Generado por npm run catalog:build. Ejecutar después de 001 y 002.
-- No modifica registros de vehículos existentes. Valida nuevas altas y cambios.
begin;
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
from jsonb_to_recordset($catalog$[{"type":"Auto","brand":"Chevrolet","model":"Spark","min_year":2005,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Sail","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Tracker","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Onix","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Colorado","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Captiva","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Silverado","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Groove","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Spin","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Cavalier","min_year":1995,"max_year":2021,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Prisma","min_year":2013,"max_year":2019,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Cruze","min_year":2010,"max_year":2023,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Equinox","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Traverse","min_year":2009,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Tahoe","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Suburban","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Montana","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"D-Max","min_year":2004,"max_year":2022,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"N300","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Orlando","min_year":2012,"max_year":2018,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Corsa","min_year":1994,"max_year":2011,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Optra","min_year":2004,"max_year":2013,"allowed_years":null},{"type":"Auto","brand":"Chevrolet","model":"Aveo","min_year":2005,"max_year":2014,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Swift","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Baleno","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Jimny","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Alto","min_year":2005,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"S-Presso","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Vitara","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Ertiga","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Celerio","min_year":2009,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Dzire","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Ignis","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Grand Nomade","min_year":1999,"max_year":2019,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Grand Vitara","min_year":1998,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"APV","min_year":2005,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Ciaz","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"XL7","min_year":2002,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Suzuki","model":"Fronx","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Yaris","min_year":1999,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Corolla","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Hilux","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"RAV4","min_year":1994,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Rush","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"4Runner","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Fortuner","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Land Cruiser","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Prado","min_year":1996,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Sequoia","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Tacoma","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Tundra","min_year":2000,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"C-HR","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Prius","min_year":2005,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Prius C","min_year":2012,"max_year":2022,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Camry","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Agya","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Raize","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Avanza","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Yaris Cross","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Corolla Cross","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Toyota","model":"Tercel","min_year":1990,"max_year":2000,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Versa","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Kicks","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Navara","min_year":2005,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Qashqai","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"X-Trail","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Sentra","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Pathfinder","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Patrol","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"March","min_year":2011,"max_year":2023,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Note","min_year":2014,"max_year":2021,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Murano","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Tiida","min_year":2006,"max_year":2018,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Juke","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"NP300","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Terrano","min_year":1990,"max_year":2015,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Leaf","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"V16","min_year":1990,"max_year":2010,"allowed_years":null},{"type":"Auto","brand":"Nissan","model":"Almera","min_year":1996,"max_year":2006,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"Civic","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"Accord","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"CR-V","min_year":1997,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"HR-V","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"Pilot","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"Ridgeline","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"Fit","min_year":2004,"max_year":2022,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"WR-V","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"City","min_year":2010,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Honda","model":"Odyssey","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Accent","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Tucson","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Santa Fe","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Elantra","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Grand i10","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"i10","min_year":2008,"max_year":2019,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"i20","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Creta","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Venue","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Palisade","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"H-1","min_year":1998,"max_year":2023,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Staria","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Hyundai","model":"Ioniq","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Morning","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Rio","min_year":2000,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Cerato","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Sportage","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Sorento","min_year":2002,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Soluto","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Seltos","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Sonet","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Niro","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Carens","min_year":2000,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Carnival","min_year":2000,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Kia","model":"Frontier","min_year":1998,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"206","min_year":1999,"max_year":2012,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"207","min_year":2007,"max_year":2014,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"208","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"308","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"508","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"2008","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"3008","min_year":2009,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"5008","min_year":2010,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"Partner","min_year":1996,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"Rifter","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Peugeot","model":"Landtrek","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"Mazda3","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"Mazda6","min_year":2002,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"CX-5","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"CX-30","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"BT-50","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"Mazda2","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"CX-3","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"CX-9","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"CX-60","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"CX-90","min_year":2024,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mazda","model":"MX-5","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Ranger","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"F-150","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Explorer","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Territory","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Escape","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"EcoSport","min_year":2003,"max_year":2022,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Edge","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Expedition","min_year":1997,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Mustang","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Bronco","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Maverick","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Ford","model":"Transit","min_year":2000,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Gol","min_year":1990,"max_year":2023,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Polo","min_year":2000,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Amarok","min_year":2010,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"T-Cross","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Nivus","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Taos","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Tiguan","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Saveiro","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Virtus","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Vento","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Jetta","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Volkswagen","model":"Golf","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"Impreza","min_year":1993,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"XV","min_year":2012,"max_year":2024,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"Crosstrek","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"Forester","min_year":1997,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"Outback","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"Legacy","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"WRX","min_year":1992,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Subaru","model":"Evoltis","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"L200","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"Montero Sport","min_year":1997,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"Outlander","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"ASX","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"Eclipse Cross","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"Xpander","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"Mirage","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Mitsubishi","model":"Lancer","min_year":1990,"max_year":2018,"allowed_years":null},{"type":"Auto","brand":"MG","model":"MG3","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"ZS","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"RX5","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"HS","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"MG5","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"MG6","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"ZX","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"Marvel R","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"MG","model":"MG4","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 2","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 2 Pro","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 3","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 4","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 7 Pro","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 8","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Tiggo 8 Pro","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"Arrizo 5","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Auto","brand":"Chery","model":"IQ","min_year":2007,"max_year":2021,"allowed_years":null},{"type":"Auto","brand":"Changan","model":"CS75 Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"Alsvin Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"CS35 Max","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"CS55 Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"CS55 Plus iDD","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"CS15 Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"CS35 Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"Lumin","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"Eado Plus iDD","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"UNI-K","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"UNI-T","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"X7 Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"Hunter","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"Hunter REEV","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Changan","model":"Alsvin","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Deepal","model":"S05","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Deepal","model":"S07","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Deepal","model":"G318","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Avatr","model":"11","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Avatr","model":"07","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"GWM","model":"Poer P500 PHEV","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"GWM","model":"Poer Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"GWM","model":"Poer","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"GWM","model":"Wingle 7","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"H7 Max","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"H7","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"H6 GT","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"H6","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"Jolion Hybrid","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"Jolion Max","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"Jolion Pro","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Haval","model":"Jolion","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Tank","model":"300","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Tank","model":"500","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Ora","model":"5","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Ora","model":"03","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Song Plus DM-i","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Yuan Plus","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Song Pro","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Dolphin Mini","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Shark","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Sealion 7","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Atto 8","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BYD","model":"Yuan Pro DM-i","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"Coolray Lite","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"Coolray","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"Cityray","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"Starray","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"Okavango","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"EX2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"EX5 EM-i","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Geely","model":"EX5","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Renault","model":"Arkana mild hybrid","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Renault","model":"Koleos E-Tech Hybrid","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Renault","model":"Master","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Citroën","model":"C3","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Citroën","model":"C4","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Citroën","model":"C5 Aircross","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Citroën","model":"Berlingo Multispace","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Citroën","model":"Berlingo Van","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Omoda","model":"C5","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Omoda","model":"C5 SHS","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Omoda","model":"C7","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Omoda","model":"E5","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Jaecoo","model":"J5","min_year":2025,"max_year":2026,"allowed_years":[2025,2026]},{"type":"Auto","brand":"Jaecoo","model":"J6","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Jaecoo","model":"J7","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Jaecoo","model":"J7 SHS","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Jaecoo","model":"J8","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X1","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X1 Híbrido","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X2 M35i","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X3","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X3 Híbrido","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X5","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X6","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"X7","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"Serie 1","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"M135","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"Serie 3","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"BMW","model":"Serie 3 Híbrido","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Audi","model":"A1","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"Audi","model":"RS e-tron GT","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"JAC","model":"T8 Pro","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"JAC","model":"T9","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"JAC","model":"Refine Cargo","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"JAC","model":"X200","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"JAC","model":"Sunray Pasajeros","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Auto","brand":"DFSK","model":"Z9","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Yamaha","model":"MT-03","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"MT-07","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"MT-09","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"MT-10","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"R15","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"R3","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"R7","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"R1","min_year":1998,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"FZ-S","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"FZ-25","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"FZ-16","min_year":2009,"max_year":2016,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Tenere 700","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Super Tenere 1200","min_year":2010,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"NMAX 155","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"XMAX 300","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"TMAX","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Aerox","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Ray ZR","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Fazer 150","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Fazer 250","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"XT660R","min_year":2004,"max_year":2016,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"WR250F","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"WR450F","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"YZ250","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"YZ250F","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"YZ450F","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"XTZ 125","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"Lander 250","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Yamaha","model":"XTZ 150 Crosser","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CB500X","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Navi","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"XR190L","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"XR150L","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CB190R","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CBR500R","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Africa Twin","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CB125F","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CG150 Titan","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Elite 125","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"PCX 150/160","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"ADV 150","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Tornado 250","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CRF250F","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CRF300L","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CRF250L","min_year":2013,"max_year":2020,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CBR250R","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CBR650R","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CB650R","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"NC750X","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Rebel 300","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Rebel 500","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"GL1800 Gold Wing","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CRF450R","min_year":2002,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"CRF250R","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Dio","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Honda","model":"Sahara 300","min_year":2024,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Pulsar RS200","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Pulsar NS200","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Pulsar NS160","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Pulsar NS125","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Pulsar N250","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Dominar 400","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Dominar 250","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Avenger 220","min_year":2010,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Avenger 160","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Boxer 150","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Platina 100","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Platina 125","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Discover 125","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Bajaj","model":"Pulsar LS125","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Bajaj","model":"Pulsar NS400Z","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Bajaj","model":"Dominar 400 ADV","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Bajaj","model":"Pulsar NS200 UG2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Bajaj","model":"Pulsar NS160 UG2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Bajaj","model":"Pulsar 125","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Kawasaki","model":"Ninja 400","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Z400","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Versys-X 300","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KLR 650","min_year":1987,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Z650","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Ninja 300","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Ninja 650","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Ninja ZX-6R","min_year":1995,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Ninja ZX-10R","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Z900","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Z1000","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Versys 650","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Versys 1000","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"Vulcan S","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KX250","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KX450","min_year":2006,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KLX140","min_year":2008,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KLX230","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KLX250","min_year":2009,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"KLX300","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Kawasaki","model":"W800","min_year":2011,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"Duke 200","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"Duke 250","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"Duke 390","min_year":2013,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"RC 200","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"RC 390","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"390 Adventure","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"250 Adventure","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"790 Duke","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"890 Duke R","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"890 Adventure","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"1290 Super Duke R","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"1290 Super Adventure","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"EXC-F 250","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"EXC-F 350","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"EXC-F 450","min_year":2003,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"KTM","model":"EXC 300","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"Gixxer 150","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"Gixxer 250","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"V-Strom 250","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"V-Strom 650","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"V-Strom 1050","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"GSX-R150","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"GSX-S150","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"GSX-S750","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"GSX-R600","min_year":1992,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"GSX-R1000","min_year":2001,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"DR650","min_year":1990,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"Burgman 400","min_year":1998,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"Hayabusa","min_year":1999,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"RM-Z250","min_year":2004,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Suzuki","model":"RM-Z450","min_year":2005,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"Apache RTR 160 4V","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"Apache RTR 200 4V","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"Apache RR 310","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"NTORQ 125","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"Raider 125","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"Ronin 225","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"TVS","model":"HLX 150","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"G310R","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"G310GS","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"F750GS","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"F850GS","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"F900R","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"F900XR","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"R1200GS","min_year":2004,"max_year":2018,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"R1250GS","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"R1300GS","min_year":2024,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"S1000RR","min_year":2009,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"BMW","model":"S1000XR","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Meteor 350","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Himalayan","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Himalayan 450","min_year":2024,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Interceptor 650","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Continental GT 650","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Classic 350","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Hunter 350","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Royal Enfield","model":"Super Meteor 650","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"150NK","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"250NK","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"300NK","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"300SR","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"400NK","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"450SR","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"650MT","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"650NK","min_year":2014,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"700CL-X","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"CFMoto","model":"800MT","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Haojue","model":"DR160","min_year":2019,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Haojue","model":"NK150","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Haojue","model":"KA150","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Haojue","model":"TR150","min_year":2017,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Haojue","model":"UHR150","min_year":2023,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Trident 660","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Tiger Sport 660","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Street Triple","min_year":2007,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Speed Triple","min_year":1994,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Tiger 900","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Tiger 1200","min_year":2012,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Bonneville T100","min_year":2002,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Bonneville T120","min_year":2016,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Scrambler 400 X","min_year":2024,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Triumph","model":"Speed 400","min_year":2024,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Monster","min_year":1993,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Scrambler","min_year":2015,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Multistrada V2","min_year":2022,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Multistrada V4","min_year":2021,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Panigale V2","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Panigale V4","min_year":2018,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Ducati","model":"Streetfighter V4","min_year":2020,"max_year":2026,"allowed_years":null},{"type":"Moto","brand":"Zontes","model":"ZT368T-G","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT703-RR","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT703-F","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT350-GK","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT350-T2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT200-Z2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT350T-E","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT350T-M","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT200-G1","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Zontes","model":"ZT200-U1","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Keeway","model":"K-light 250","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Keeway","model":"M250","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Keeway","model":"TX 150","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Keeway","model":"V 302C","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"QJMotor","model":"NX 150","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"QJMotor","model":"SRK 125 R","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"QJMotor","model":"SRT 550 SX","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"QJMotor","model":"SRT 550 SX Touring","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"QJMotor","model":"SRT 600 X","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"QJMotor","model":"SRT 800 SX","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Cyclone","model":"RA2","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Cyclone","model":"RX-401","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Cyclone","model":"RX1","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Kymco","model":"X-Town 300","min_year":2023,"max_year":2023,"allowed_years":[2023]},{"type":"Moto","brand":"Voge","model":"900DS Adventure","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"250RR","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"RR660S","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"AC350","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"AC525","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"R250","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"R625","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"300 Rally","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"300DS","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"300DS SE","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"DS625X","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"DS800X Rally","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"DS900X","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"SR150GT","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"SR3","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"CU250","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Voge","model":"CU625","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Benelli","model":"302S","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Benelli","model":"Leoncino 500 Trail","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Benelli","model":"Leoncino 800 Trail","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Fantic","model":"Caballero 500 Rally","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Fantic","model":"Caballero 700 Scrambler","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Fantic","model":"Caballero 700 Travel","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Fantic","model":"XE 300 2T","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Fantic","model":"XEF 250 4T","min_year":2026,"max_year":2026,"allowed_years":[2026]},{"type":"Moto","brand":"Fantic","model":"XEF 310 4T","min_year":2026,"max_year":2026,"allowed_years":[2026]}]$catalog$::jsonb)
as c(type text,brand text,model text,min_year integer,max_year integer,allowed_years integer[])
on conflict(type,brand,model) do update set min_year=excluded.min_year,max_year=excluded.max_year,allowed_years=excluded.allowed_years;
insert into public.premium_vehicle_models(type,brand,model)
select type,brand,model from jsonb_to_recordset($premium$[{"type":"Auto","brand":"Toyota","model":"Land Cruiser"},{"type":"Auto","brand":"Toyota","model":"Prado"},{"type":"Auto","brand":"Toyota","model":"Tacoma"},{"type":"Auto","brand":"Toyota","model":"Tundra"},{"type":"Auto","brand":"Ford","model":"F-150"},{"type":"Auto","brand":"Ford","model":"Mustang"},{"type":"Auto","brand":"Ford","model":"Bronco"},{"type":"Auto","brand":"Subaru","model":"WRX"},{"type":"Auto","brand":"Mazda","model":"MX-5"},{"type":"Moto","brand":"Yamaha","model":"R1"},{"type":"Moto","brand":"Yamaha","model":"MT-10"},{"type":"Moto","brand":"Yamaha","model":"Super Tenere 1200"},{"type":"Moto","brand":"Honda","model":"Africa Twin"},{"type":"Moto","brand":"Honda","model":"CBR650R"},{"type":"Moto","brand":"Honda","model":"GL1800 Gold Wing"},{"type":"Moto","brand":"Kawasaki","model":"Ninja ZX-6R"},{"type":"Moto","brand":"Kawasaki","model":"Ninja ZX-10R"},{"type":"Moto","brand":"Kawasaki","model":"Z900"},{"type":"Moto","brand":"Kawasaki","model":"Z1000"},{"type":"Moto","brand":"KTM","model":"890 Duke R"},{"type":"Moto","brand":"KTM","model":"1290 Super Duke R"},{"type":"Moto","brand":"KTM","model":"1290 Super Adventure"},{"type":"Moto","brand":"BMW","model":"R1250GS"},{"type":"Moto","brand":"BMW","model":"R1300GS"},{"type":"Moto","brand":"BMW","model":"S1000RR"},{"type":"Moto","brand":"BMW","model":"S1000XR"},{"type":"Moto","brand":"Triumph","model":"Speed Triple"},{"type":"Moto","brand":"Triumph","model":"Tiger 1200"},{"type":"Moto","brand":"Ducati","model":"Multistrada V4"},{"type":"Moto","brand":"Ducati","model":"Panigale V2"},{"type":"Moto","brand":"Ducati","model":"Panigale V4"},{"type":"Moto","brand":"Ducati","model":"Streetfighter V4"},{"type":"Moto","brand":"Suzuki","model":"Hayabusa"},{"type":"Moto","brand":"Suzuki","model":"GSX-R600"},{"type":"Moto","brand":"Suzuki","model":"GSX-R1000"},{"type":"Auto","brand":"Deepal","model":"S05"},{"type":"Auto","brand":"Deepal","model":"S07"},{"type":"Auto","brand":"Deepal","model":"G318"},{"type":"Auto","brand":"Avatr","model":"07"},{"type":"Auto","brand":"Avatr","model":"11"},{"type":"Auto","brand":"Tank","model":"300"},{"type":"Auto","brand":"Tank","model":"500"},{"type":"Auto","brand":"BMW","model":"X1"},{"type":"Auto","brand":"BMW","model":"X1 Híbrido"},{"type":"Auto","brand":"BMW","model":"X2"},{"type":"Auto","brand":"BMW","model":"X2 M35i"},{"type":"Auto","brand":"BMW","model":"X3"},{"type":"Auto","brand":"BMW","model":"X3 Híbrido"},{"type":"Auto","brand":"BMW","model":"X5"},{"type":"Auto","brand":"BMW","model":"X6"},{"type":"Auto","brand":"BMW","model":"X7"},{"type":"Auto","brand":"BMW","model":"Serie 1"},{"type":"Auto","brand":"BMW","model":"M135"},{"type":"Auto","brand":"BMW","model":"Serie 3"},{"type":"Auto","brand":"BMW","model":"Serie 3 Híbrido"},{"type":"Auto","brand":"Audi","model":"A1"},{"type":"Auto","brand":"Audi","model":"RS e-tron GT"},{"type":"Moto","brand":"Voge","model":"900DS Adventure"},{"type":"Moto","brand":"Benelli","model":"Leoncino 800 Trail"},{"type":"Moto","brand":"Voge","model":"RR660S"},{"type":"Moto","brand":"Voge","model":"DS625X"},{"type":"Moto","brand":"Voge","model":"DS800X Rally"},{"type":"Moto","brand":"Voge","model":"DS900X"},{"type":"Moto","brand":"Fantic","model":"Caballero 500 Rally"},{"type":"Moto","brand":"Fantic","model":"Caballero 700 Scrambler"},{"type":"Moto","brand":"Fantic","model":"Caballero 700 Travel"},{"type":"Moto","brand":"Fantic","model":"XE 300 2T"},{"type":"Moto","brand":"Fantic","model":"XEF 250 4T"},{"type":"Moto","brand":"Fantic","model":"XEF 310 4T"}]$premium$::jsonb) as p(type text,brand text,model text)
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
commit;


-- ===== 004_maintenance_records.sql =====

-- Hito 2: historial de mantenciones, ligado a un vehículo del mismo usuario.
-- Ejecutar después de 001_freemium.sql y 003_catalog_chile.sql.
begin;

-- La clave compuesta impide relacionar una mantención con un vehículo ajeno.
create unique index if not exists vehicles_id_user_id_unique
  on public.vehicles (id, user_id);

create table if not exists public.maintenance_records (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null,
  category text not null check (category in ('inspection', 'service', 'repair')),
  performed_on date not null,
  mileage integer not null check (mileage between 0 and 999999),
  notes text not null check (char_length(btrim(notes)) between 5 and 1000),
  created_at timestamptz not null default now(),
  constraint maintenance_vehicle_owner_fk foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id) on delete cascade
);

create index if not exists maintenance_user_date_idx
  on public.maintenance_records (user_id, performed_on desc, id desc);
create index if not exists maintenance_vehicle_date_idx
  on public.maintenance_records (vehicle_id, performed_on desc);

alter table public.maintenance_records enable row level security;
drop policy if exists maintenance_select_own on public.maintenance_records;
drop policy if exists maintenance_insert_own on public.maintenance_records;
drop policy if exists maintenance_update_own on public.maintenance_records;
drop policy if exists maintenance_delete_own on public.maintenance_records;
create policy maintenance_select_own on public.maintenance_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy maintenance_insert_own on public.maintenance_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy maintenance_update_own on public.maintenance_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy maintenance_delete_own on public.maintenance_records
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.maintenance_records from anon;
grant select, insert, update, delete on public.maintenance_records to authenticated;

notify pgrst, 'reload schema';
commit;
