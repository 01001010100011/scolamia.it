# Supabase Setup (ScolaMia.it)

## 1. Create project
- Create a Supabase project.
- Open SQL Editor and run `supabase/schema.sql`.
- If you migrated from old local/static agenda data, run `supabase/maintenance_fix_agenda_events.sql` once to normalize legacy events.
- Run `supabase/security_hardening_admin.sql` to enforce authenticated-only admin write access.
- Run `supabase/seed_presentation_article.sql` to create/update the "Presentazione Sito" article used by the Home hero button.
- Run `supabase/countdown_events.sql` to create/seed countdown events with public read and authenticated write policies.
- Run `supabase/admin_countdowns.sql` to create the new `countdowns` table, admin role mapping and RLS admin-only CRUD.

## 2. Create admin user
- In Authentication > Users, create an admin email/password user.
- In Authentication > Providers, disable public signups if desired.
- In SQL Editor, assign the user as admin (replace with real UID from Auth > Users):

```sql
insert into public.admin_users (user_id, role, active)
values ('00000000-0000-0000-0000-000000000000', 'admin', true)
on conflict (user_id) do update
set role = excluded.role,
    active = excluded.active,
    updated_at = now();
```

## 3. Configure frontend keys
Edit:
- `assets/js/supabase-config.js`

Set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 4. Deploy
Push changes to GitHub Pages repository.

## 5. Verify
- Open `admin.html`
- Login with Supabase admin credentials
- Create article/countdown/event
- Check sync from another browser/device
