-- ============================================================
--  Cafezal CRM — Migrazione: CAMPIONATURE + CADENZA RIORDINI
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

-- 1) Campionature: campioni di caffè inviati a un lead + esito di conversione
create table if not exists public.samples (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  prodotto       text,
  quantita       text,
  data_invio     date not null default current_date,
  esito          text not null default 'in_attesa',  -- in_attesa | convertito | non_convertito
  commerciale    text,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_samples_opp   on public.samples (opportunity_id);
create index if not exists idx_samples_esito on public.samples (esito);

-- 2) Cadenza riordini: per i clienti acquisiti, ogni quanti giorni riordinano
--    e quando è atteso il prossimo riordino
alter table public.opportunities
  add column if not exists cadenza_riordino_giorni integer,
  add column if not exists prossimo_riordino        date;

create index if not exists idx_opp_riordino on public.opportunities (prossimo_riordino);
