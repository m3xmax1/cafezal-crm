-- ============================================================
--  Cafezal CRM — Row Level Security (OPTIONAL hardening)
-- ============================================================
--  The Express backend talks to Supabase with the SERVICE ROLE key,
--  which BYPASSES RLS. Authorization (who sees what) is enforced in the
--  API layer (server/src/services/opportunities.service.js).
--
--  These policies are defense-in-depth: they make direct access with the
--  ANON key (e.g. from the browser) safe too, in case you later let the
--  frontend query Supabase directly. Running this file is OPTIONAL.
--
--  Identity → role mapping is based on the logged-in user's email.
-- ============================================================

-- Map the JWT email to a commerciale_enum value (NULL if not a commercial).
create or replace function public.current_commerciale()
returns commerciale_enum
language sql stable as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when 'laura@cafezal.com'    then 'Laura'::commerciale_enum
    when 'massimo@cafezal.com'  then 'Massimo'::commerciale_enum
    when 'gabriele@cafezal.com' then 'Gabriele'::commerciale_enum
    else null
  end;
$$;

-- Admin = users whose JWT carries app_metadata.role = 'admin'
-- (set it from the backend or the dashboard when you create the admin user).
create or replace function public.is_admin()
returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

alter table public.opportunities enable row level security;

drop policy if exists "read own or admin" on public.opportunities;
create policy "read own or admin" on public.opportunities
  for select to authenticated
  using (public.is_admin() or commerciale_assegnato = public.current_commerciale());

drop policy if exists "insert own or admin" on public.opportunities;
create policy "insert own or admin" on public.opportunities
  for insert to authenticated
  with check (public.is_admin() or commerciale_assegnato = public.current_commerciale() or commerciale_assegnato is null);

drop policy if exists "update own or admin" on public.opportunities;
create policy "update own or admin" on public.opportunities
  for update to authenticated
  using (public.is_admin() or commerciale_assegnato = public.current_commerciale());

drop policy if exists "delete own or admin" on public.opportunities;
create policy "delete own or admin" on public.opportunities
  for delete to authenticated
  using (public.is_admin() or commerciale_assegnato = public.current_commerciale());
