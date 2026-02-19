-- Run this in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  excerpt text not null,
  content text not null,
  image_url text,
  image_path text,
  attachments jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  date date not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id int primary key,
  featured_article_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = 1)
);

insert into public.site_settings (id, featured_article_ids)
values (1, '{}')
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_articles_updated_at on public.articles;
create trigger trg_articles_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_agenda_events_updated_at on public.agenda_events;
create trigger trg_agenda_events_updated_at
before update on public.agenda_events
for each row
execute function public.set_updated_at();

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row
execute function public.set_updated_at();

alter table public.articles enable row level security;
alter table public.agenda_events enable row level security;
alter table public.site_settings enable row level security;

-- Public can read published content
drop policy if exists "public read published articles" on public.articles;
create policy "public read published articles"
on public.articles
for select
using (published = true);

drop policy if exists "public read agenda" on public.agenda_events;
create policy "public read agenda"
on public.agenda_events
for select
using (true);

drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings"
on public.site_settings
for select
using (true);

-- Authenticated users (admins) can manage all content
drop policy if exists "auth manage articles" on public.articles;
create policy "auth manage articles"
on public.articles
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "auth manage agenda" on public.agenda_events;
create policy "auth manage agenda"
on public.agenda_events
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "auth manage settings" on public.site_settings;
create policy "auth manage settings"
on public.site_settings
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Storage bucket for images and attachments
insert into storage.buckets (id, name, public)
values ('article-media', 'article-media', true)
on conflict (id) do nothing;

-- Public read storage
drop policy if exists "public read article media" on storage.objects;
create policy "public read article media"
on storage.objects
for select
using (bucket_id = 'article-media');

-- Authenticated manage storage
drop policy if exists "auth upload article media" on storage.objects;
create policy "auth upload article media"
on storage.objects
for insert
with check (bucket_id = 'article-media' and auth.role() = 'authenticated');

drop policy if exists "auth update article media" on storage.objects;
create policy "auth update article media"
on storage.objects
for update
using (bucket_id = 'article-media' and auth.role() = 'authenticated')
with check (bucket_id = 'article-media' and auth.role() = 'authenticated');

drop policy if exists "auth delete article media" on storage.objects;
create policy "auth delete article media"
on storage.objects
for delete
using (bucket_id = 'article-media' and auth.role() = 'authenticated');
