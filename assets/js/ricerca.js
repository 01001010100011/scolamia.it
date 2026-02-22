import {
  CONTACTS,
  countdownDateTokens,
  dateTokens,
  getAgendaEvents,
  getCountdownEvents,
  getPublishedArticles,
  queryMatches
} from "./public-api.js";
import { FALLBACK_COUNTDOWN_EVENTS, onlyFutureEvents } from "./countdown-data.js";
import { formatTargetDate } from "./countdown-core.js";
import { formatLocalDate } from "./supabase-client.js";

const articleResultsEl = document.getElementById("articleResults");
const agendaResultsEl = document.getElementById("agendaResults");
const countdownResultsEl = document.getElementById("countdownResults");
const contactResultsEl = document.getElementById("contactResults");
const searchInput = document.getElementById("searchInput");

let articles = [];
let events = [];
let countdowns = [];

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
    !q || queryMatches(`${item.title} ${countdownDateTokens(item.target_at)}`, q)
  );

  const contactResults = CONTACTS.filter((item) =>
    !q || queryMatches(`${item.label} ${item.value}`, q)
  );

  articleResultsEl.innerHTML = articleResults.length
    ? articleResults.map((item) => `
        <article class="border-2 border-black bg-white p-4 shadow-brutal">
          ${item.image_url ? `<div class="mb-3 border-2 border-black aspect-[16/9] overflow-hidden"><img src="${item.image_url}" alt="Immagine ${item.title}" class="w-full h-full object-cover" /></div>` : ""}
          <p class="text-xs font-bold uppercase text-accent">${item.category}</p>
          <h3 class="mt-2 text-lg font-semibold">${item.title}</h3>
          <p class="mt-2 text-sm">${item.excerpt}</p>
          <a href="article.html?id=${encodeURIComponent(item.id)}" class="inline-block mt-3 text-xs font-bold uppercase underline">Apri</a>
        </article>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun articolo trovato.</div>';

  agendaResultsEl.innerHTML = agendaResults.length
    ? agendaResults.map((item) => `
        <article class="border-2 border-black bg-white p-4 shadow-brutal">
          <p class="text-xs font-bold uppercase text-accent">${item.category}</p>
          <h3 class="mt-2 text-lg font-semibold">${item.title}</h3>
          <p class="mt-2 text-sm">${item.description}</p>
          <p class="mt-2 text-[11px] uppercase font-bold text-slate-500">${formatLocalDate(normalizeAgendaDateInput(item.date)) || "Data non valida"}</p>
          <a href="agenda.html" class="inline-block mt-3 text-xs font-bold uppercase underline">Vai agenda</a>
        </article>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun evento trovato.</div>';

  countdownResultsEl.innerHTML = countdownResults.length
    ? countdownResults.map((item) => `
        <article class="border-2 border-black bg-white p-4 shadow-brutal">
          <p class="text-xs font-bold uppercase text-accent">Countdown</p>
          <h3 class="mt-2 text-lg font-semibold">${item.title}</h3>
          <p class="mt-2 text-[11px] uppercase font-bold text-slate-500">${formatTargetDate(item.target_at)}</p>
          <a href="countdown-detail.html?id=${encodeURIComponent(item.slug)}" class="inline-block mt-3 text-xs font-bold uppercase underline">Apri dettaglio</a>
        </article>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun countdown trovato.</div>';

  contactResultsEl.innerHTML = contactResults.length
    ? contactResults.map((item) => `
        <article class="border-2 border-black bg-white p-4 shadow-brutal">
          <p class="text-xs font-bold uppercase text-accent">${item.label}</p>
          <a href="${item.href}" ${item.href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""} class="mt-2 inline-block font-semibold underline">${item.value}</a>
        </article>
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

  if (articlesRes.status === "rejected") console.error(articlesRes.reason);
  if (eventsRes.status === "rejected") console.error(eventsRes.reason);
  if (countdownRes.status === "rejected") console.error(countdownRes.reason);

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";
  searchInput.value = initialQuery;

  document.getElementById("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const url = query ? `ricerca.html?q=${encodeURIComponent(query)}` : "ricerca.html";
    history.replaceState(null, "", url);
    render(query);
  });

  searchInput.addEventListener("input", () => render(searchInput.value));
  render(initialQuery);
}

bootstrap();
