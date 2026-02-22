import { getCountdownEventBySlug } from "./public-api.js";
import { FALLBACK_COUNTDOWN_EVENTS } from "./countdown-data.js";
import { formatTargetDate, getRemainingParts } from "./countdown-core.js";

const titleEl = document.getElementById("countdownTitle");
const targetEl = document.getElementById("countdownTarget");
const statusEl = document.getElementById("countdownDetailStatus");
const valuesWrap = document.getElementById("countdownValues");
const daysEl = document.getElementById("valueDays");
const hoursEl = document.getElementById("valueHours");
const minutesEl = document.getElementById("valueMinutes");
const secondsEl = document.getElementById("valueSeconds");

let timer = null;

function stopTicker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function setExpiredState() {
  stopTicker();
  statusEl.textContent = "Evento concluso";
  statusEl.classList.remove("hidden");
  valuesWrap.classList.add("opacity-40");
}

function renderTick(event) {
  const parts = getRemainingParts(event.target_at);
  if (!parts) {
    setExpiredState();
    return;
  }
  daysEl.textContent = String(parts.days);
  hoursEl.textContent = String(parts.hours).padStart(2, "0");
  minutesEl.textContent = String(parts.minutes).padStart(2, "0");
  secondsEl.textContent = String(parts.seconds).padStart(2, "0");
}

async function loadEvent(slug) {
  try {
    const dbEvent = await getCountdownEventBySlug(slug);
    if (dbEvent) return dbEvent;
  } catch (error) {
    console.warn("Fallback dettaglio countdown:", error);
  }
  return FALLBACK_COUNTDOWN_EVENTS.find((event) => event.slug === slug) || null;
}

async function bootstrap() {
  const slug = new URLSearchParams(window.location.search).get("id");
  if (!slug) {
    statusEl.textContent = "Countdown non trovato.";
    statusEl.classList.remove("hidden");
    valuesWrap.classList.add("hidden");
    return;
  }

  const event = await loadEvent(slug);
  if (!event) {
    statusEl.textContent = "Countdown non trovato.";
    statusEl.classList.remove("hidden");
    valuesWrap.classList.add("hidden");
    return;
  }

  titleEl.textContent = event.title;
  targetEl.textContent = `Target: ${formatTargetDate(event.target_at)}`;
  renderTick(event);

  timer = setInterval(() => renderTick(event), 1000);
}

bootstrap();

