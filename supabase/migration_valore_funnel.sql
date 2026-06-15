-- ============================================================
--  Cafezal CRM — Migrazione: VALORE €, MOTIVO Vinto/Perso, STORICO FASI
--  ▶ Supabase → SQL Editor → New query → incolla → Run  (idempotente)
-- ============================================================

-- 1) Valore stimato (€) e motivo di chiusura (Vinto / Perso) sul lead
alter table public.opportunities
  add column if not exists valore_stimato  numeric,
  add column if not exists motivo_chiusura text;

-- 2) Storico dei cambi di fase → tempo medio per fase e conversione a imbuto
create table if not exists public.phase_changes (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  da_fase        text,
  a_fase         text not null,
  commerciale    text,
  changed_at     timestamptz not null default now()
);

create index if not exists idx_phase_changes_opp on public.phase_changes (opportunity_id);
create index if not exists idx_phase_changes_at  on public.phase_changes (changed_at);
