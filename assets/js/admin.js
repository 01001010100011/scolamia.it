import { escapeHtml, formatLocalDate, supabase, toSlugSafeName } from "./supabase-client.js?v=20260224e";
import { buildAgendaSlugMap, getAgendaSlug } from "./agenda-url.js?v=20260303a";
import { buildCountdownUrl } from "./countdown-url.js?v=20260303a";
import { ensureSiteSettingsRow, saveSiteSettings } from "./site-settings.js?v=20260312a";

const REQUIRE_LOGIN_ON_EACH_VISIT = false;

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const adminStatus = document.getElementById("adminStatus");

const articlesSection = document.getElementById("articlesSection");
const countdownSection = document.getElementById("countdownSection");
const agendaSection = document.getElementById("agendaSection");
const articlesView = document.getElementById("articlesView");
const featuredView = document.getElementById("featuredView");

const openContentArticlesBtn = document.getElementById("openContentArticlesBtn");
const openContentCountdownBtn = document.getElementById("openContentCountdownBtn");
const openContentAgendaBtn = document.getElementById("openContentAgendaBtn");
const openArticlesViewBtn = document.getElementById("openArticlesViewBtn");
const openFeaturedViewBtn = document.getElementById("openFeaturedViewBtn");
const newItemBtn = document.getElementById("newItemBtn");
const logoutBtn = document.getElementById("logoutBtn");
const maintenanceActiveBanner = document.getElementById("maintenanceActiveBanner");
const maintenanceModeInput = document.getElementById("maintenanceModeInput");
const maintenanceModeSaveBtn = document.getElementById("maintenanceModeSaveBtn");
const maintenanceModeHint = document.getElementById("maintenanceModeHint");

const editContextBanner = document.getElementById("editContextBanner");
const editContextType = document.getElementById("editContextType");
const editContextTitle = document.getElementById("editContextTitle");
const editContextMeta = document.getElementById("editContextMeta");
const editContextBackBtn = document.getElementById("editContextBackBtn");
const editContextSaveBtn = document.getElementById("editContextSaveBtn");
const editContextCancelBtn = document.getElementById("editContextCancelBtn");

const adminArticlesOnline = document.getElementById("adminArticlesOnline");
const adminArticlesDrafts = document.getElementById("adminArticlesDrafts");
const featuredManagerList = document.getElementById("featuredManagerList");

const countdownForm = document.getElementById("countdownForm");
const adminCountdowns = document.getElementById("adminCountdowns");
const newCountdownBtn = document.getElementById("newCountdownBtn");
const countdownSlugPreview = document.getElementById("countdownSlugPreview");

const agendaForm = document.getElementById("agendaForm");
const adminAgendaEvents = document.getElementById("adminAgendaEvents");
const agendaSlugPreview = document.getElementById("agendaSlugPreview");

let currentSection = "articles";
let currentArticleSubView = "articles";
let draggedFeaturedId = null;

let articles = [];
let countdowns = [];
let events = [];
let featuredIds = [];
let siteSettings = { id: 1, featuredArticleIds: [], maintenanceMode: false };

let activeContext = null;

function setLoginError(message = "") {
  if (!message) {
    loginError.classList.add("hidden");
    return;
  }
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function setAdminStatus(message = "") {
  if (!message) {
    adminStatus.classList.add("hidden");
    adminStatus.textContent = "";
    return;
  }
  adminStatus.textContent = message;
  adminStatus.classList.remove("hidden");
}

function authErrorMessage(error) {
  const raw = (error?.message || "").toLowerCase();
  if (raw.includes("email not confirmed")) return "Email non confermata. Conferma la mail dell'admin in Supabase Auth.";
  if (raw.includes("invalid login credentials")) return "Credenziali non valide.";
  if (raw.includes("network")) return "Errore di rete. Controlla connessione e riprova.";
  if (raw.includes("captcha")) return "Richiesta bloccata dal controllo di sicurezza (captcha).";
  return error?.message || "Errore durante l'accesso.";
}

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

function countdownSortValue(value) {
  const time = new Date(value || "").getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function normalizeCountdownEmoji(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return Array.from(trimmed).slice(0, 2).join("");
}

function isoToDateTimeLocal(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function countdownSlug(title, targetAt, existing = "") {
  if (existing) return existing;
  const base = toSlugSafeName(title || "countdown").replace(/^-+|-+$/g, "") || "countdown";
  const used = new Set((countdowns || []).map((item) => String(item.slug || "").trim()).filter(Boolean));
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

function renderCountdownSlugPreview() {
  if (!countdownSlugPreview) return;
  const id = String(document.getElementById("countdownId").value || "").trim();
  const title = String(document.getElementById("countdownTitle").value || "").trim();
  const existing = countdowns.find((item) => item.id === id);
  const slug = countdownSlug(title || "countdown", "", existing?.slug);
  const previewEvent = { slug };
  countdownSlugPreview.textContent = `${window.location.origin}${buildCountdownUrl(previewEvent)}`;
}

function renderAgendaSlugPreview() {
  if (!agendaSlugPreview) return;
  const id = String(document.getElementById("agendaEventId").value || "").trim() || "__agenda-preview__";
  const title = String(document.getElementById("agendaTitle").value || "").trim();
  if (!title) {
    agendaSlugPreview.textContent = `${window.location.origin}/agenda/{slug}/`;
    return;
  }

  const working = Array.isArray(events) ? [...events] : [];
  const idx = working.findIndex((item) => String(item?.id || "") === id);
  if (idx >= 0) {
    working[idx] = { ...working[idx], title };
  } else {
    working.push({ id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  const slugMap = buildAgendaSlugMap(working);
  const slug = getAgendaSlug({ id, title }, slugMap);
  agendaSlugPreview.textContent = `${window.location.origin}/agenda/${slug}/`;
}

function setEditContext(context) {
  activeContext = context;
  editContextBanner.classList.remove("hidden");
  editContextType.textContent = `Stai modificando: ${context.type}`;
  editContextTitle.textContent = context.title || "";
  editContextMeta.textContent = context.meta || "";
}

function clearEditContext() {
  activeContext = null;
  editContextBanner.classList.add("hidden");
  editContextType.textContent = "";
  editContextTitle.textContent = "";
  editContextMeta.textContent = "";
}

function setContentSection(section) {
  currentSection = section;
  clearEditContext();
  const showArticles = section === "articles";
  const showCountdown = section === "countdown";
  const showAgenda = section === "agenda";

  articlesSection.classList.toggle("hidden", !showArticles);
  countdownSection.classList.toggle("hidden", !showCountdown);
  agendaSection.classList.toggle("hidden", !showAgenda);

  openContentArticlesBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showArticles ? "bg-black text-white" : "bg-white"}`;
  openContentCountdownBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showCountdown ? "bg-black text-white" : "bg-white"}`;
  openContentAgendaBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showAgenda ? "bg-black text-white" : "bg-white"}`;

  if (showArticles) newItemBtn.textContent = "Nuovo articolo";
  if (showCountdown) newItemBtn.textContent = "Nuovo countdown";
  if (showAgenda) newItemBtn.textContent = "Nuovo evento";
}

function setArticleSubView(view) {
  currentArticleSubView = view;
  const showEdit = view === "articles";
  articlesView.classList.toggle("hidden", !showEdit);
  featuredView.classList.toggle("hidden", showEdit);
  openArticlesViewBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showEdit ? "bg-black text-white" : "bg-white"}`;
  openFeaturedViewBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showEdit ? "bg-white" : "bg-black text-white"}`;
  if (showEdit) clearEditContext();
}

async function ensureCurrentUserIsAdmin() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id,role,active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data && data.role === "admin");
}

function sanitizeFeaturedIds() {
  const valid = new Set(articles.filter((item) => item.published).map((item) => item.id));
  featuredIds = featuredIds.filter((id) => valid.has(id));
}

function getAutoFeaturedIds() {
  return articles
    .filter((item) => item.published)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((item) => item.id)
    .slice(0, 3);
}

function getEffectiveFeaturedIds() {
  return featuredIds.length ? [...featuredIds] : getAutoFeaturedIds();
}

async function upsertFeaturedIds() {
  siteSettings = await saveSiteSettings({ featuredArticleIds: featuredIds });
}

async function loadData() {
  const [
    { data: articleData, error: articleError },
    { data: countdownData, error: countdownError },
    { data: eventData, error: eventError },
    settings
  ] = await Promise.all([
    supabase
      .from("articles")
      .select("id,title,category,excerpt,published,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("countdowns")
      .select("id,slug,title,emoji,target_at,is_featured,active,created_at,updated_at")
      .order("is_featured", { ascending: false })
      .order("target_at", { ascending: true }),
    supabase
      .from("agenda_events")
      .select("id,title,category,date,description,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    ensureSiteSettingsRow()
  ]);

  if (articleError) throw articleError;
  if (countdownError) throw countdownError;
  if (eventError) throw eventError;

  articles = articleData || [];
  countdowns = countdownData || [];
  events = (eventData || []).sort((a, b) => agendaSortValue(a.date) - agendaSortValue(b.date));
  siteSettings = settings;
  featuredIds = [...siteSettings.featuredArticleIds];
  sanitizeFeaturedIds();
}

function renderMaintenanceUi() {
  if (maintenanceModeInput) {
    maintenanceModeInput.checked = Boolean(siteSettings.maintenanceMode);
  }

  if (maintenanceModeHint) {
    maintenanceModeHint.textContent = siteSettings.maintenanceMode
      ? "Il sito pubblico e bloccato e reindirizzato a /manutenzione. Admin, sitemap e canale WhatsApp restano raggiungibili."
      : "Quando attivi la manutenzione, quasi tutto il sito pubblico viene bloccato. L'area admin resta pienamente accessibile.";
  }

  if (maintenanceActiveBanner) {
    maintenanceActiveBanner.classList.toggle("hidden", !siteSettings.maintenanceMode);
  }
}

function articleRow(article) {
  const statusLabel = article.published ? "Online" : "Bozza";
  const statusClass = article.published ? "text-emerald-700" : "text-amber-700";
  return `
    <article class="border-2 border-black p-4">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <p class="text-xs uppercase font-bold text-accent">${escapeHtml(article.category || "Senza categoria")}</p>
          <h4 class="text-lg font-semibold">${escapeHtml(article.title)}</h4>
          <p class="text-xs mt-2">Ultimo aggiornamento: ${new Date(article.updated_at).toLocaleString("it-IT")} | Stato: <span class="font-bold ${statusClass}">${statusLabel}</span></p>
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <a href="/admin-article-editor/?id=${encodeURIComponent(article.id)}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">Modifica</a>
          <button data-article-action="toggle" data-id="${article.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">${article.published ? "Sposta in bozze" : "Pubblica"}</button>
          <button data-article-action="delete" data-id="${article.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase text-red-700">Elimina</button>
        </div>
      </div>
    </article>
  `;
}

function renderAdminArticles() {
  const online = articles.filter((item) => item.published);
  const drafts = articles.filter((item) => !item.published);

  adminArticlesOnline.innerHTML = online.length
    ? online.map(articleRow).join("")
    : '<p class="text-sm">Nessun articolo online.</p>';

  adminArticlesDrafts.innerHTML = drafts.length
    ? drafts.map(articleRow).join("")
    : '<p class="text-sm">Nessuna bozza presente.</p>';
}

function renderFeaturedManager() {
  const published = articles.filter((item) => item.published);
  const effectiveFeaturedIds = getEffectiveFeaturedIds();
  const usingAutoFallback = featuredIds.length === 0;

  if (!published.length) {
    featuredManagerList.innerHTML = '<p class="text-sm">Non ci sono articoli pubblicati da mettere in evidenza.</p>';
    return;
  }

  const featuredSet = new Set(effectiveFeaturedIds);
  const featuredArticles = effectiveFeaturedIds.map((id) => published.find((item) => item.id === id)).filter(Boolean);

  const orderHtml = featuredArticles.length
    ? featuredArticles.map((article, index) => `
      <article draggable="true" data-drag-id="${article.id}" class="border-2 border-black bg-yellow-100 p-3 cursor-move">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-xs uppercase font-bold text-accent">${escapeHtml(article.category)}</p>
            <h4 class="font-semibold">${escapeHtml(article.title)}</h4>
            <p class="text-xs mt-1 text-amber-700">★ In evidenza #${index + 1}${usingAutoFallback ? " (auto recenti)" : ""}</p>
          </div>
          <button data-feature-action="remove" data-id="${article.id}" class="border-2 border-black px-2 py-1 text-[10px] font-bold uppercase bg-white">Rimuovi</button>
        </div>
      </article>
    `).join("")
    : '<p class="text-sm">Nessun articolo selezionato.</p>';

  const allHtml = published.map((article) => {
    const selected = featuredSet.has(article.id);
    return `
      <article class="border-2 border-black p-3 ${selected ? "bg-yellow-100" : "bg-white"}">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-xs uppercase font-bold text-accent">${escapeHtml(article.category)}</p>
            <h4 class="font-semibold">${escapeHtml(article.title)}</h4>
            <p class="text-xs mt-1 ${selected ? "text-amber-700 font-semibold" : "text-slate-500"}">${selected ? "★ Già in evidenza" : "○ Non in evidenza"}</p>
          </div>
          <button data-feature-action="${selected ? "remove" : "add"}" data-id="${article.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase ${selected ? "bg-white" : "bg-accent text-white"}">${selected ? "Rimuovi" : "Aggiungi"}</button>
        </div>
      </article>
    `;
  }).join("");

  featuredManagerList.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4">
      <section class="border-2 border-black p-4">
        <h4 class="text-xs font-bold uppercase mb-2">Ordine in evidenza (drag & drop)</h4>
        <p class="text-[11px] text-slate-600 mb-2">${usingAutoFallback ? "Nessuna evidenza manuale salvata: qui vedi il fallback automatico dei 3 articoli piu recenti." : "Stai gestendo l'ordine manuale degli articoli in evidenza."}</p>
        <div id="featuredOrderList" class="space-y-2">${orderHtml}</div>
      </section>
      <section class="border-2 border-black p-4">
        <h4 class="text-xs font-bold uppercase mb-2">Tutti gli articoli pubblicati</h4>
        <div class="space-y-2">${allHtml}</div>
      </section>
    </div>
  `;
}

function resetCountdownForm() {
  countdownForm.reset();
  document.getElementById("countdownId").value = "";
  document.getElementById("countdownEmoji").value = "";
  document.getElementById("countdownActive").checked = true;
  document.getElementById("countdownIsFeatured").checked = false;
  document.getElementById("submitCountdownBtn").textContent = "Salva Countdown";
  renderCountdownSlugPreview();
}

function startNewCountdown() {
  setContentSection("countdown");
  resetCountdownForm();
  setEditContext({
    type: "Countdown",
    title: "Nuovo countdown",
    meta: "ID: non assegnato | Stato: bozza locale",
    onSave: () => countdownForm.requestSubmit(),
    onCancel: () => {
      resetCountdownForm();
      clearEditContext();
    },
    onBack: () => {
      resetCountdownForm();
      clearEditContext();
    }
  });
  document.getElementById("countdownTitle").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillCountdownForm(item) {
  setContentSection("countdown");
  document.getElementById("countdownId").value = item.id;
  document.getElementById("countdownTitle").value = item.title;
  document.getElementById("countdownEmoji").value = item.emoji || "";
  document.getElementById("countdownTargetAt").value = isoToDateTimeLocal(item.target_at);
  document.getElementById("countdownIsFeatured").checked = Boolean(item.is_featured);
  document.getElementById("countdownActive").checked = Boolean(item.active);
  document.getElementById("submitCountdownBtn").textContent = "Aggiorna Countdown";
  renderCountdownSlugPreview();

  setEditContext({
    type: "Countdown",
    title: `${item.emoji ? `${item.emoji} ` : ""}${item.title}`,
    meta: `Slug: ${item.slug || "-"} | Stato: ${item.active ? "Online" : "Disattivo"}`,
    onSave: () => countdownForm.requestSubmit(),
    onCancel: () => {
      resetCountdownForm();
      clearEditContext();
    },
    onBack: () => {
      resetCountdownForm();
      clearEditContext();
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAdminCountdowns() {
  if (!countdowns.length) {
    adminCountdowns.innerHTML = '<p class="text-sm">Nessun countdown presente.</p>';
    return;
  }

  const sorted = [...countdowns].sort((a, b) => {
    if (a.is_featured === b.is_featured) return countdownSortValue(a.target_at) - countdownSortValue(b.target_at);
    return a.is_featured ? -1 : 1;
  });

  adminCountdowns.innerHTML = sorted.map((item) => `
    <article class="border-2 border-black p-4">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h4 class="text-lg font-semibold">${escapeHtml(item.emoji ? `${item.emoji} ${item.title}` : item.title)}</h4>
          <p class="text-sm mt-1">Data target: ${new Date(item.target_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p class="text-xs mt-2">
            ID: ${item.id} | Slug: ${item.slug || "-"} | Stato: ${item.active ? "Online" : "Disattivo"}
            ${item.is_featured ? " | In evidenza principale" : ""}
          </p>
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <button data-countdown-action="edit" data-id="${item.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">Modifica</button>
          <button data-countdown-action="delete" data-id="${item.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase text-red-700">Elimina</button>
        </div>
      </div>
    </article>
  `).join("");
}

function resetAgendaForm() {
  agendaForm.reset();
  document.getElementById("agendaEventId").value = "";
  document.getElementById("submitAgendaBtn").textContent = "Salva Evento";
  renderAgendaSlugPreview();
}

function startNewEvent() {
  setContentSection("agenda");
  resetAgendaForm();
  setEditContext({
    type: "Evento agenda",
    title: "Nuovo evento",
    meta: "ID: non assegnato",
    onSave: () => agendaForm.requestSubmit(),
    onCancel: () => {
      resetAgendaForm();
      clearEditContext();
    },
    onBack: () => {
      resetAgendaForm();
      clearEditContext();
    }
  });
  document.getElementById("agendaTitle").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillAgendaForm(item) {
  setContentSection("agenda");
  document.getElementById("agendaEventId").value = item.id;
  document.getElementById("agendaTitle").value = item.title;
  document.getElementById("agendaCategory").value = item.category;
  document.getElementById("agendaDate").value = normalizeAgendaDateInput(item.date);
  document.getElementById("agendaDescription").value = item.description;
  document.getElementById("submitAgendaBtn").textContent = "Aggiorna Evento";
  renderAgendaSlugPreview();

  setEditContext({
    type: "Evento agenda",
    title: item.title,
    meta: `ID: ${item.id} | Data: ${formatLocalDate(normalizeAgendaDateInput(item.date)) || "-"}`,
    onSave: () => agendaForm.requestSubmit(),
    onCancel: () => {
      resetAgendaForm();
      clearEditContext();
    },
    onBack: () => {
      resetAgendaForm();
      clearEditContext();
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAdminAgendaEvents() {
  if (!events.length) {
    adminAgendaEvents.innerHTML = '<p class="text-sm">Nessun evento presente.</p>';
    return;
  }

  adminAgendaEvents.innerHTML = events.map((item) => `
    <article class="border-2 border-black p-4">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <p class="text-xs uppercase font-bold text-accent">${escapeHtml(item.category)}</p>
          <h4 class="text-lg font-semibold">${escapeHtml(item.title)}</h4>
          <p class="text-sm mt-1">${escapeHtml(item.description)}</p>
          <p class="text-xs mt-2">ID: ${item.id} | Data: ${formatLocalDate(normalizeAgendaDateInput(item.date)) || "Data non valida"}</p>
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <button data-agenda-action="edit" data-id="${item.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">Modifica</button>
          <button data-agenda-action="delete" data-id="${item.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase text-red-700">Elimina</button>
        </div>
      </div>
    </article>
  `).join("");
}

async function handleAuthUi() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const isAuth = Boolean(data?.session);
  loginBox.classList.toggle("hidden", isAuth);
  adminPanel.classList.toggle("hidden", !isAuth);

  if (!isAuth) {
    setAdminStatus("");
    setLoginError("");
    setContentSection("articles");
    setArticleSubView("articles");
    clearEditContext();
    return false;
  }

  try {
    const isAdmin = await ensureCurrentUserIsAdmin();
    if (!isAdmin) {
      await supabase.auth.signOut({ scope: "local" });
      loginBox.classList.remove("hidden");
      adminPanel.classList.add("hidden");
      setLoginError("Utente autenticato ma non autorizzato: assegna ruolo admin in Supabase (tabella admin_users).");
      return false;
    }

    await loadData();
    renderAdminArticles();
    renderFeaturedManager();
    renderAdminCountdowns();
    renderAdminAgendaEvents();
    renderMaintenanceUi();
    renderCountdownSlugPreview();
    renderAgendaSlugPreview();
    setAdminStatus("");
  } catch (err) {
    console.error(err);
    setAdminStatus("Login riuscito, ma errore nel caricamento dati admin (controlla schema/policy Supabase).");
  }

  return true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const submitBtn = loginForm.querySelector("button[type='submit']");
  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Accesso...";
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(authErrorMessage(error));
      return;
    }
    await handleAuthUi();
  } catch (err) {
    console.error(err);
    setLoginError(authErrorMessage(err));
  } finally {
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Accedi";
    }
  }
});

maintenanceModeSaveBtn?.addEventListener("click", async () => {
  if (!(maintenanceModeInput instanceof HTMLInputElement)) return;

  maintenanceModeSaveBtn.disabled = true;
  const originalLabel = maintenanceModeSaveBtn.textContent;
  maintenanceModeSaveBtn.textContent = "Salvataggio...";

  try {
    siteSettings = await saveSiteSettings({ maintenanceMode: maintenanceModeInput.checked });
    featuredIds = [...siteSettings.featuredArticleIds];
    renderMaintenanceUi();
    setAdminStatus(
      siteSettings.maintenanceMode
        ? "Modalita manutenzione attivata. Il sito pubblico verra bloccato."
        : "Modalita manutenzione disattivata. Il sito pubblico torna accessibile."
    );
  } catch (error) {
    console.error(error);
    maintenanceModeInput.checked = Boolean(siteSettings.maintenanceMode);
    alert("Impossibile aggiornare la modalita manutenzione.");
  } finally {
    maintenanceModeSaveBtn.disabled = false;
    maintenanceModeSaveBtn.textContent = originalLabel;
  }
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await handleAuthUi();
});

openContentArticlesBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  setContentSection("articles");
  setArticleSubView("articles");
});

openContentCountdownBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  setContentSection("countdown");
  renderAdminCountdowns();
});

openContentAgendaBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  setContentSection("agenda");
  renderAdminAgendaEvents();
});

openArticlesViewBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  setArticleSubView("articles");
});

openFeaturedViewBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  setArticleSubView("featured");
  renderFeaturedManager();
  clearEditContext();
});

newItemBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  if (currentSection === "articles") {
    window.location.href = "/admin-article-editor/?mode=new";
    return;
  }
  if (currentSection === "countdown") {
    startNewCountdown();
    return;
  }
  startNewEvent();
});

newCountdownBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  startNewCountdown();
});

document.getElementById("countdownTitle")?.addEventListener("input", renderCountdownSlugPreview);
document.getElementById("countdownId")?.addEventListener("change", renderCountdownSlugPreview);
document.getElementById("agendaTitle")?.addEventListener("input", renderAgendaSlugPreview);
document.getElementById("agendaEventId")?.addEventListener("change", renderAgendaSlugPreview);

editContextSaveBtn?.addEventListener("click", () => {
  if (activeContext?.onSave) activeContext.onSave();
});

editContextCancelBtn?.addEventListener("click", () => {
  if (activeContext?.onCancel) activeContext.onCancel();
});

editContextBackBtn?.addEventListener("click", () => {
  if (activeContext?.onBack) activeContext.onBack();
});

countdownForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const id = document.getElementById("countdownId").value || crypto.randomUUID();
    const now = new Date().toISOString();
    const title = document.getElementById("countdownTitle").value.trim();
    const emoji = normalizeCountdownEmoji(document.getElementById("countdownEmoji").value);
    const targetAtIso = dateTimeLocalToIso(document.getElementById("countdownTargetAt").value);
    const isFeatured = document.getElementById("countdownIsFeatured").checked;
    const active = document.getElementById("countdownActive").checked;

    if (!title) throw new Error("Titolo countdown obbligatorio.");
    if (!targetAtIso) throw new Error("Data target non valida.");

    const existing = countdowns.find((item) => item.id === id);
    const payload = {
      id,
      slug: countdownSlug(title, targetAtIso, existing?.slug),
      title,
      emoji,
      target_at: targetAtIso,
      is_featured: isFeatured,
      active,
      updated_at: now
    };

    if (!existing) payload.created_at = now;

    if (isFeatured) {
      const { error: clearFeaturedError } = await supabase
        .from("countdowns")
        .update({ is_featured: false, updated_at: now })
        .neq("id", id);
      if (clearFeaturedError) throw clearFeaturedError;
    }

    const { error } = await supabase.from("countdowns").upsert(payload, { onConflict: "id" });
    if (error) throw error;

    await loadData();
    renderAdminCountdowns();
    resetCountdownForm();
    clearEditContext();
    setAdminStatus("Countdown salvato correttamente.");
  } catch (err) {
    console.error(err);
    alert(err?.message || "Errore durante il salvataggio del countdown.");
  }
});

agendaForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const id = document.getElementById("agendaEventId").value || crypto.randomUUID();
    const now = new Date().toISOString();

    const payload = {
      id,
      title: document.getElementById("agendaTitle").value.trim(),
      category: document.getElementById("agendaCategory").value.trim(),
      date: document.getElementById("agendaDate").value,
      description: document.getElementById("agendaDescription").value.trim(),
      updated_at: now
    };

    if (!events.find((item) => item.id === id)) payload.created_at = now;

    const { error } = await supabase.from("agenda_events").upsert(payload, { onConflict: "id" });
    if (error) throw error;

    await loadData();
    renderAdminAgendaEvents();
    resetAgendaForm();
    clearEditContext();
    setAdminStatus("Evento agenda salvato correttamente.");
  } catch (err) {
    console.error(err);
    alert("Errore durante il salvataggio dell'evento.");
  }
});

adminArticlesOnline.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.articleAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const article = articles.find((item) => item.id === id);
  if (!article) return;

  try {
    if (action === "toggle") {
      const { error } = await supabase
        .from("articles")
        .update({ published: !article.published, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await loadData();
      renderAdminArticles();
      renderFeaturedManager();
      return;
    }

    if (action === "delete") {
      if (!confirm("Vuoi eliminare definitivamente questo articolo?")) return;
      const { error } = await supabase.from("articles").delete().eq("id", id);
      if (error) throw error;
      await loadData();
      renderAdminArticles();
      renderFeaturedManager();
    }
  } catch (err) {
    console.error(err);
    alert("Errore operazione articolo.");
  }
});

adminArticlesDrafts.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.articleAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const article = articles.find((item) => item.id === id);
  if (!article) return;

  try {
    if (action === "toggle") {
      const { error } = await supabase
        .from("articles")
        .update({ published: !article.published, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await loadData();
      renderAdminArticles();
      renderFeaturedManager();
      return;
    }

    if (action === "delete") {
      if (!confirm("Vuoi eliminare definitivamente questo articolo?")) return;
      const { error } = await supabase.from("articles").delete().eq("id", id);
      if (error) throw error;
      await loadData();
      renderAdminArticles();
      renderFeaturedManager();
    }
  } catch (err) {
    console.error(err);
    alert("Errore operazione articolo.");
  }
});

adminCountdowns.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.countdownAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const item = countdowns.find((countdown) => countdown.id === id);
  if (!item) return;

  try {
    if (action === "edit") {
      fillCountdownForm(item);
      return;
    }

    if (action === "delete") {
      if (!confirm("Vuoi eliminare definitivamente questo countdown?")) return;
      const { error } = await supabase.from("countdowns").delete().eq("id", id);
      if (error) throw error;
      await loadData();
      renderAdminCountdowns();
      clearEditContext();
    }
  } catch (err) {
    console.error(err);
    alert("Errore operazione countdown.");
  }
});

adminAgendaEvents.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.agendaAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const item = events.find((eventItem) => eventItem.id === id);
  if (!item) return;

  try {
    if (action === "edit") {
      fillAgendaForm(item);
      return;
    }

    if (action === "delete") {
      if (!confirm("Vuoi eliminare definitivamente questo evento?")) return;
      const { error } = await supabase.from("agenda_events").delete().eq("id", id);
      if (error) throw error;
      await loadData();
      renderAdminAgendaEvents();
      clearEditContext();
    }
  } catch (err) {
    console.error(err);
    alert("Errore operazione agenda.");
  }
});

featuredManagerList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.featureAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const isPublished = articles.some((item) => item.id === id && item.published);
  if (!isPublished) return;

  const working = getEffectiveFeaturedIds();
  const index = working.indexOf(id);
  if (action === "add" && index === -1) working.push(id);
  if (action === "remove" && index >= 0) working.splice(index, 1);
  featuredIds = working;

  try {
    await upsertFeaturedIds();
    renderFeaturedManager();
  } catch (err) {
    console.error(err);
    alert("Errore salvataggio evidenza.");
  }
});

function reorderFeaturedByDrag(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const working = getEffectiveFeaturedIds();
  const from = working.indexOf(fromId);
  const to = working.indexOf(toId);
  if (from < 0 || to < 0) return;

  const copy = [...working];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  featuredIds = copy;
}

featuredManagerList.addEventListener("dragstart", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const card = target.closest("[data-drag-id]");
  if (!(card instanceof HTMLElement)) return;

  draggedFeaturedId = card.dataset.dragId || null;
  if (event.dataTransfer && draggedFeaturedId) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedFeaturedId);
  }
  card.classList.add("opacity-60");
});

featuredManagerList.addEventListener("dragover", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const card = target.closest("[data-drag-id]");
  if (!(card instanceof HTMLElement)) return;

  event.preventDefault();
  featuredManagerList.querySelectorAll("[data-drag-id]").forEach((item) => item.classList.remove("ring-2", "ring-accent"));
  card.classList.add("ring-2", "ring-accent");
});

featuredManagerList.addEventListener("drop", async (event) => {
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const card = target.closest("[data-drag-id]");
  if (!(card instanceof HTMLElement)) return;

  reorderFeaturedByDrag(draggedFeaturedId, card.dataset.dragId || null);
  draggedFeaturedId = null;

  try {
    await upsertFeaturedIds();
    renderFeaturedManager();
  } catch (err) {
    console.error(err);
    alert("Errore riordino evidenza.");
  }
});

featuredManagerList.addEventListener("dragend", () => {
  draggedFeaturedId = null;
  featuredManagerList.querySelectorAll("[data-drag-id]").forEach((item) => item.classList.remove("opacity-60", "ring-2", "ring-accent"));
});

supabase.auth.onAuthStateChange(() => {
  handleAuthUi().catch((err) => {
    console.error(err);
    setLoginError("Errore sincronizzazione sessione.");
  });
});

async function bootstrapAdmin() {
  resetCountdownForm();
  resetAgendaForm();

  if (REQUIRE_LOGIN_ON_EACH_VISIT) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.error(err);
    }
  }

  await handleAuthUi();
}

bootstrapAdmin().catch((err) => {
  console.error(err);
  setLoginError("Errore inizializzazione admin.");
});
