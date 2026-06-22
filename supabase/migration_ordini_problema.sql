-- Ordini: nota del problema segnalato dalla torrefazione (mostrata al locale,
-- che può correggere e re-inviare l'ordine; viene azzerata al re-invio).
alter table ordini
  add column if not exists problema_nota text;

notify pgrst, 'reload schema';
