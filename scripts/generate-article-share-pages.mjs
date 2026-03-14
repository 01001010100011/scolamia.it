import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUPABASE_CONFIG_PATH = path.join(ROOT, "assets", "js", "supabase-config.js");
const ARTICLE_TEMPLATE_PATH = path.join(ROOT, "article.html");
const CANONICAL_OUTPUT_DIR = path.join(ROOT, "articoli");
const LEGACY_OUTPUT_DIR = path.join(ROOT, "article");
const OG_IMAGE_OUTPUT_DIR = path.join(ROOT, "assets", "social", "article-og");
const DOMAIN_FALLBACK = "scola-mia.com";
const DEFAULT_IMAGE = "https://scola-mia.com/assets/social/og-home.png";
const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toAbsoluteUrl(value, domain) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `https://${domain}${raw}`;
  return `https://${domain}/${raw.replace(/^\/+/, "")}`;
}

function getExtFromContentType(contentType) {
  const raw = String(contentType || "").toLowerCase();
  if (raw.includes("image/jpeg") || raw.includes("image/jpg")) return "jpg";
  if (raw.includes("image/png")) return "png";
  if (raw.includes("image/webp")) return "webp";
  if (raw.includes("image/gif")) return "gif";
  return "jpg";
}

function slugifyArticleTitle(title) {
  return String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildUniqueArticleSlugs(articles) {
  const counts = new Map();
  const slugById = new Map();
  const sorted = [...articles].sort((a, b) => {
    const aTime = new Date(a.created_at || a.updated_at || 0).getTime() || 0;
    const bTime = new Date(b.created_at || b.updated_at || 0).getTime() || 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id).localeCompare(String(b.id));
  });

  for (const article of sorted) {
    const base = slugifyArticleTitle(article.title) || "articolo";
    const next = (counts.get(base) || 0) + 1;
    counts.set(base, next);
    slugById.set(article.id, next === 1 ? base : `${base}-${next}`);
  }
  return slugById;
}

function isNoindexSlug(slug) {
  return /\b(prova|test|preview)\b/i.test(String(slug || ""));
}

async function resolveDomain() {
  try {
    const value = (await fs.readFile(path.join(ROOT, "CNAME"), "utf8")).trim();
    return value || DOMAIN_FALLBACK;
  } catch {
    return DOMAIN_FALLBACK;
  }
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

async function fetchPublishedArticles({ url, key }) {
  const endpoint = new URL(`${url}/rest/v1/articles`);
  endpoint.searchParams.set("select", "id,title,excerpt,image_url,published,created_at,updated_at");
  endpoint.searchParams.set("published", "eq.true");
  endpoint.searchParams.set("order", "updated_at.desc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fetch articoli fallita (${response.status}): ${body}`);
  }

  return response.json();
}

async function prepareOgImageDirectory() {
  await fs.mkdir(OG_IMAGE_OUTPUT_DIR, { recursive: true });
  const current = await fs.readdir(OG_IMAGE_OUTPUT_DIR, { withFileTypes: true });
  for (const entry of current) {
    if (entry.isFile()) {
      await fs.rm(path.join(OG_IMAGE_OUTPUT_DIR, entry.name), { force: true });
    }
  }
}

async function prepareCanonicalOutputDirectory() {
  await fs.mkdir(CANONICAL_OUTPUT_DIR, { recursive: true });
  const current = await fs.readdir(CANONICAL_OUTPUT_DIR, { withFileTypes: true });
  for (const entry of current) {
    if (entry.isDirectory() && !UUID_PREFIX_RE.test(entry.name)) {
      await fs.rm(path.join(CANONICAL_OUTPUT_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

async function prepareLegacyOutputDirectory() {
  await fs.mkdir(LEGACY_OUTPUT_DIR, { recursive: true });
  const current = await fs.readdir(LEGACY_OUTPUT_DIR, { withFileTypes: true });
  for (const entry of current) {
    if (entry.isDirectory()) {
      await fs.rm(path.join(LEGACY_OUTPUT_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

async function mirrorArticleImageForOg({ sourceUrl, slug, domain }) {
  const absoluteSource = toAbsoluteUrl(sourceUrl, domain);
  if (!absoluteSource) return DEFAULT_IMAGE;

  try {
    const response = await fetch(absoluteSource, {
      headers: {
        "user-agent": "scola-mia-share-generator/1.0"
      }
    });
    if (!response.ok) throw new Error(`status ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) throw new Error("not an image content-type");

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("empty image");

    const ext = getExtFromContentType(contentType);
    const filename = `${slug}.${ext}`;
    await fs.writeFile(path.join(OG_IMAGE_OUTPUT_DIR, filename), buffer);
    return `https://${domain}/assets/social/article-og/${filename}`;
  } catch (error) {
    console.warn(`OG image mirror failed for "${slug}", fallback to default:`, error.message || error);
    return DEFAULT_IMAGE;
  }
}

function buildHeadMeta({ title, excerpt, imageUrl, canonicalUrl, shareUrl, robotsContent }) {
  const safeTitle = escapeHtml(title || "Articolo");
  const hasDescription = Boolean(String(excerpt || "").trim());
  const safeDescription = hasDescription ? escapeHtml(excerpt) : "";
  const safeImage = escapeHtml(imageUrl || DEFAULT_IMAGE);
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeShareUrl = escapeHtml(shareUrl);

  return [
    `${hasDescription ? `<meta name="description" content="${safeDescription}" />\n  ` : ""}<link rel="canonical" href="${safeCanonical}" />`,
    robotsContent ? `<meta name="robots" content="${escapeHtml(robotsContent)}" />` : "",
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Scola-Mia.com" />`,
    `<meta property="og:locale" content="it_IT" />`,
    `<meta property="og:url" content="${safeShareUrl}" />`,
    `<meta property="og:title" content="${safeTitle}" />`,
    hasDescription ? `<meta property="og:description" content="${safeDescription}" />` : "",
    `<meta property="og:image" content="${safeImage}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    hasDescription ? `<meta name="twitter:description" content="${safeDescription}" />` : "",
    `<meta name="twitter:image" content="${safeImage}" />`
  ].filter(Boolean).join("\n  ");
}

function buildCanonicalArticleHtml(template, { title, excerpt, imageUrl, canonicalUrl, shareUrl, slug, robotsContent }) {
  const metaBlock = buildHeadMeta({ title, excerpt, imageUrl, canonicalUrl, shareUrl, robotsContent });
  let html = template;
  html = html.replace(/\s*<meta name="robots" content="noindex, follow" \/>\s*/i, "\n  ");
  html = html.replace(/\s*<link rel="canonical" href="[^"]+" \/>\s*/i, "\n  ");
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)} - scola-mia.com</title>`);
  html = html.replace(/(<link rel="apple-touch-icon-precomposed"[^>]*>\s*)/, `$1  ${metaBlock}\n  `);
  html = html.replace(/<body([^>]*)>/, `<body$1 data-article-slug="${escapeHtml(slug)}">`);
  return html;
}

function buildRedirectHtml({ title, excerpt, imageUrl, canonicalUrl, redirectUrl, robotsContent, domain }) {
  const safeTitle = escapeHtml(title || "Articolo");
  const safeRedirect = escapeHtml(redirectUrl);
  const metaBlock = buildHeadMeta({
    title,
    excerpt,
    imageUrl,
    canonicalUrl,
    shareUrl: canonicalUrl,
    robotsContent
  });

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - scola-mia.com</title>
  <link rel="icon" type="image/svg+xml" href="/assets/favicon-scola-mia.svg" />
  <link rel="apple-touch-icon" sizes="180x180" href="https://${domain}/apple-touch-icon-v2.png" />
  <link rel="apple-touch-icon-precomposed" href="https://${domain}/apple-touch-icon-precomposed-v2.png" />
  <script src="/assets/js/enforce-clean-url.js?v=20260311a"></script>
  <script>document.documentElement.dataset.maintenanceGuard = "pending";</script>
  <script type="module" src="/assets/js/maintenance-guard.js?v=20260312a"></script>
  <style>html[data-maintenance-guard="pending"] body { opacity: 0; }</style>
  <meta http-equiv="refresh" content="0; url=${safeRedirect}" />
  ${metaBlock}
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f3ee; color: #101010; font-family: "IBM Plex Sans", sans-serif; }
    .wrap { padding: 24px; text-align: center; }
    a { color: #0c7ff2; font-weight: 700; }
  </style>
</head>
<body>
  <script src="/assets/js/cookie-consent-bootstrap.js?v=20260311a"></script>
  <div class="wrap">
    <p>Sto aprendo l'articolo...</p>
    <p><a href="${safeRedirect}">Apri articolo</a></p>
  </div>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>
`;
}

async function writeLegacyUuidRedirect({ article, slug, canonicalUrl, imageUrl, domain }) {
  const legacyFolderName = `${article.id}-${slug}`;
  const folderPath = path.join(CANONICAL_OUTPUT_DIR, legacyFolderName);
  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(
    path.join(folderPath, "index.html"),
    buildRedirectHtml({
      title: article.title,
      excerpt: article.excerpt,
      imageUrl,
      canonicalUrl,
      redirectUrl: canonicalUrl.replace(`https://${domain}`, ""),
      robotsContent: "noindex, follow",
      domain
    }),
    "utf8"
  );
}

async function writeArticlesRootRedirect(domain) {
  await fs.mkdir(CANONICAL_OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CANONICAL_OUTPUT_DIR, "index.html"),
    buildRedirectHtml({
      title: "Articoli",
      excerpt: "Archivio articoli di Scola-Mia.com.",
      imageUrl: DEFAULT_IMAGE,
      canonicalUrl: `https://${domain}/archivio/`,
      redirectUrl: "/archivio/",
      robotsContent: "noindex, follow",
      domain
    }),
    "utf8"
  );
}

async function main() {
  const domain = await resolveDomain();
  const supabase = await readSupabaseConfig();
  const articles = await fetchPublishedArticles(supabase);
  const slugById = buildUniqueArticleSlugs(articles);
  const articleTemplate = await fs.readFile(ARTICLE_TEMPLATE_PATH, "utf8");

  await prepareOgImageDirectory();
  await prepareCanonicalOutputDirectory();
  await prepareLegacyOutputDirectory();
  await writeArticlesRootRedirect(domain);

  for (const article of articles) {
    const slug = slugById.get(article.id) || slugifyArticleTitle(article.title) || "articolo";
    const canonicalUrl = `https://${domain}/articoli/${slug}/`;
    const legacyUrl = `https://${domain}/article/${slug}/`;
    const imageUrl = await mirrorArticleImageForOg({ sourceUrl: article.image_url, slug, domain });
    const robotsContent = isNoindexSlug(slug) ? "noindex, follow" : "index, follow";

    const canonicalFolder = path.join(CANONICAL_OUTPUT_DIR, slug);
    await fs.mkdir(canonicalFolder, { recursive: true });
    await fs.writeFile(
      path.join(canonicalFolder, "index.html"),
      buildCanonicalArticleHtml(articleTemplate, {
        title: article.title,
        excerpt: article.excerpt,
        imageUrl,
        canonicalUrl,
        shareUrl: canonicalUrl,
        slug,
        robotsContent
      }),
      "utf8"
    );

    const legacyFolder = path.join(LEGACY_OUTPUT_DIR, slug);
    await fs.mkdir(legacyFolder, { recursive: true });
    await fs.writeFile(
      path.join(legacyFolder, "index.html"),
      buildRedirectHtml({
        title: article.title,
        excerpt: article.excerpt,
        imageUrl,
        canonicalUrl,
        redirectUrl: `/articoli/${encodeURIComponent(slug)}/`,
        robotsContent: "noindex, follow",
        domain
      }),
      "utf8"
    );

    await writeLegacyUuidRedirect({ article, slug, canonicalUrl, imageUrl, domain });
  }

  console.log(`Article pages generated: ${articles.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
