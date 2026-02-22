import { getAgendaEvents, getCountdownEvents, getFeaturedArticleIds, getPublishedArticles } from "./public-api.js";
import { FEATURED_COUNTDOWN_SLUG, FALLBACK_COUNTDOWN_EVENTS, onlyFutureEvents } from "./countdown-data.js";
import { formatCountdown, formatTargetDate } from "./countdown-core.js";
import { formatLocalDate } from "./supabase-client.js";

const grid = document.getElementById("articlesGrid");
const featured = document.getElementById("featuredArticles");
const homeAgendaGrid = document.getElementById("homeAgendaGrid");
const homeCountdownFeatured = document.getElementById("homeCountdownFeatured");
const homeCountdownList = document.getElementById("homeCountdownList");
const presentationArticleBtn = document.getElementById("presentationArticleBtn");
const PRESENTATION_ARTICLE_ID = "9d056b37-cacf-4c49-879e-d312fb4ef31f";

let homeCountdownEvents = [];
let homeCountdownTicker = null;

function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data non disponibile" : date.toLocaleDateString("it-IT");
}

function articleCard(article) {
  const publishedLabel = formatLocalDate(article.created_at || article.updated_at);
  const publishedShort = shortDate(article.created_at || article.updated_at);
  return `
    <article class="border-2 border-black bg-white p-5 shadow-brutal lift transition-all h-full flex flex-col">
      <div class="mb-3 border-2 border-black aspect-[16/9] overflow-hidden bg-slate-100 flex items-center justify-center">
        ${article.image_url
          ? `<img src="${article.image_url}" alt="Immagine ${article.title}" class="w-full h-full object-cover" />`
          : `<div class="text-center px-3">
              <p class="text-[11px] uppercase font-bold text-slate-600">Articolo del ${publishedShort}</p>
              <p class="mt-1 headline text-xl text-accent">scolamia.it</p>
            </div>`}
      </div>
      <p class="text-xs font-bold uppercase text-accent">${article.category}</p>
      <h3 class="mt-2 text-xl font-semibold">${article.title}</h3>
      ${publishedLabel ? `<p class="mt-1 text-[11px] uppercase font-bold text-slate-500">Pubblicato il ${publishedLabel}</p>` : ""}
      <p class="mt-2 text-sm flex-1">${article.excerpt}</p>
      <a class="inline-block mt-4 text-xs font-bold uppercase underline" href="article.html?id=${encodeURIComponent(article.id)}">Leggi</a>
    </article>
  `;
}

function featuredCard(article, index) {
  return `
    <a href="article.html?id=${encodeURIComponent(article.id)}" class="stagger block border-2 border-white/60 p-4 hover:bg-white hover:text-black transition-colors" style="animation-delay:${index * 0.1}s">
      ${article.image_url ? `<div class="mb-2 border border-white/60 aspect-[16/9] overflow-hidden"><img src="${article.image_url}" alt="Immagine ${article.title}" class="w-full h-full object-cover" /></div>` : ""}
      <p class="text-sm font-semibold uppercase tracking-wide opacity-90">${article.category}</p>
      <h3 class="text-lg font-bold mt-1">${article.title}</h3>
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

function sortByTargetDate(events) {
  return [...events].sort((a, b) => new Date(a.target_at).getTime() - new Date(b.target_at).getTime());
}

function countdownHomeFeaturedCard(event) {
  return `
    <a href="countdown-detail.html?id=${encodeURIComponent(event.slug)}" class="block border-4 border-black bg-black text-white p-6 md:p-8 shadow-brutal lift transition-all h-full">
      <p class="text-xs uppercase font-bold tracking-wide opacity-80">Countdown principale</p>
      <h3 class="headline text-6xl mt-2">${event.title}</h3>
      <p data-home-countdown-value="${event.slug}" class="mt-4 text-2xl font-bold">${formatCountdown(event.target_at)}</p>
      <p class="mt-2 text-xs uppercase font-bold opacity-80">${formatTargetDate(event.target_at)}</p>
    </a>
  `;
}

function countdownHomeCard(event) {
  return `
    <a href="countdown-detail.html?id=${encodeURIComponent(event.slug)}" class="block border-2 border-black bg-white p-4 shadow-brutal lift transition-all">
      <h3 class="headline text-4xl mt-1">${event.title}</h3>
      <p data-home-countdown-value="${event.slug}" class="mt-3 text-lg font-bold">${formatCountdown(event.target_at)}</p>
      <p class="mt-2 text-xs uppercase font-semibold text-slate-500">${formatTargetDate(event.target_at)}</p>
    </a>
  `;
}

function selectHomeCountdowns(events) {
  const futureSorted = sortByTargetDate(onlyFutureEvents(events));
  if (!futureSorted.length) return { featured: null, next: [] };

  const featured = futureSorted.find((item) => item.slug === FEATURED_COUNTDOWN_SLUG || item.featured) || futureSorted[0];
  const next = futureSorted
    .filter((item) => item.slug !== featured.slug)
    .slice(0, 2);

  return { featured, next };
}

function updateHomeCountdownValues() {
  homeCountdownEvents = onlyFutureEvents(homeCountdownEvents);

  homeCountdownEvents.forEach((event) => {
    const node = document.querySelector(`[data-home-countdown-value="${event.slug}"]`);
    if (node) node.textContent = formatCountdown(event.target_at);
  });
}

function mountHomeCountdownTicker() {
  if (homeCountdownTicker) {
    clearInterval(homeCountdownTicker);
    homeCountdownTicker = null;
  }

  homeCountdownTicker = setInterval(() => {
    if (!homeCountdownEvents.length) {
      clearInterval(homeCountdownTicker);
      homeCountdownTicker = null;
      return;
    }
    updateHomeCountdownValues();
  }, 60000);
}

function renderHomeCountdownSection(events) {
  const { featured: featuredEvent, next } = selectHomeCountdowns(events);
  homeCountdownEvents = featuredEvent ? [featuredEvent, ...next] : [];

  if (!featuredEvent) {
    homeCountdownFeatured.innerHTML = '<div class="border-2 border-black bg-white p-5 shadow-brutal">Nessun countdown futuro disponibile.</div>';
    homeCountdownList.innerHTML = "";
    return;
  }

  homeCountdownFeatured.innerHTML = countdownHomeFeaturedCard(featuredEvent);

  homeCountdownList.innerHTML = next.length
    ? next.map((event) => countdownHomeCard(event)).join("")
    : '<div class="border-2 border-black bg-white p-4 shadow-brutal">Nessun altro countdown disponibile.</div>';

  mountHomeCountdownTicker();
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
  const [articlesRes, agendaRes, featuredRes, countdownRes] = await Promise.allSettled([
    getPublishedArticles(),
    getAgendaEvents(),
    getFeaturedArticleIds(),
    getCountdownEvents()
  ]);

  const published = articlesRes.status === "fulfilled" ? articlesRes.value : [];
  const top = published.slice(0, 3);
  const presentationArticle = published.find((article) => article.id === PRESENTATION_ARTICLE_ID || article.title.trim().toLowerCase() === "presentazione sito");
  if (presentationArticleBtn && presentationArticle) {
    presentationArticleBtn.href = `article.html?id=${encodeURIComponent(presentationArticle.id)}`;
  }

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

  const countdownEvents = countdownRes.status === "fulfilled" ? countdownRes.value : FALLBACK_COUNTDOWN_EVENTS;
  if (countdownRes.status === "rejected") {
    console.error(countdownRes.reason);
  }
  renderHomeCountdownSection(countdownEvents);

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
