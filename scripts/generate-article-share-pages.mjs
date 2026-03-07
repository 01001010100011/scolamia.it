import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUPABASE_CONFIG_PATH = path.join(ROOT, "assets", "js", "supabase-config.js");
const OUTPUT_DIR = path.join(ROOT, "article");
const OG_IMAGE_OUTPUT_DIR = path.join(ROOT, "assets", "social", "article-og");
const DOMAIN_FALLBACK = "scola-mia.com";
const DEFAULT_IMAGE = "https://scola-mia.com/assets/social/og-home.png";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
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

function buildArticleHtml({ title, excerpt, imageUrl, shareUrl, canonicalUrl, redirectUrl, domain }) {
  const safeTitle = escapeHtml(title || "Articolo");
  const hasDescription = Boolean(String(excerpt || "").trim());
  const safeDescription = hasDescription ? escapeHtml(excerpt) : "";
  const safeImage = escapeHtml(imageUrl || DEFAULT_IMAGE);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeRedirect = escapeHtml(redirectUrl);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - scola-mia.com</title>
  <link rel="icon" type="image/svg+xml" href="/assets/favicon-scola-mia.svg" />
  <link rel="apple-touch-icon" sizes="180x180" href="https://${domain}/apple-touch-icon-v2.png" />
  <link rel="apple-touch-icon-precomposed" href="https://${domain}/apple-touch-icon-precomposed-v2.png" />
  ${hasDescription ? `<meta name="description" content="${safeDescription}" />` : ""}
  <link rel="canonical" href="${safeCanonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Scola-Mia.com" />
  <meta property="og:locale" content="it_IT" />
  <meta property="og:url" content="${safeShareUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  ${hasDescription ? `<meta property="og:description" content="${safeDescription}" />` : ""}
  <meta property="og:image" content="${safeImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  ${hasDescription ? `<meta name="twitter:description" content="${safeDescription}" />` : ""}
  <meta name="twitter:image" content="${safeImage}" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f3ee; color: #101010; font-family: "IBM Plex Sans", sans-serif; }
    .wrap { padding: 24px; text-align: center; }
    a { color: #0c7ff2; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <p>Sto aprendo l'articolo...</p>
    <p><a href="${safeRedirect}">Apri articolo</a></p>
  </div>
  <script>
    window.location.replace(${JSON.stringify(redirectUrl)});
  </script>
</body>
</html>
`;
}

async function main() {
  const domain = await resolveDomain();
  const supabase = await readSupabaseConfig();
  const articles = await fetchPublishedArticles(supabase);
  const slugById = buildUniqueArticleSlugs(articles);
  await prepareOgImageDirectory();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory()) {
      await fs.rm(path.join(OUTPUT_DIR, entry.name), { recursive: true, force: true });
    }
  }

  for (const article of articles) {
    const slug = slugById.get(article.id) || slugifyArticleTitle(article.title) || "articolo";
    const folderName = slug;
    const folderPath = path.join(OUTPUT_DIR, folderName);
    const shareUrl = `https://${domain}/article/${slug}/`;
    const imageUrl = await mirrorArticleImageForOg({
      sourceUrl: article.image_url,
      slug,
      domain
    });
    const redirectUrl = `/article/?slug=${encodeURIComponent(slug)}`;

    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(
      path.join(folderPath, "index.html"),
      buildArticleHtml({
        title: article.title,
        excerpt: article.excerpt,
        imageUrl,
        shareUrl,
        canonicalUrl: shareUrl,
        redirectUrl,
        domain
      }),
      "utf8"
    );
  }

  console.log(`Article share pages generated: ${articles.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
