-- ============================================================
--  Cafezal CRM — Integrazione CASSA TILBY (Fase 1: landing chiusure giornaliere)
--  Flusso: webhook Tilby `daily_closing` → N8N → Supabase (questa tabella).
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

-- 1) Mappatura negozio Cafezal ↔ identificativo shop di Tilby.
--    Nel payload Tilby manda il SUO id negozio: qui lo agganciamo ai nostri `negozi`.
--    Da popolare una volta sola (un id Tilby per ogni locale).
alter table public.negozi
  add column if not exists tilby_shop_id text unique;

-- 2) Landing delle chiusure giornaliere (1 riga per negozio per giorno).
--    `payload` = evento Tilby grezzo e integrale: è la SORGENTE DI VERITÀ.
--    Le colonne tipizzate sono una comodità per i report e vengono valorizzate
--    da N8N in fase di ingest; se sbagliamo a estrarre un campo si ricalcola
--    sempre da `payload`.
create table if not exists public.vendite_chiusure (
  id              bigserial primary key,
  tilby_shop_id   text not null,
  data_chiusura   date not null,
  event_type      text not null default 'daily_closing',
  incasso_totale  numeric,                  -- totale lordo della giornata
  n_scontrini     integer,
  pagamenti       jsonb,                     -- breakdown per mezzo di pagamento
  iva             jsonb,                     -- breakdown per aliquota IVA
  payload         jsonb not null,            -- evento Tilby grezzo (raw)
  received_at     timestamptz not null default now(),
  -- Idempotenza: i retry di Tilby (3x ogni 15 min finché non rispondi 200)
  -- fanno UPSERT su questa chiave, non righe duplicate.
  unique (tilby_shop_id, data_chiusura, event_type)
);

create index if not exists idx_vendite_chiusure_data
  on public.vendite_chiusure (data_chiusura);
create index if not exists idx_vendite_chiusure_shop
  on public.vendite_chiusure (tilby_shop_id);

-- 3) Vista comoda per report e dashboard: chiusure + nome negozio Cafezal.
--    LEFT JOIN così la chiusura di uno shop non ancora mappato resta visibile
--    (negozio_nome NULL) e ce ne accorgiamo subito.
create or replace view public.v_vendite_chiusure as
  select
    vc.id,
    vc.data_chiusura,
    vc.tilby_shop_id,
    n.id   as negozio_id,
    n.nome as negozio_nome,
    vc.incasso_totale,
    vc.n_scontrini,
    vc.pagamenti,
    vc.iva,
    vc.received_at
  from public.vendite_chiusure vc
  left join public.negozi n on n.tilby_shop_id = vc.tilby_shop_id;

-- 4) Sicurezza: dato finanziario → default-deny (coerente con la postura del CRM).
--    Il backend Express usa la SERVICE ROLE key (bypassa RLS) ed è l'unico
--    punto di lettura/scrittura. Con RLS attiva e nessuna policy, l'accesso
--    diretto con ANON key dal browser è negato.
alter table public.vendite_chiusure enable row level security;
