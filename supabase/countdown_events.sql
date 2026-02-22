-- Countdown events table + RLS + seed
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  target_at timestamptz not null,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_school_events_updated_at on public.school_events;
create trigger trg_school_events_updated_at
before update on public.school_events
for each row
execute function public.set_updated_at();

alter table public.school_events enable row level security;

drop policy if exists "public read school_events" on public.school_events;
create policy "public read school_events"
on public.school_events
for select
using (active = true);

drop policy if exists "auth manage school_events" on public.school_events;
create policy "auth manage school_events"
on public.school_events
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

insert into public.school_events (slug, title, target_at, featured, active)
values
  ('inizio-lezioni-2025', 'Inizio lezioni', '2025-09-15T00:00:00+02:00', false, true),
  ('immacolata-2025', 'Immacolata Concezione', '2025-12-08T00:00:00+01:00', false, true),
  ('inizio-vacanze-natale-2025', 'Inizio vacanze di Natale', '2025-12-22T00:00:00+01:00', false, true),
  ('fine-vacanze-natale-2026', 'Fine vacanze di Natale', '2026-01-06T23:59:59+01:00', false, true),
  ('inizio-vacanze-pasquali-2026', 'Inizio vacanze pasquali', '2026-04-02T00:00:00+02:00', false, true),
  ('fine-vacanze-pasquali-2026', 'Fine vacanze pasquali', '2026-04-07T23:59:59+02:00', false, true),
  ('festa-lavoro-2026', 'Festa del Lavoro', '2026-05-01T00:00:00+02:00', false, true),
  ('ponte-1-giugno-2026', '1 giugno 2026', '2026-06-01T00:00:00+02:00', false, true),
  ('festa-repubblica-2026', 'Festa della Repubblica', '2026-06-02T00:00:00+02:00', false, true),
  ('termine-lezioni', 'Fine della scuola', '2026-06-08T00:00:00+02:00', true, true)
on conflict (slug) do update
set
  title = excluded.title,
  target_at = excluded.target_at,
  featured = excluded.featured,
  active = excluded.active,
  updated_at = now();
