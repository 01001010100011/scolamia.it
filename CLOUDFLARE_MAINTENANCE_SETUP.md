# Cloudflare maintenance worker setup

Questo progetto include un Worker pronto per restituire un vero `503 Service Unavailable`
quando la `maintenance_mode` salvata in Supabase e` attiva.

## File

- `cloudflare/maintenance-worker.js`
- `cloudflare/wrangler.toml`

## Variabili da configurare nel Worker

Nel pannello Cloudflare Worker aggiungi:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SITE_ORIGIN`

Valori:

- `SUPABASE_URL=https://kdydrxielrufgdutcoor.supabase.co`
- `SUPABASE_ANON_KEY=<la publishable key gia usata dal sito>`
- `SITE_ORIGIN=https://scola-mia.com`

## Rotta Cloudflare

Assegna il Worker a:

- `scola-mia.com/*`

## Comportamento

Quando `public.site_settings.maintenance_mode = true`:

- lascia passare:
  - `/admin/`
  - `/admin-article-editor/`
  - `/manutenzione/`
  - `/sitemap.xml`
  - `/robots.txt`
  - `/canale-whatsapp/`
  - tutti gli asset statici
- per tutto il resto:
  - restituisce la pagina `/manutenzione/`
  - con status `503`
  - con `Retry-After: 3600`

Quando `maintenance_mode = false` il traffico passa normalmente all'origine.

## Test rapido

Con manutenzione attiva:

```bash
curl -I https://scola-mia.com/
curl -I https://scola-mia.com/agenda/
curl -I https://scola-mia.com/articoli/presentazione-sito/
curl -I https://scola-mia.com/manutenzione/
curl -I https://scola-mia.com/admin/
curl -I https://scola-mia.com/sitemap.xml
```

Atteso:

- `/`, `/agenda/`, `/articoli/...` -> `503`
- `/manutenzione/` -> `200`
- `/admin/` -> `200`
- `/sitemap.xml` -> `200`
