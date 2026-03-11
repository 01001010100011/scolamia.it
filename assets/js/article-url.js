import { buildUniqueSlugMap, slugifyText } from "./slug-utils.js?v=20260303a";

export function slugifyArticleTitle(title) {
  return slugifyText(title);
}

export function buildArticleSlugMap(articles) {
  return buildUniqueSlugMap(
    Array.isArray(articles) ? articles : [],
    (article) => article?.id,
    (article) => article?.title
  );
}

export function getArticleSlug(article, slugMap = null) {
  const id = String(article?.id || "").trim();
  if (slugMap instanceof Map && id && slugMap.has(id)) return slugMap.get(id);
  return slugifyArticleTitle(article?.title) || "articolo";
}

export function buildArticleUrl(article, slugMap = null) {
  const slug = getArticleSlug(article, slugMap);
  return `/articoli/${encodeURIComponent(slug)}/`;
}
