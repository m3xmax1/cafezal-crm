-- ════════════════════════════════════════════════════════════════════════
-- Cafezal CRM — batch 22/06
--   • Eventi: timeline "azioni fatte" + prossimo follow-up + motivo K.O.
--   • Clienti attivi: consumo mensile inserito a mano (sostituisce il link al lead)
-- Idempotente: si può lanciare anche se parti sono già state applicate.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Eventi: azioni fatte (timeline), prossimo follow-up (va in agenda) e motivo K.O.
alter table eventi
  add column if not exists prossima_azione text,
  add column if not exists data_prossimo_followup date,
  add column if not exists motivo_ko text;

create table if not exists eventi_attivita (
  id serial primary key,
  evento_id int references eventi(id) on delete cascade,
  tipo text default 'nota',
  data date,
  descrizione text,
  commerciale text,
  created_at timestamptz default now()
);
create index if not exists idx_eventi_attivita_ev on eventi_attivita(evento_id);

-- 2) Clienti attivi: consumo mensile manuale, es. [{"mese":"2026-01","kg":12}, ...]
alter table clienti_attivi
  add column if not exists consumi jsonb default '[]'::jsonb;

-- Ricarica lo schema cache di PostgREST (necessario per vedere subito le nuove colonne)
notify pgrst, 'reload schema';
