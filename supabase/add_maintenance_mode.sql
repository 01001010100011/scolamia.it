alter table public.site_settings
add column if not exists maintenance_mode boolean not null default false;
