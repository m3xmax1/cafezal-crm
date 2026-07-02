-- ============================================================
--  Cafezal CRM — CASSA TILBY (Fase 0.5: inbox eventi grezzi)
--  L'endpoint pubblico (Supabase Edge Function `tilby-daily-closing`) scrive
--  QUI ogni webhook Tilby, integro e senza vincoli: cattura a prova di errore.
--  La proiezione pulita verso `vendite_chiusure` la facciamo dopo, in SQL,
--  quando conosciamo i nomi reali dei campi del payload.
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

create table if not exists public.tilby_eventi (
  id            bigserial primary key,
  event_type    text,                      -- best-effort (header/payload); da confermare sul reale
  tilby_shop_id text,                       -- best-effort; può essere NULL in fase di cattura
  headers       jsonb,                      -- header HTTP in ingresso (per capire come arriva il token)
  payload       jsonb not null,             -- corpo grezzo del webhook (integro = sorgente di verità)
  received_at   timestamptz not null default now(),
  processed_at  timestamptz                 -- valorizzato quando proiettato in vendite_chiusure
);

create index if not exists idx_tilby_eventi_received
  on public.tilby_eventi (received_at);
create index if not exists idx_tilby_eventi_unprocessed
  on public.tilby_eventi (received_at) where processed_at is null;

-- Default-deny come il resto dei dati finanziari: accede solo il service role
-- (backend Express ed Edge Function). RLS attiva + nessuna policy = niente anon.
alter table public.tilby_eventi enable row level security;
