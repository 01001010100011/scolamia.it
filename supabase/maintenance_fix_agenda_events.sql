-- Maintenance script: fix legacy agenda rows that can become "invisible"
-- Run once in Supabase SQL Editor.

do $$
declare
  date_type text;
begin
  select c.data_type
  into date_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'agenda_events'
    and c.column_name = 'date';

  if date_type is null then
    raise notice 'Table public.agenda_events or date column not found.';
    return;
  end if;

  if date_type <> 'date' then
    alter table public.agenda_events
      add column if not exists date_tmp date;

    update public.agenda_events
    set date_tmp = case
      when trim("date"::text) ~ '^\d{4}-\d{2}-\d{2}$' then ("date"::text)::date
      when trim("date"::text) ~ '^\d{2}/\d{2}/\d{4}$' then to_date("date"::text, 'DD/MM/YYYY')
      when trim("date"::text) ~ '^\d{2}-\d{2}-\d{4}$' then to_date("date"::text, 'DD-MM-YYYY')
      when trim("date"::text) ~ '^\d{4}-\d{2}-\d{2}T' then left("date"::text, 10)::date
      else null
    end;

    -- Remove only rows with malformed non-convertible dates.
    delete from public.agenda_events
    where date_tmp is null;

    alter table public.agenda_events drop column "date";
    alter table public.agenda_events rename column date_tmp to "date";
    alter table public.agenda_events alter column "date" set not null;
  end if;

  -- Remove hard-corrupted rows with missing required content.
  delete from public.agenda_events
  where coalesce(trim(title), '') = ''
     or coalesce(trim(category), '') = ''
     or coalesce(trim(description), '') = '';
end $$;
