import {
  CONTACTS,
  countdownDateTokens,
  dateTokens,
  getAgendaEvents,
  getCountdownEvents,
  getPublishedArticles,
  queryMatches
} from "./public-api.js?v=20260224e";
import { FALLBACK_COUNTDOWN_EVENTS, countdownTitleWithEmoji, onlyFutureEvents } from "./countdown-data.js?v=20260224e";
import { formatTargetDate } from "./countdown-core.js?v=20260224e";
import { formatLocalDate } from "./supabase-client.js?v=20260224e";
import { buildArticleSlugMap, buildArticleUrl } from "./article-url.js?v=20260311a";
import { buildAgendaSlugMap, buildAgendaUrl } from "./agenda-url.js?v=20260303a";
import { buildCountdownUrl } from "./countdown-url.js?v=20260303a";

const articleResultsEl = document.getElementById("articleResults");
const agendaResultsEl = document.getElementById("agendaResults");
const countdownResultsEl = document.getElementById("countdownResults");
const contactResultsEl = document.getElementById("contactResults");
const searchInput = document.getElementById("searchInput");

let articles = [];
let events = [];
let countdowns = [];
let articleSlugMap = new Map();
let agendaSlugMap = new Map();
const SEARCH_CANONICAL = "https://scola-mia.com/ricerca/";

function ensureHeadTag({ selector, createTag = "meta", attributes = {} }) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(createTag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    document.head.appendChild(element);
  }
  return element;
}

function syncSearchSeo() {
  const hasParams = new URLSearchParams(window.location.search).size > 0;
  const canonical = ensureHeadTag({
    selector: 'link[rel="canonical"]',
    createTag: "link",
    attributes: { rel: "canonical" }
  });
  canonical.setAttribute("href", SEARCH_CANONICAL);

  const robots = ensureHeadTag({
    selector: 'meta[name="robots"]',
    attributes: { name: "robots" }
  });
  robots.setAttribute("content", hasParams ? "noindex, follow" : "index, follow");
}

function isMobileContext() {
  return window.matchMedia("(max-width: 1023px)").matches
    || window.matchMedia("(pointer: coarse)").matches;
}

function focusSearchInputForMobile() {
  const focusNow = () => {
    try {
      searchInput.focus({ preventScroll: true });
    } catch (_) {
      searchInput.focus();
    }
    searchInput.click();
    const caret = searchInput.value.length;
    searchInput.setSelectionRange(caret, caret);
  };

  focusNow();
  setTimeout(focusNow, 120);
  setTimeout(focusNow, 320);
}

function normalizeAgendaDateInput(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (iso) return iso[1];
  const dmy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return raw;
}

function render(query = "") {
  const q = query.trim();

  const articleResults = articles.filter((item) =>
    !q || queryMatches(`${item.title} ${item.category} ${item.excerpt} ${item.content} ${dateTokens(item.created_at)} ${dateTokens(item.updated_at)}`, q)
  );

  const agendaResults = events.filter((item) =>
    !q || queryMatches(`${item.title} ${item.category} ${item.description} ${dateTokens(item.date)}`, q)
  );

  const countdownResults = countdowns.filter((item) =>
    !q || queryMatches(`${countdownTitleWithEmoji(item)} ${countdownDateTokens(item.target_at)}`, q)
  );

  const contactResults = CONTACTS.filter((item) =>
    !q || queryMatches(`${item.label} ${item.value}`, q)
  );

  articleResultsEl.innerHTML = articleResults.length
    ? articleResults.map((item) => `
        <a href="${buildArticleUrl(item, articleSlugMap)}" class="block border-2 border-black bg-white p-4 shadow-brutal hover:-translate-y-0.5 transition-transform">
          ${item.image_url ? `<div class="mb-3 border-2 border-black aspect-[16/9] overflow-hidden"><img src="${item.image_url}" alt="Immagine ${item.title}" class="w-full h-full object-cover" /></div>` : ""}
          <p class="text-xs font-bold uppercase text-accent">${item.category}</p>
          <h3 class="mt-2 text-lg font-semibold">${item.title}</h3>
          <p class="mt-2 text-sm">${item.excerpt}</p>
          <span class="inline-block mt-3 text-xs font-bold uppercase underline">Apri</span>
        </a>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun articolo trovato.</div>';

  agendaResultsEl.innerHTML = agendaResults.length
    ? agendaResults.map((item) => {
      const agendaUrl = buildAgendaUrl(item, agendaSlugMap);
      return `
        <a href="${agendaUrl}" class="block border-2 border-black bg-white p-4 shadow-brutal hover:-translate-y-0.5 transition-transform">
          <p class="text-xs font-bold uppercase text-accent">${item.category}</p>
          <h3 class="mt-2 text-lg font-semibold">${item.title}</h3>
          <p class="mt-2 text-sm">${item.description}</p>
          <p class="mt-2 text-[11px] uppercase font-bold text-slate-500">${formatLocalDate(normalizeAgendaDateInput(item.date)) || "Data non valida"}</p>
          <span class="inline-block mt-3 text-xs font-bold uppercase underline">Apri evento</span>
        </a>
      `;
    }).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun evento trovato.</div>';

  countdownResultsEl.innerHTML = countdownResults.length
    ? countdownResults.map((item) => `
        <a href="${buildCountdownUrl(item)}" class="block border-2 border-black bg-white p-4 shadow-brutal hover:-translate-y-0.5 transition-transform">
          <p class="text-xs font-bold uppercase text-accent">Countdown</p>
          <h3 class="mt-2 text-lg font-semibold">${countdownTitleWithEmoji(item)}</h3>
          <p class="mt-2 text-[11px] uppercase font-bold text-slate-500">${formatTargetDate(item.target_at)}</p>
          <span class="inline-block mt-3 text-xs font-bold uppercase underline">Apri dettaglio</span>
        </a>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun countdown trovato.</div>';

  contactResultsEl.innerHTML = contactResults.length
    ? contactResults.map((item) => `
        <a href="${item.href}" ${item.href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""} class="block border-2 border-black bg-white p-4 shadow-brutal hover:-translate-y-0.5 transition-transform">
          <p class="text-xs font-bold uppercase text-accent">${item.label}</p>
          <span class="mt-2 inline-block font-semibold underline">${item.value}</span>
        </a>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun contatto trovato.</div>';
}

async function bootstrap() {
  const [articlesRes, eventsRes, countdownRes] = await Promise.allSettled([
    getPublishedArticles(),
    getAgendaEvents(),
    getCountdownEvents()
  ]);

  articles = articlesRes.status === "fulfilled" ? articlesRes.value : [];
  events = eventsRes.status === "fulfilled" ? eventsRes.value : [];
  countdowns = countdownRes.status === "fulfilled" ? countdownRes.value : onlyFutureEvents(FALLBACK_COUNTDOWN_EVENTS);
  articleSlugMap = buildArticleSlugMap(articles);
  agendaSlugMap = buildAgendaSlugMap(events);

  if (articlesRes.status === "rejected") console.error(articlesRes.reason);
  if (eventsRes.status === "rejected") console.error(eventsRes.reason);
  if (countdownRes.status === "rejected") console.error(countdownRes.reason);

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";
  const shouldFocus = params.get("focus") === "1";
  searchInput.value = initialQuery;

  document.getElementById("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const url = query ? `/ricerca/?q=${encodeURIComponent(query)}` : "/ricerca/";
    history.replaceState(null, "", url);
    syncSearchSeo();
    render(query);
  });

  searchInput.addEventListener("input", () => render(searchInput.value));
  syncSearchSeo();
  render(initialQuery);

  if (shouldFocus && isMobileContext()) {
    requestAnimationFrame(() => {
      focusSearchInputForMobile();
    });
  }
}

bootstrap();
