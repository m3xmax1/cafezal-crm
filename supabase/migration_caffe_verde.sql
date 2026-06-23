-- ════════════════════════════════════════════════════════════════════════
-- Cafezal CRM — Caffè verde: anagrafica caffè + analisi DiFluid + cupping SCA
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.caffe_verde (
  id          serial primary key,
  nome        text not null,
  provenienza text,
  tipologia   text,
  processo    text,
  costo       numeric,
  produttore  text,                 -- produttore / importatore
  note        text,
  attivo      boolean not null default true,
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz
);

-- Analisi DiFluid (fisiche)
create table if not exists public.caffe_difluid (
  id             serial primary key,
  caffe_id       int references caffe_verde(id) on delete cascade,
  data           date,              -- data rilevazione
  prossima_data  date,              -- prossima rilevazione (va in agenda)
  water_activity numeric,           -- attività dell'acqua (a_w)
  moisture       numeric,           -- umidità %
  true_density   numeric,           -- densità reale g/L
  mesh_size      text,              -- setaccio / dimensione chicco
  note           text,
  created_by     text,
  created_at     timestamptz default now()
);
create index if not exists idx_caffe_difluid_caffe on caffe_difluid(caffe_id);

-- Analisi cupping (SCA)
create table if not exists public.caffe_cupping (
  id           serial primary key,
  caffe_id     int references caffe_verde(id) on delete cascade,
  data         date,
  fragranza    numeric,   -- Fragrance/Aroma
  flavor       numeric,
  aftertaste   numeric,
  acidity      numeric,
  body         numeric,
  balance      numeric,
  uniformity   numeric,
  clean_cup    numeric,
  sweetness    numeric,
  overall      numeric,
  difetti      numeric,   -- defects (sottratti)
  punteggio    numeric,   -- totale /100
  assaggiatore text,
  note         text,
  created_by   text,
  created_at   timestamptz default now()
);
create index if not exists idx_caffe_cupping_caffe on caffe_cupping(caffe_id);

notify pgrst, 'reload schema';
