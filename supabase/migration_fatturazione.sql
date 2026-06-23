-- ════════════════════════════════════════════════════════════════════════
-- Cafezal CRM — fatturazione + ruolo finance + data consegna prevista
-- Idempotente. I dati fiscali sono anagrafici (lead/cliente) e vengono
-- "congelati" sull'ordine al momento dell'invio.
-- ════════════════════════════════════════════════════════════════════════

-- 1) LEAD (opportunities): dati fiscali (azienda = Alias; aggiungo Ragione sociale & co.)
alter table opportunities
  add column if not exists ragione_sociale       text,
  add column if not exists piva_cf               text,
  add column if not exists pec                   text,
  add column if not exists sdi                   text,
  add column if not exists indirizzo_sede_legale text,
  add column if not exists indirizzo_spedizione  text;

-- 2) CLIENTI ATTIVI (cliente = Alias, rag_sociale = Ragione sociale, piva = P.IVA/C.F.)
alter table clienti_attivi
  add column if not exists email                 text,
  add column if not exists telefono              text,
  add column if not exists pec                   text,
  add column if not exists sdi                   text,
  add column if not exists indirizzo_sede_legale text,
  add column if not exists indirizzo_spedizione  text;

-- 3) ORDINI: data consegna prevista (torrefazione), flag fatturato (finance),
--    snapshot fiscale per la fattura. (indirizzo_consegna = indirizzo spedizione)
alter table ordini
  add column if not exists data_consegna_prevista date,
  add column if not exists fatturato              boolean not null default false,
  add column if not exists fatturato_at           timestamptz,
  add column if not exists ragione_sociale        text,
  add column if not exists piva_cf                text,
  add column if not exists pec                    text,
  add column if not exists sdi                    text,
  add column if not exists indirizzo_sede_legale  text;

-- 4) EVENTI: dati per fatturare + voci + prezzo finale (citta = luogo evento)
alter table eventi
  add column if not exists ragione_sociale       text,
  add column if not exists alias                 text,
  add column if not exists piva_cf               text,
  add column if not exists indirizzo_sede_legale text,
  add column if not exists email                 text,
  add column if not exists telefono              text,
  add column if not exists voci_fatturazione     jsonb default '[]'::jsonb,
  add column if not exists prezzo_evento         numeric;

notify pgrst, 'reload schema';
