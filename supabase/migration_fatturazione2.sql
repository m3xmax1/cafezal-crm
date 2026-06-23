-- ════════════════════════════════════════════════════════════════════════
-- Cafezal CRM — fatturazione 2: range data evento + eventi fatturabili
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- Eventi: data fine (eventi su più giorni) + flag fatturato (finance)
alter table eventi
  add column if not exists data_evento_fine date,
  add column if not exists fatturato        boolean not null default false,
  add column if not exists fatturato_at     timestamptz;

notify pgrst, 'reload schema';
