-- ============================================================
--  Cafezal CRM — SICUREZZA: abilita RLS su TUTTE le tabelle public
--  Perché: la anon key è PUBBLICA (inclusa nel bundle del frontend). Con RLS
--  disattivata, chiunque abbia l'URL del progetto può leggere/scrivere le
--  tabelle via l'API dati Supabase (/rest/v1/…), SCAVALCANDO il backend Express.
--  Fix: RLS ON senza policy = default-deny per i ruoli anon/authenticated.
--  Il backend usa la SERVICE ROLE key (bypassa RLS) → non si rompe nulla.
--  Verificato: il client non fa mai `supabase.from()` (legge solo via /api).
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

-- 1) DIAGNOSI — quali tabelle public hanno RLS spenta? (rowsecurity = false)
--    Lancia da sola per vedere lo scope prima di applicare:
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by rowsecurity, tablename;

-- 2) FIX — abilita RLS su tutte le tabelle public che non ce l'hanno.
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity = false
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    raise notice 'RLS abilitata su public.%', r.tablename;
  end loop;
end $$;

-- 3) VERIFICA — ora devono risultare tutte a true:
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by rowsecurity, tablename;

-- 4) VISTE — una vista "definer" può scavalcare la RLS della tabella sottostante.
--    security_invoker = on la fa rispettare la RLS di chi interroga (PG15+).
--    Il backend (service_role) continua a leggere tutto; anon/authenticated no.
alter view public.v_vendite_chiusure set (security_invoker = on);
-- Alternativa se la tua versione Postgres non supporta security_invoker:
-- revoke all on public.v_vendite_chiusure from anon, authenticated;
