-- Eventi v2: prossimo follow-up (in agenda) + azioni fatte (timeline)
alter table eventi
  add column if not exists prossima_azione text,
  add column if not exists data_prossimo_followup date;

create table if not exists eventi_attivita (
  id serial primary key,
  evento_id int references eventi(id) on delete cascade,
  tipo text default 'nota',          -- chiamata|whatsapp|instagram|email|meeting|nota|altro
  data date,
  descrizione text,
  commerciale text,
  created_at timestamptz default now()
);
create index if not exists idx_eventi_attivita_ev on eventi_attivita(evento_id);

notify pgrst, 'reload schema';
