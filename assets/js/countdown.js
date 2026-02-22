import { getCountdownEvents } from "./public-api.js";
import { FEATURED_COUNTDOWN_SLUG, FALLBACK_COUNTDOWN_EVENTS, onlyFutureEvents, sortCountdownEvents } from "./countdown-data.js";
import { formatCountdown, formatTargetDate } from "./countdown-core.js";

const featuredEl = document.getElementById("featuredCountdown");
const listEl = document.getElementById("countdownList");
const statusEl = document.getElementById("countdownStatus");

let currentEvents = [];
let timer = null;

function renderCard(event, isFeatured = false) {
  return `
    <a href="countdown-detail.html?id=${encodeURIComponent(event.slug)}" class="block border-2 border-black ${isFeatured ? "bg-black text-white p-6 md:p-8" : "bg-white p-4"} shadow-brutal lift transition-all">
      <p class="text-xs uppercase font-bold ${isFeatured ? "text-marker" : "text-accent"}">${event.title}</p>
      <h3 class="${isFeatured ? "headline text-5xl mt-2" : "headline text-3xl mt-2"}">${isFeatured ? "Countdown principale" : "Countdown"}</h3>
      <p data-countdown-value="${event.slug}" class="${isFeatured ? "mt-4 text-2xl font-bold" : "mt-3 text-lg font-bold"}">${formatCountdown(event.target_at)}</p>
      <p class="${isFeatured ? "mt-3 text-sm opacity-80" : "mt-2 text-xs uppercase font-semibold text-slate-500"}">${formatTargetDate(event.target_at)}</p>
    </a>
  `;
}

function updateCountdownValues() {
  currentEvents.forEach((event) => {
    const node = document.querySelector(`[data-countdown-value="${event.slug}"]`);
    if (node) node.textContent = formatCountdown(event.target_at);
  });
}

function mountTicker() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    currentEvents = onlyFutureEvents(currentEvents);
    if (!currentEvents.length) {
      if (featuredEl) featuredEl.innerHTML = "";
      if (listEl) listEl.innerHTML = '<div class="border-2 border-black bg-white p-4">Nessun countdown futuro disponibile.</div>';
      if (statusEl) statusEl.classList.add("hidden");
      clearInterval(timer);
      return;
    }
    updateCountdownValues();
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
  const loaded = await loadEvents();
  const future = sortCountdownEvents(onlyFutureEvents(loaded));
  currentEvents = future;

  if (!future.length) {
    featuredEl.innerHTML = "";
    listEl.innerHTML = '<div class="border-2 border-black bg-white p-4">Nessun countdown futuro disponibile.</div>';
    return;
  }

  const featured = future.find((event) => event.slug === FEATURED_COUNTDOWN_SLUG || event.featured) || future[0];
  const others = future.filter((event) => event.slug !== featured.slug);

  featuredEl.innerHTML = renderCard(featured, true);
  listEl.innerHTML = others.length
    ? others.map((event) => renderCard(event)).join("")
    : '<div class="border-2 border-black bg-white p-4">Nessun altro countdown futuro.</div>';

  if (statusEl) {
    statusEl.textContent = "Mostrati solo eventi futuri (fuso Europe/Rome).";
    statusEl.classList.remove("hidden");
  }

  mountTicker();
}

bootstrap();

