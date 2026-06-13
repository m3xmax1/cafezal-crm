-- ============================================================
--  Cafezal CRM — Migrazione: PIPELINE GUIDATA
--  Aggiunge: dati cliente, prossima azione + data follow-up,
--  e una timeline di attività (chiamate / email / meeting / note).
--
--  ▶ Esegui in: Supabase → SQL Editor → New query → incolla → Run
--    È idempotente: puoi rilanciarla senza danni.
-- ============================================================

-- 1) Dati cliente + "prossima azione" e data del prossimo follow-up sul lead
alter table public.opportunities
  add column if not exists referente              text,
  add column if not exists ruolo_referente        text,
  add column if not exists telefono               text,
  add column if not exists email                  text,
  add column if not exists sito_web               text,
  add column if not exists citta                  text,
  add column if not exists prossima_azione         text,
  add column if not exists data_prossimo_followup date;

create index if not exists idx_opp_followup
  on public.opportunities (data_prossimo_followup);

-- 2) Timeline attività (storico interazioni + appuntamenti programmati)
create table if not exists public.activities (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  commerciale    text,
  tipo           text not null default 'nota',   -- chiamata | email | meeting | nota | altro
  descrizione    text,
  data           date not null default current_date,
  created_at     timestamptz not null default now()
);

create index if not exists idx_activities_opp  on public.activities (opportunity_id);
create index if not exists idx_activities_data on public.activities (data);

-- 3) Loggare un'attività aggiorna "ultima modifica" del lead,
--    così il report mensile conteggia i lead realmente lavorati.
create or replace function public.touch_opportunity_on_activity()
returns trigger as $$
begin
  update public.opportunities
     set data_ultima_modifica = now()
   where id = new.opportunity_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_activity_touch on public.activities;
create trigger trg_activity_touch
  after insert on public.activities
  for each row execute function public.touch_opportunity_on_activity();
