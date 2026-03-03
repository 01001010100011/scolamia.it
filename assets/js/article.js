import { getArticleById } from "./public-api.js?v=20260224e";
import { escapeHtml, formatLocalDate, supabase } from "./supabase-client.js?v=20260224e";
import { slugifyArticleTitle } from "./article-url.js?v=20260224e";
import { markdownToHtml } from "./markdown.js?v=20260303b";

const container = document.getElementById("articleContainer");

function renderCreditsSection(article) {
  const creditRows = [
    { label: "Articolo redatto da", value: article.credit_author },
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

function renderArticle(article) {
  const markdownHtml = markdownToHtml(article.content || "");
  const attachments = Array.isArray(article.attachments) ? article.attachments : [];
  const publishedAt = article.created_at || article.updated_at;
  const publishedLabel = formatLocalDate(publishedAt);
  const authorName = String(article.author_name || "").trim();

  container.innerHTML = `
    <p class="text-xs uppercase font-bold text-accent">${escapeHtml(article.category)}</p>
    <h1 class="headline text-6xl mt-2">${escapeHtml(article.title)}</h1>
    ${publishedLabel ? `<p class="mt-2 text-[11px] uppercase font-bold text-slate-500">Pubblicato il ${publishedLabel}</p>` : ""}
    ${authorName ? `<p class="mt-2 text-sm font-semibold">Autore: ${escapeHtml(authorName)}</p>` : ""}
    ${article.image_url ? `<div class="mt-6 border-2 border-black aspect-[16/9] overflow-hidden"><img src="${article.image_url}" alt="${escapeHtml(article.title)}" class="w-full h-full object-cover" /></div>` : ""}
    <div class="mt-8 pt-6 border-t-2 border-black prose max-w-none prose-p:leading-7">
      ${markdownHtml}
    </div>
    ${renderCreditsSection(article)}
    ${attachments.length ? `
      <section class="mt-8 pt-6 border-t-2 border-black">
        <h2 class="headline text-4xl">Allegati</h2>
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
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const pathMatch = window.location.pathname.match(/^\/articoli\/([^/]+)\/?$/);
  const pathId = pathMatch ? decodeURIComponent(pathMatch[1]).split("-")[0] : "";
  const bodyId = document.body?.dataset?.articleId || "";
  const id = params.get("id") || pathId || bodyId;
  if (!id) {
    container.innerHTML = '<p class="text-lg font-semibold">Articolo non trovato.</p>';
    return;
  }

  try {
    const allowDraft = await isAuthenticated();
    const article = await getArticleById(id, allowDraft);

    if (!article) {
      container.innerHTML = '<p class="text-lg font-semibold">Articolo non disponibile.</p>';
      return;
    }

    const expectedSlug = slugifyArticleTitle(article.title);
    const isQueryRoute = window.location.pathname === "/article/" || window.location.pathname === "/article";
    if (isQueryRoute && expectedSlug && params.get("slug") !== expectedSlug) {
      params.set("slug", expectedSlug);
      history.replaceState(null, "", `/article/?${params.toString()}`);
    }

    renderArticle(article);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="text-lg font-semibold">Errore caricamento articolo.</p>';
  }
}

bootstrap();
