import { getAgendaEvents, getFeaturedArticleIds, getPublishedArticles } from "./public-api.js";
import { formatLocalDate } from "./supabase-client.js";

const grid = document.getElementById("articlesGrid");
const featured = document.getElementById("featuredArticles");
const homeAgendaGrid = document.getElementById("homeAgendaGrid");

function articleCard(article) {
  return `
    <article class="border-2 border-black bg-white p-5 shadow-brutal lift transition-all">
      ${article.image_url ? `<div class="mb-3 border-2 border-black aspect-[16/9] overflow-hidden"><img src="${article.image_url}" alt="Immagine ${article.title}" class="w-full h-full object-cover" /></div>` : ""}
      <p class="text-xs font-bold uppercase text-accent">${article.category}</p>
      <h3 class="mt-2 text-xl font-semibold">${article.title}</h3>
      <p class="mt-2 text-sm">${article.excerpt}</p>
      <a class="inline-block mt-4 text-xs font-bold uppercase underline" href="article.html?id=${encodeURIComponent(article.id)}">Leggi</a>
    </article>
  `;
}

function featuredCard(article, index) {
  return `
    <a href="article.html?id=${encodeURIComponent(article.id)}" class="stagger block border-2 border-white/60 p-4 hover:bg-white hover:text-black transition-colors" style="animation-delay:${index * 0.1}s">
      ${article.image_url ? `<div class="mb-2 border border-white/60 aspect-[16/9] overflow-hidden"><img src="${article.image_url}" alt="Immagine ${article.title}" class="w-full h-full object-cover" /></div>` : ""}
      <p class="text-xs uppercase opacity-70">${article.category}</p>
      <h3 class="font-semibold mt-1">${article.title}</h3>
    </a>
  `;
}

function agendaCard(item) {
  const dateLabel = formatLocalDate(item.date) || "Data da definire";
  return `
    <article class="border-2 border-white p-4">
      <p class="text-xs uppercase font-bold opacity-80">${item.category}</p>
      <h3 class="mt-1 font-semibold">${item.title}</h3>
      <p class="mt-2 text-xs uppercase font-bold">${dateLabel}</p>
      <a class="inline-block mt-3 text-[11px] font-bold uppercase underline" href="agenda.html">Apri agenda</a>
    </article>
  `;
}

function normalizeDateValue(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : (raw.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] || "");
  if (!normalized) return Number.POSITIVE_INFINITY;
  const time = new Date(`${normalized}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

async function renderHome() {
  const [articlesRes, agendaRes, featuredRes] = await Promise.allSettled([
    getPublishedArticles(),
    getAgendaEvents(),
    getFeaturedArticleIds()
  ]);

  const published = articlesRes.status === "fulfilled" ? articlesRes.value : [];
  const top = published.slice(0, 3);

  if (articlesRes.status === "rejected") {
    console.error(articlesRes.reason);
    grid.innerHTML = '<div class="md:col-span-3 border-2 border-black bg-white p-5 shadow-brutal">Errore caricamento articoli.</div>';
  } else if (!top.length) {
    grid.innerHTML = '<div class="md:col-span-3 border-2 border-black bg-white p-5 shadow-brutal">Nessun articolo pubblicato.</div>';
  } else {
    grid.innerHTML = top.map(articleCard).join("");
  }

  if (articlesRes.status === "rejected") {
    featured.innerHTML = '<div class="border-2 border-white/60 p-4">Errore caricamento evidenza.</div>';
  } else {
    const featuredIds = featuredRes.status === "fulfilled" ? featuredRes.value : [];
    const featuredArticles = (featuredIds.length
      ? featuredIds.map((id) => published.find((item) => item.id === id)).filter(Boolean)
      : top
    ).slice(0, 3);

    featured.innerHTML = featuredArticles.length
      ? featuredArticles.map(featuredCard).join("")
      : '<div class="border-2 border-white/60 p-4">Nessun contenuto in evidenza.</div>';
  }

  if (agendaRes.status === "rejected") {
    console.error(agendaRes.reason);
    homeAgendaGrid.innerHTML = '<div class="md:col-span-3 border-2 border-white p-4">Errore caricamento agenda.</div>';
  } else {
    const upcoming = [...agendaRes.value]
      .sort((a, b) => normalizeDateValue(a.date) - normalizeDateValue(b.date))
      .slice(0, 3);

    homeAgendaGrid.innerHTML = upcoming.length
      ? upcoming.map(agendaCard).join("")
      : '<div class="md:col-span-3 border-2 border-white p-4">Nessun evento agenda disponibile.</div>';
  }
}

document.getElementById("homeSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = document.getElementById("homeSearchInput").value.trim();
  const url = query ? `ricerca.html?q=${encodeURIComponent(query)}` : "ricerca.html";
  window.location.href = url;
});

renderHome();
