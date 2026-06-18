-- ============================================================
--  Cafezal CRM — Modulo TORREFAZIONE (Fase 1: catalogo, magazzino, negozi, ordini)
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

-- Negozi retail
create table if not exists public.negozi (
  id         serial primary key,
  nome       text not null unique,
  email      text,
  attivo     boolean not null default true,
  speciale   boolean not null default false,  -- Eventi, Samples (si incrociano coi sales)
  created_at timestamptz not null default now()
);

-- Catalogo prodotti + magazzino (giacenza in kg)
create table if not exists public.prodotti (
  id          serial primary key,
  nome        text not null,
  categoria   text,
  giacenza_kg numeric not null default 0,
  attivo      boolean not null default true,
  descrizione text,
  foto_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Formati per prodotto (250g / 1kg / 10 capsule / 8 buste …): prezzo + peso scalato
create table if not exists public.prodotti_formati (
  id          serial primary key,
  prodotto_id integer not null references public.prodotti(id) on delete cascade,
  formato     text not null,
  prezzo      numeric,
  peso_kg     numeric not null default 0,
  attivo      boolean not null default true
);
create index if not exists idx_formati_prodotto on public.prodotti_formati (prodotto_id);

-- Ordini (retail dagli store + b2b dal CRM)
create table if not exists public.ordini (
  id                 serial primary key,
  origine            text not null default 'retail',          -- 'retail' | 'b2b'
  negozio_id         integer references public.negozi(id),
  opportunity_id     uuid references public.opportunities(id),
  cliente_nome       text,
  persona            text,
  email              text,
  telefono           text,
  indirizzo_consegna text,
  data_ordine        timestamptz not null default now(),
  data_consegna      date,
  stato              text not null default 'ricevuto',        -- ricevuto|in_lavorazione|pronto|spedito|problema|archiviato
  ddt                text,
  tracking           text,
  note               text,
  totale             numeric,
  peso_totale_kg     numeric,
  created_by         text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_ordini_negozio on public.ordini (negozio_id);
create index if not exists idx_ordini_stato   on public.ordini (stato);
create index if not exists idx_ordini_data    on public.ordini (data_ordine);

-- Righe ordine
create table if not exists public.ordini_righe (
  id              serial primary key,
  ordine_id       integer not null references public.ordini(id) on delete cascade,
  prodotto_id     integer references public.prodotti(id),
  nome_caffe      text,
  formato         text,
  quantita        numeric not null default 0,
  prezzo_unitario numeric,
  peso_kg         numeric,
  totale          numeric
);
create index if not exists idx_righe_ordine on public.ordini_righe (ordine_id);
