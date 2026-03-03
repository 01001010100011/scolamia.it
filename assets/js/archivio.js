import { getPublishedArticles } from "./public-api.js?v=20260224e";
import { formatLocalDate } from "./supabase-client.js?v=20260224e";
import { buildArticleUrl } from "./article-url.js?v=20260303a";

const searchInput = document.getElementById("archiveSearchInput");
const allEl = document.getElementById("allArticles");
let publishedArticles = [];

function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data non disponibile" : date.toLocaleDateString("it-IT");
}

function card(article) {
  const publishedLabel = formatLocalDate(article.created_at || article.updated_at);
  const publishedShort = shortDate(article.created_at || article.updated_at);
  const articleUrl = buildArticleUrl(article.id, article.title);
  return `
    <a href="${articleUrl}" class="block border-2 border-black bg-white p-4 shadow-brutal h-full flex flex-col">
      <div class="mb-3 border-2 border-black aspect-[16/9] overflow-hidden bg-slate-100 flex items-center justify-center">
        ${article.image_url
          ? `<img src="${article.image_url}" alt="Immagine ${article.title}" class="w-full h-full object-cover" />`
          : `<div class="text-center px-3">
              <p class="text-[11px] uppercase font-bold text-slate-600">Articolo del ${publishedShort}</p>
              <p class="mt-1 headline text-xl text-accent">scola-mia.com</p>
            </div>`}
      </div>
      <p class="text-xs font-bold uppercase text-accent">${article.category}</p>
      <h3 class="mt-2 text-lg font-semibold">${article.title}</h3>
      ${publishedLabel ? `<p class="mt-1 text-[11px] uppercase font-bold text-slate-500">Pubblicato il ${publishedLabel}</p>` : ""}
      <p class="mt-2 text-sm flex-1">${article.excerpt}</p>
      <span class="inline-block mt-3 text-xs font-bold uppercase underline">Leggi</span>
    </a>
  `;
}

function render(query = "") {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? publishedArticles
    : publishedArticles.filter((article) => `${article.title} ${article.category} ${article.excerpt} ${article.content}`.toLowerCase().includes(q));

  allEl.innerHTML = filtered.length
    ? filtered.map(card).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun articolo trovato per questa ricerca.</div>';
}

async function bootstrap() {
  try {
    publishedArticles = await getPublishedArticles();
  } catch (error) {
    console.error(error);
    allEl.innerHTML = '<div class="md:col-span-3 border-2 border-black bg-white p-4">Errore caricamento articoli.</div>';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";
  searchInput.value = initialQuery;

  document.getElementById("archiveSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const url = query ? `/archivio/?q=${encodeURIComponent(query)}` : "/archivio/";
    history.replaceState(null, "", url);
    render(query);
  });

  searchInput.addEventListener("input", () => render(searchInput.value));
  render(initialQuery);
}

bootstrap();
