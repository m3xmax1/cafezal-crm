-- Numero/riferimento fattura (inserito dalla finance al momento del fatturato).
alter table ordini add column if not exists numero_fattura text;
alter table eventi add column if not exists numero_fattura text;

notify pgrst, 'reload schema';
