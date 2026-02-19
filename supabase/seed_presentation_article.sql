-- Seed article: Presentazione Sito
-- Run in Supabase SQL Editor.

insert into public.articles (
  id,
  title,
  category,
  excerpt,
  content,
  published,
  attachments,
  created_at,
  updated_at
) values (
  '9d056b37-cacf-4c49-879e-d312fb4ef31f',
  'Presentazione Sito',
  'Comunicazioni',
  'Benvenuti su ScolaMia.it, il giornale indipendente del liceo L. Rocci.',
  E'Benvenuti su ScolaMia.it.\n\nQuesto spazio nasce con un obiettivo semplice: raccontare la vita scolastica dal punto di vista degli studenti.\n\nQui troverai articoli, approfondimenti, appuntamenti e iniziative del liceo L. Rocci.\n\nIl progetto e'' stato creato dagli studenti per gli studenti, con spirito indipendente e collaborativo.',
  true,
  '[]'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set
  title = excluded.title,
  category = excluded.category,
  excerpt = excluded.excerpt,
  content = excluded.content,
  published = true,
  updated_at = now();
