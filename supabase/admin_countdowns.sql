-- Admin + Countdowns migration for ScolaMia.it
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1) Admin mapping table (DB-level authorization)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
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

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
before update on public.admin_users
for each row
execute function public.set_updated_at();

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.role = 'admin'
      and au.active = true
  );
$$;

-- 2) Countdowns table (new source of truth)
create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  target_at timestamptz not null,
  is_featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists countdowns_target_at_idx on public.countdowns (target_at asc);
create index if not exists countdowns_active_target_idx on public.countdowns (active, target_at asc);

-- at most one active featured countdown at a time
create unique index if not exists countdowns_single_active_featured_idx
on public.countdowns ((1))
where is_featured = true and active = true;

drop trigger if exists trg_countdowns_updated_at on public.countdowns;
create trigger trg_countdowns_updated_at
before update on public.countdowns
for each row
execute function public.set_updated_at();

-- 3) Migrate data from legacy school_events if present
-- keeps existing countdowns by slug and updates them.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'school_events'
  ) then
    insert into public.countdowns (slug, title, target_at, is_featured, active, created_at, updated_at)
    select
      case
        when coalesce(se.slug, '') <> '' then se.slug
        else lower(regexp_replace(se.title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || to_char(se.target_at, 'YYYYMMDDHH24MI')
      end as slug,
      se.title,
      se.target_at,
      coalesce(se.featured, false) as is_featured,
      coalesce(se.active, true) as active,
      coalesce(se.created_at, now()) as created_at,
      coalesce(se.updated_at, now()) as updated_at
    from public.school_events se
    where coalesce(se.slug, '') not like 'fine-%'
    on conflict (slug) do update
      set title = excluded.title,
          target_at = excluded.target_at,
          is_featured = excluded.is_featured,
          active = excluded.active,
          updated_at = now();
  end if;
end $$;

-- normalize "single featured" after migration: keep nearest featured, unset others
with featured_rows as (
  select id,
         row_number() over (order by target_at asc, created_at asc) as rn
  from public.countdowns
  where is_featured = true and active = true
)
update public.countdowns c
set is_featured = false,
    updated_at = now()
from featured_rows f
where c.id = f.id
  and f.rn > 1;

-- 4) RLS policies
alter table public.admin_users enable row level security;
alter table public.countdowns enable row level security;

-- admin_users: user can read only own row
-- writes should be done via SQL editor/service role.
drop policy if exists "read own admin mapping" on public.admin_users;
create policy "read own admin mapping"
on public.admin_users
for select
using (auth.uid() = user_id);

-- public read for active countdowns (site frontend)
drop policy if exists "public read active countdowns" on public.countdowns;
create policy "public read active countdowns"
on public.countdowns
for select
to anon, authenticated
using (active = true);

-- admin can read all rows (including inactive)
drop policy if exists "admin read all countdowns" on public.countdowns;
create policy "admin read all countdowns"
on public.countdowns
for select
to authenticated
using (public.is_admin_user());

-- admin write only
drop policy if exists "admin insert countdowns" on public.countdowns;
create policy "admin insert countdowns"
on public.countdowns
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "admin update countdowns" on public.countdowns;
create policy "admin update countdowns"
on public.countdowns
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "admin delete countdowns" on public.countdowns;
create policy "admin delete countdowns"
on public.countdowns
for delete
to authenticated
using (public.is_admin_user());
