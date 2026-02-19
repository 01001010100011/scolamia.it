import { getAgendaEvents } from "./public-api.js";
import { formatLocalDate } from "./supabase-client.js";

const listEl = document.getElementById("agendaList");
const searchInput = document.getElementById("agendaSearchInput");
let events = [];

function normalizeAgendaDateInput(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (iso) return iso[1];
  const dmy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return "";
}

function agendaSortValue(value) {
  const normalized = normalizeAgendaDateInput(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const time = new Date(`${normalized}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function render(query = "") {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? events
    : events.filter((event) => `${event.date} ${event.title} ${event.category} ${event.description}`.toLowerCase().includes(q));

  listEl.innerHTML = filtered.length
    ? filtered.map((event) => `
        <article class="border-2 border-black bg-white p-4 shadow-brutal">
          <p class="text-xs uppercase font-bold text-accent">${event.category}</p>
          <h3 class="mt-2 text-lg font-semibold">${event.title}</h3>
          <p class="mt-2 text-sm">${event.description}</p>
          <p class="mt-3 text-[11px] uppercase font-bold text-slate-500">${formatLocalDate(normalizeAgendaDateInput(event.date)) || "Data non valida"}</p>
        </article>
      `).join("")
    : '<div class="md:col-span-3 border-2 border-black bg-white p-4">Nessun evento trovato per questa ricerca.</div>';
}

async function bootstrap() {
  try {
    events = await getAgendaEvents();
    events = events.sort((a, b) => agendaSortValue(a.date) - agendaSortValue(b.date));
  } catch (error) {
    console.error(error);
    listEl.innerHTML = '<div class="md:col-span-3 border-2 border-black bg-white p-4">Errore caricamento agenda.</div>';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";
  searchInput.value = initialQuery;

  document.getElementById("agendaSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const url = query ? `agenda.html?q=${encodeURIComponent(query)}` : "agenda.html";
    history.replaceState(null, "", url);
    render(query);
  });

  searchInput.addEventListener("input", () => render(searchInput.value));
  render(initialQuery);
}

bootstrap();
