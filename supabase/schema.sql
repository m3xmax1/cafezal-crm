-- ============================================================
--  Cafezal CRM — Database schema
--  Run this in the Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type commerciale_enum as enum ('Laura', 'Massimo', 'Gabriele');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fase_pipeline_enum as enum ('Lead', 'Contattato', 'In trattativa', 'Proposta', 'Chiuso', 'K.O.');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sensibility_enum as enum ('low', 'mid', 'high');
exception when duplicate_object then null; end $$;

-- ---------- Table ----------
create table if not exists public.opportunities (
  id                   uuid primary key default gen_random_uuid(),
  azienda              text not null,
  commerciale_assegnato commerciale_enum,
  fase_pipeline        fase_pipeline_enum not null default 'Lead',
  macchina             boolean not null default false,
  quantita_minima_kg   numeric,
  sensibility          sensibility_enum not null default 'mid',
  note                 text,
  data_scadenza        date,
  data_creazione       timestamptz not null default now(),
  data_ultima_modifica timestamptz not null default now()
);

-- ---------- Auto-update data_ultima_modifica on every UPDATE ----------
create or replace function public.set_data_ultima_modifica()
returns trigger as $$
begin
  new.data_ultima_modifica = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_opportunities_updated on public.opportunities;
create trigger trg_opportunities_updated
  before update on public.opportunities
  for each row execute function public.set_data_ultima_modifica();

-- ---------- Indexes (faster filtering / reminders) ----------
create index if not exists idx_opportunities_commerciale on public.opportunities (commerciale_assegnato);
create index if not exists idx_opportunities_fase        on public.opportunities (fase_pipeline);
create index if not exists idx_opportunities_scadenza    on public.opportunities (data_scadenza);
