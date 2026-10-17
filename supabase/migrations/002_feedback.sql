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
