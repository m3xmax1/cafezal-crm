-- ============================================================
--  Cafezal CRM — CASSA TILBY: aggregato giornaliero da /v2/sales
--  Riempita da un job schedulato nel backend: pull delle vendite CHIUSE per
--  giorno/locale → aggregazione → upsert qui. (daily_closings non è generato
--  da Tilby per questi shop, quindi usiamo le vendite: vedi memoria progetto.)
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

create table if not exists public.vendite_giornaliere (
  id             bigserial primary key,
  negozio_id     integer not null references public.negozi(id),
  data           date not null,                 -- giorno da closed_at (fuso Europe/Rome)
  incasso_lordo  numeric not null default 0,    -- somma final_amount (IVA inclusa)
  incasso_netto  numeric not null default 0,    -- somma final_net_amount
  n_scontrini    integer not null default 0,    -- n. vendite chiuse
  pagamenti      jsonb,                          -- { "Contanti": 123.45, "Carte": 67.80, … }
  iva            jsonb,                          -- { "10": {"imponibile":.., "imposta":..}, "22": {…} }
  scloby_shop_id text,                           -- id shop Tilby (dal campo delle vendite), per riferimento
  updated_at     timestamptz not null default now(),
  -- un solo aggregato per locale/giorno: il pull ricalcola e fa upsert
  unique (negozio_id, data)
);

create index if not exists idx_vendite_giornaliere_data
  on public.vendite_giornaliere (data);

-- Vista comoda per dashboard/report: aggregato + nome locale.
create or replace view public.v_vendite_giornaliere as
  select vg.*, n.nome as negozio_nome
  from public.vendite_giornaliere vg
  join public.negozi n on n.id = vg.negozio_id;
alter view public.v_vendite_giornaliere set (security_invoker = on);

-- Dato finanziario → default-deny (come il resto). Legge solo il backend (service role).
alter table public.vendite_giornaliere enable row level security;
