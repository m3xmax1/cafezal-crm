-- Clienti attivi B2B (contratti) — Fase 5
-- Crocevia tra CRM (opportunities) e operatività; con account manager + reminder.

create table if not exists clienti_attivi (
  id serial primary key,
  n int,
  cliente text,                       -- nome breve / con cui è conosciuto
  rag_sociale text,
  piva text,
  opportunity_id uuid references opportunities(id) on delete set null,
  account_manager text,               -- NEW: assegnabile nel CRM (commerciale)
  macchinari text,
  valore_attrezzatura numeric,
  comodato boolean,
  deposito numeric,
  rata_noleggio numeric,
  firma date,
  durata_mesi int,
  scadenza_contratto date,            -- per reminder 3 mesi prima
  rinnovo text,
  spese_trasporto text,
  fornitura boolean,
  prezzo_bloccato boolean,
  prezzo_caffe text,
  ordine_minimo_kg numeric,           -- per reminder quantità mensile
  penale_ordine text,
  assistenza_inclusa boolean,
  numero_interventi text,
  costo_uscita text,
  esclusiva boolean,
  penale_esclusiva numeric,
  pagamento text,
  tags text[] default '{}',
  note text,
  attivo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clienti_attivi_scadenza on clienti_attivi(scadenza_contratto);
create index if not exists idx_clienti_attivi_am on clienti_attivi(account_manager);
create index if not exists idx_clienti_attivi_opp on clienti_attivi(opportunity_id);
