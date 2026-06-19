-- Sezione EVENTI (fiere) per i commerciali
-- Funnel: contattato → trattativa → firmato → organizzazione → eseguita; poi storico (attivo=false)

create table if not exists eventi (
  id serial primary key,
  richiesta text,
  contatti text,
  tipologia_fiera text,
  status text default 'contattato',          -- contattato|trattativa|firmato|organizzazione|eseguita
  prossima_fiera_data date,                   -- prossima fiera uguale → follow-up
  commerciale_assegnato text,
  citta text,
  note text,
  attivo boolean default true,               -- false = storico (evento chiuso)

  -- Sottosezione "Organizzazione" (compilata da status=organizzazione in poi)
  data_evento date,
  data_allestimento date,
  data_smontaggio date,
  orari_evento text,
  pause boolean,
  pause_quando text,
  permessi_status text,                       -- da_chiedere|richiesti|inviati
  acqua_fornita boolean,
  energia_comunicata boolean,                 -- prese shuko + 3.4kW
  spazio_comunicato boolean,                  -- 1.30x1.30x0.90 m
  scia_comunicata boolean,
  latte boolean,
  avena boolean,
  persone_previste int,
  catering boolean,
  catering_note text,
  baristi text,
  referente_nome text,
  referente_numero text,
  referente_mail text,
  note_organizzazione text,

  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_eventi_status on eventi(status);
create index if not exists idx_eventi_comm on eventi(commerciale_assegnato);
create index if not exists idx_eventi_attivo on eventi(attivo);
create index if not exists idx_eventi_data on eventi(data_evento);
