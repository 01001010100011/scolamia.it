import { countdownDateTokens, getCountdownEvents, queryMatches } from "./public-api.js";
import { FEATURED_COUNTDOWN_SLUG, FALLBACK_COUNTDOWN_EVENTS, onlyFutureEvents, sortCountdownEvents } from "./countdown-data.js";
import { formatCountdown, formatTargetDate, getRemainingTotals } from "./countdown-core.js";

const featuredEl = document.getElementById("featuredCountdown");
const listEl = document.getElementById("countdownList");
const statusEl = document.getElementById("countdownStatus");
const searchInput = document.getElementById("countdownSearchInput");
const searchForm = document.getElementById("countdownSearchForm");

let allEvents = [];
let visibleEvents = [];
let activeQuery = "";
let timer = null;

function eventSearchSource(event) {
  return `${event.title} ${countdownDateTokens(event.target_at)}`;
}

function filterEvents(events, query) {
  const q = String(query || "").trim();
  if (!q) return events;
  return events.filter((event) => queryMatches(eventSearchSource(event), q));
}

function renderTotals(event, isFeatured) {
  const totals = getRemainingTotals(event.target_at);
  if (!totals) return "";

  const textClass = isFeatured ? "text-xs font-semibold opacity-90" : "text-[11px] font-semibold text-slate-600";
  return `
    <div data-countdown-totals="${event.slug}" class="mt-2 space-y-1 ${textClass}">
      <p data-countdown-hours="${event.slug}">Mancano ${totals.hoursTotal} ore</p>
      <p data-countdown-minutes="${event.slug}">Mancano ${totals.minutesTotal} minuti</p>
      <p data-countdown-seconds="${event.slug}">Mancano ${totals.secondsTotal} secondi</p>
    </div>
  `;
}

function renderCard(event, isFeatured = false) {
  return `
    <a href="countdown-detail.html?id=${encodeURIComponent(event.slug)}" class="block border-2 border-black ${isFeatured ? "bg-black text-white p-6 md:p-8" : "bg-white p-4"} shadow-brutal lift transition-all">
      <h3 class="${isFeatured ? "headline text-6xl mt-1" : "headline text-4xl mt-1"}">${event.title}</h3>
      <p data-countdown-value="${event.slug}" class="${isFeatured ? "mt-4 text-2xl font-bold" : "mt-3 text-lg font-bold"}">${formatCountdown(event.target_at)}</p>
      ${renderTotals(event, isFeatured)}
      <p class="${isFeatured ? "mt-3 text-sm opacity-80" : "mt-2 text-xs uppercase font-semibold text-slate-500"}">${formatTargetDate(event.target_at)}</p>
    </a>
  `;
}

function renderState() {
  const futureSorted = sortCountdownEvents(onlyFutureEvents(allEvents));
  const filtered = filterEvents(futureSorted, activeQuery);
  visibleEvents = filtered;

  if (!filtered.length) {
    featuredEl.innerHTML = "";
    listEl.innerHTML = '<div class="border-2 border-black bg-white p-4">Nessun countdown trovato con i filtri correnti.</div>';
    if (statusEl) {
      statusEl.textContent = "Mostrati solo eventi futuri (fuso Europe/Rome).";
      statusEl.classList.remove("hidden");
    }
    return;
  }

  const featured = filtered.find((event) => event.slug === FEATURED_COUNTDOWN_SLUG || event.featured) || filtered[0];
  const others = filtered.filter((event) => event.slug !== featured.slug);

  featuredEl.innerHTML = renderCard(featured, true);
  listEl.innerHTML = others.length
    ? others.map((event) => renderCard(event)).join("")
    : '<div class="border-2 border-black bg-white p-4">Nessun altro countdown futuro.</div>';

  if (statusEl) {
    statusEl.textContent = "Mostrati solo eventi futuri (fuso Europe/Rome).";
    statusEl.classList.remove("hidden");
  }
}

function updateEventNodes(event) {
  const valueNode = document.querySelector(`[data-countdown-value="${event.slug}"]`);
  const totalsWrap = document.querySelector(`[data-countdown-totals="${event.slug}"]`);
  const hoursNode = document.querySelector(`[data-countdown-hours="${event.slug}"]`);
  const minutesNode = document.querySelector(`[data-countdown-minutes="${event.slug}"]`);
  const secondsNode = document.querySelector(`[data-countdown-seconds="${event.slug}"]`);

  if (!valueNode) return;

  const totals = getRemainingTotals(event.target_at);
  if (!totals) {
    valueNode.textContent = "Evento concluso";
    if (totalsWrap) totalsWrap.classList.add("hidden");
    return;
  }

  valueNode.textContent = formatCountdown(event.target_at);
  if (totalsWrap) totalsWrap.classList.remove("hidden");
  if (hoursNode) hoursNode.textContent = `Mancano ${totals.hoursTotal} ore`;
  if (minutesNode) minutesNode.textContent = `Mancano ${totals.minutesTotal} minuti`;
  if (secondsNode) secondsNode.textContent = `Mancano ${totals.secondsTotal} secondi`;
}

function updateCountdownValues() {
  visibleEvents.forEach((event) => updateEventNodes(event));
}

function mountTicker() {
  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    allEvents = onlyFutureEvents(allEvents);
    if (!allEvents.length) {
      featuredEl.innerHTML = "";
      listEl.innerHTML = '<div class="border-2 border-black bg-white p-4">Nessun countdown futuro disponibile.</div>';
      if (statusEl) statusEl.classList.add("hidden");
      clearInterval(timer);
      timer = null;
      return;
    }

    updateCountdownValues();
    renderState();
  }, 1000);
}

async function loadEvents() {
  try {
    const dbEvents = await getCountdownEvents();
    return dbEvents;
  } catch (error) {
    console.warn("Fallback countdown events attivato:", error);
    return FALLBACK_COUNTDOWN_EVENTS;
  }
}

async function bootstrap() {
  allEvents = await loadEvents();
  allEvents = onlyFutureEvents(allEvents);

  if (!allEvents.length) {
    featuredEl.innerHTML = "";
    listEl.innerHTML = '<div class="border-2 border-black bg-white p-4">Nessun countdown futuro disponibile.</div>';
    return;
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => event.preventDefault());
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeQuery = searchInput.value.trim();
      renderState();
    });
  }

  renderState();
  mountTicker();
}

bootstrap();
