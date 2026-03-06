import { getArticleById, getPublishedArticles } from "./public-api.js?v=20260224e";
import { escapeHtml, formatLocalDate, supabase } from "./supabase-client.js?v=20260224e";
import { buildArticleSlugMap, getArticleSlug } from "./article-url.js?v=20260303c";
import { markdownToHtml } from "./markdown.js?v=20260303c";
import { initRecreationTool, renderRecreationToolSection, shouldRenderRecreationTool } from "./recreation-tool.js?v=20260307a";

const container = document.getElementById("articleContainer");

function renderCreditsSection(article) {
  const authorName = String(article.author_name || article.credit_author || "").trim();
  const creditRows = [
    { label: "Autore:", value: authorName },
    { label: "Foto / Grafiche", value: article.credit_photos },
    { label: "Direttore responsabile", value: article.credit_director }
  ].filter((item) => String(item.value || "").trim());

  if (!creditRows.length) return "";

  return `
    <section class="mt-8 pt-5 border-t border-black/40 text-[0.9rem] leading-6 text-ink">
      ${creditRows.map((item) => `
        <div class="mb-4 last:mb-0 text-left">
          <p class="font-semibold">${escapeHtml(item.label)}</p>
          <p>${escapeHtml(item.value)}</p>
        </div>
      `).join("")}
    </section>
  `;
}

async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session);
}

async function renderArticle(article) {
  const markdownHtml = markdownToHtml(article.content || "");
  const attachments = Array.isArray(article.attachments) ? article.attachments : [];
  const publishedAt = article.created_at || article.updated_at;
  const publishedLabel = formatLocalDate(publishedAt);
  const authorName = String(article.author_name || article.credit_author || "").trim();
  const showRecreationTool = shouldRenderRecreationTool(article);

  container.innerHTML = `
    <p class="text-xs uppercase font-bold text-accent">${escapeHtml(article.category)}</p>
    <h1 class="headline text-6xl mt-2">${escapeHtml(article.title)}</h1>
    ${publishedLabel ? `<p class="mt-2 text-[11px] uppercase font-bold text-slate-500">Pubblicato il ${publishedLabel}</p>` : ""}
    ${authorName ? `<p class="mt-2 text-sm font-semibold">Autore: ${escapeHtml(authorName)}</p>` : ""}
    ${article.image_url ? `<div class="mt-6 border-2 border-black aspect-[16/9] overflow-hidden"><img src="${article.image_url}" alt="${escapeHtml(article.title)}" class="w-full h-full object-cover" /></div>` : ""}
    <div class="mt-8 pt-6 border-t-2 border-black prose max-w-none prose-p:leading-7">
      ${markdownHtml}
    </div>
    ${showRecreationTool ? renderRecreationToolSection() : ""}
    ${renderCreditsSection(article)}
    ${attachments.length ? `
      <section class="mt-8 pt-6 border-t-2 border-black">
        <h2 class="headline text-4xl">📎 Allegati</h2>
        <div class="mt-3 space-y-2">
          ${attachments.map((item) => `
            <a href="${item.url}" download="${escapeHtml(item.name || "allegato")}" class="block border-2 border-black p-3 font-semibold underline">
              ${escapeHtml(item.name || "Allegato")}
            </a>
          `).join("")}
        </div>
      </section>
    ` : ""}
  `;

  if (showRecreationTool) {
    await initRecreationTool(article);
  }
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const pathMatch = window.location.pathname.match(/^\/article\/([^/]+)\/?$/);
  const pathSlug = pathMatch ? decodeURIComponent(pathMatch[1]) : "";
  const bodyId = document.body?.dataset?.articleId || "";
  const id = params.get("id") || bodyId;
  const slug = params.get("slug") || pathSlug;
  if (!id && !slug) {
    container.innerHTML = '<p class="text-lg font-semibold">Articolo non trovato.</p>';
    return;
  }

  try {
    const allowDraft = await isAuthenticated();
    let article = null;
    let slugMap = new Map();

    if (id) {
      article = await getArticleById(id, allowDraft);
      if (!article) {
        container.innerHTML = '<p class="text-lg font-semibold">Articolo non disponibile.</p>';
        return;
      }
      const publishedList = await getPublishedArticles();
      slugMap = buildArticleSlugMap(publishedList);
    } else {
      const publishedList = await getPublishedArticles();
      slugMap = buildArticleSlugMap(publishedList);
      const found = publishedList.find((item) => getArticleSlug(item, slugMap) === slug);
      article = found || null;
      if (!article) {
        container.innerHTML = '<p class="text-lg font-semibold">Articolo non disponibile.</p>';
        return;
      }
    }

    const canonicalSlug = getArticleSlug(article, slugMap);
    if (canonicalSlug) {
      const canonicalPath = `/article/${encodeURIComponent(canonicalSlug)}/`;
      if (window.location.pathname !== canonicalPath) {
        history.replaceState(null, "", canonicalPath);
      }
    }

    await renderArticle(article);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="text-lg font-semibold">Errore caricamento articolo.</p>';
  }
}

bootstrap();
