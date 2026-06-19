-- Clienti attivi: gestione rinnovo/scadenza + storico contratti
alter table clienti_attivi
  add column if not exists esito_contratto text,      -- 'rinnovato' | 'non_rinnovato'
  add column if not exists feedback_chiusura text;     -- motivo + note del mancato rinnovo

create index if not exists idx_clienti_attivi_attivo on clienti_attivi(attivo);
