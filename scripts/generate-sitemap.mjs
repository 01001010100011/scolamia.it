import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUPABASE_CONFIG_PATH = path.join(ROOT, "assets", "js", "supabase-config.js");

const DOMAIN_FALLBACK = "scola-mia.com";
const INDEX_PRIORITY = "1.0";
const DEFAULT_PRIORITY = "0.7";
const INDEX_CHANGEFREQ = "daily";
const DEFAULT_CHANGEFREQ = "weekly";

const PAGE_RULES = {
  "archivio": { changefreq: "daily", priority: "0.9" },
  "article": { changefreq: "daily", priority: "0.8" },
  "countdown": { changefreq: "daily", priority: "0.8" },
  "agenda": { changefreq: "daily", priority: "0.8" },
  "contatti": { changefreq: "weekly", priority: "0.7" },
  "turni-ricreazione": { changefreq: "weekly", priority: "0.7" },
  "ricerca": { changefreq: "weekly", priority: "0.6" }
};

function slugifyText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildUniqueSlugMap(items, getId, getTitle) {
  const counts = new Map();
  const out = new Map();
  const sorted = [...items].sort((a, b) => {
    const aTime = new Date(a?.created_at || a?.updated_at || 0).getTime() || 0;
    const bTime = new Date(b?.created_at || b?.updated_at || 0).getTime() || 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(getId(a) || "").localeCompare(String(getId(b) || ""));
  });

  for (const item of sorted) {
    const id = String(getId(item) || "").trim();
    if (!id) continue;
    const base = slugifyText(getTitle(item)) || "contenuto";
    const next = (counts.get(base) || 0) + 1;
    counts.set(base, next);
    out.set(id, next === 1 ? base : `${base}-${next}`);
  }

  return out;
}

async function resolveDomain() {
  const cnamePath = path.join(ROOT, "CNAME");
  try {
    const value = (await fs.readFile(cnamePath, "utf8")).trim();
    return value || DOMAIN_FALLBACK;
  } catch {
    return DOMAIN_FALLBACK;
  }
}

function publicRouteFolders() {
  return ["archivio", "article", "countdown", "agenda", "contatti", "turni-ricreazione", "ricerca"];
}

async function readSupabaseConfig() {
  const source = await fs.readFile(SUPABASE_CONFIG_PATH, "utf8");
  const urlMatch = source.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const keyMatch = source.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/);
  if (!urlMatch?.[1] || !keyMatch?.[1]) {
    throw new Error("Impossibile leggere SUPABASE_URL/SUPABASE_ANON_KEY da assets/js/supabase-config.js");
  }
  return { url: urlMatch[1], key: keyMatch[1] };
}

async function fetchRows({ url, key }, table, select, params = {}) {
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  endpoint.searchParams.set("select", select);
  for (const [k, v] of Object.entries(params)) {
    endpoint.searchParams.set(k, v);
  }

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fetch ${table} fallita (${response.status}): ${body}`);
  }

  return response.json();
}

function xmlEntry(loc, lastmod, changefreq, priority) {
  return (
    `  <url>\n` +
    `    <loc>${xmlEscape(loc)}</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    `  </url>`
  );
}

async function buildSitemap() {
  const domain = await resolveDomain();
  const supabase = await readSupabaseConfig();
  const entries = [];

  const nowDate = formatDate(new Date());
  const indexStat = await fs.stat(path.join(ROOT, "index.html"));
  entries.push(
    xmlEntry(
      `https://${domain}/`,
      formatDate(indexStat.mtime),
      INDEX_CHANGEFREQ,
      INDEX_PRIORITY
    )
  );

  for (const route of publicRouteFolders()) {
    const filePath = path.join(ROOT, route, "index.html");
    const stat = await fs.stat(filePath);
    const rule = PAGE_RULES[route];

    entries.push(
      xmlEntry(
        `https://${domain}/${route}/`,
        formatDate(stat.mtime),
        rule?.changefreq || DEFAULT_CHANGEFREQ,
        rule?.priority || DEFAULT_PRIORITY
      )
    );
  }

  const articles = await fetchRows(
    supabase,
    "articles",
    "id,title,created_at,updated_at",
    { published: "eq.true", order: "updated_at.desc" }
  );
  const articleSlugMap = buildUniqueSlugMap(articles || [], (x) => x.id, (x) => x.title);
  for (const article of articles || []) {
    const slug = articleSlugMap.get(String(article.id || ""));
    if (!slug) continue;
    entries.push(xmlEntry(`https://${domain}/article/${slug}/`, nowDate, "weekly", "0.7"));
  }

  let countdowns = [];
  try {
    countdowns = await fetchRows(
      supabase,
      "countdowns",
      "slug,updated_at",
      { active: "eq.true", order: "target_at.asc" }
    );
  } catch {
    countdowns = [];
  }
  for (const item of countdowns || []) {
    const slug = String(item?.slug || "").trim();
    if (!slug) continue;
    entries.push(xmlEntry(`https://${domain}/countdown/${slug}/`, nowDate, "daily", "0.7"));
  }

  const agendaEvents = await fetchRows(
    supabase,
    "agenda_events",
    "id,title,created_at,updated_at",
    { order: "date.asc" }
  );
  const agendaSlugMap = buildUniqueSlugMap(agendaEvents || [], (x) => x.id, (x) => x.title);
  for (const event of agendaEvents || []) {
    const slug = agendaSlugMap.get(String(event.id || ""));
    if (!slug) continue;
    entries.push(xmlEntry(`https://${domain}/agenda/${slug}/`, nowDate, "weekly", "0.7"));
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries.join("\n")}\n` +
    `</urlset>\n`
  );
}

async function main() {
  const xml = await buildSitemap();
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log("sitemap.xml generated");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
