-- ============================================================
--  Cafezal CRM — Sample data (optional)
--  Run AFTER schema.sql to populate the board with demo opportunities.
--  Dates are relative to today so reminders have something to send.
-- ============================================================

insert into public.opportunities
  (azienda, commerciale_assegnato, fase_pipeline, macchina, quantita_minima_kg, sensibility, note, data_scadenza)
values
  ('Bar Centrale',        'Laura',    'Lead',          true,  20,  'mid',  'Interessati alla miscela Arabica.',            current_date + 2),
  ('Hotel Belvedere',     'Laura',    'In trattativa', true,  50,  'high', 'Richiesta proposta entro fine settimana.',     current_date + 1),
  ('Pasticceria Dolce',   'Laura',    'Proposta',      false, 15,  'mid',  'In attesa di firma contratto.',                current_date + 5),
  ('Ristorante Da Mario', 'Massimo',  'Contattato',    false, 30,  'low',  'Primo contatto telefonico fatto.',             current_date + 3),
  ('Caffetteria Sole',    'Massimo',  'In trattativa', true,  40,  'high', 'Vuole una demo della macchina.',               current_date),
  ('Panificio Aurora',    'Massimo',  'Chiuso',        true,  25,  'mid',  'Contratto firmato 12 mesi.',                   null),
  ('Bistrot Verde',       'Gabriele', 'Lead',          false, 10,  'low',  'Lead da fiera di settore.',                    current_date + 6),
  ('Osteria del Porto',   'Gabriele', 'Proposta',      true,  60,  'high', 'Proposta inviata, follow-up urgente.',         current_date + 2),
  ('Gelateria Polo Nord', 'Gabriele', 'K.O.',          false, 5,   'low',  'Ha scelto un concorrente.',                    null);
