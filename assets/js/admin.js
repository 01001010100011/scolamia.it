import { escapeHtml, formatLocalDate, supabase, toSlugSafeName } from "./supabase-client.js";

const BUCKET = "article-media";
const REQUIRE_LOGIN_ON_EACH_VISIT = true;

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const adminStatus = document.getElementById("adminStatus");

const articleForm = document.getElementById("articleForm");
const adminArticles = document.getElementById("adminArticles");
const featuredManagerList = document.getElementById("featuredManagerList");

const articleImageInput = document.getElementById("articleImageInput");
const articleImagePreview = document.getElementById("articleImagePreview");
const removeArticleImageBtn = document.getElementById("removeArticleImageBtn");
const articleAttachmentInput = document.getElementById("articleAttachmentInput");
const articleAttachmentList = document.getElementById("articleAttachmentList");

const agendaForm = document.getElementById("agendaForm");
const adminAgendaEvents = document.getElementById("adminAgendaEvents");
const countdownForm = document.getElementById("countdownForm");
const adminCountdowns = document.getElementById("adminCountdowns");

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
const newCountdownBtn = document.getElementById("newCountdownBtn");

let currentSection = "articles";
let draggedFeaturedId = null;

let articles = [];
let countdowns = [];
let events = [];
let featuredIds = [];

let currentArticleImageUrl = "";
let currentArticleImagePath = "";
let currentArticleImageFile = null;
let currentArticleAttachments = [];

function setLoginError(message = "") {
  if (!message) {
    loginError.classList.add("hidden");
    return;
  }
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function setAdminStatus(message = "") {
  if (!adminStatus) return;
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
  const base = toSlugSafeName(title || "countdown").replace(/^-+|-+$/g, "");
  const stamp = new Date(targetAt || Date.now()).toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return `${base || "countdown"}-${stamp}`;
}

function setContentSection(section) {
  currentSection = section;
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
  const showEdit = view === "articles";
  articlesView.classList.toggle("hidden", !showEdit);
  featuredView.classList.toggle("hidden", showEdit);
  openArticlesViewBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showEdit ? "bg-black text-white" : "bg-white"}`;
  openFeaturedViewBtn.className = `border-2 border-black px-4 py-2 text-xs font-bold uppercase ${showEdit ? "bg-white" : "bg-black text-white"}`;
}

async function requireSettingsRow() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("id,featured_article_ids")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from("site_settings")
    .upsert({ id: 1, featured_article_ids: [] }, { onConflict: "id" })
    .select("id,featured_article_ids")
    .single();

  if (createError) throw createError;
  return created;
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

async function loadData() {
  const [{ data: articleData, error: articleError }, { data: countdownData, error: countdownError }, { data: eventData, error: eventError }, settings] = await Promise.all([
    supabase
      .from("articles")
      .select("id,title,category,excerpt,content,image_url,image_path,published,attachments,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("countdowns")
      .select("id,slug,title,target_at,is_featured,active,created_at,updated_at")
      .order("is_featured", { ascending: false })
      .order("target_at", { ascending: true }),
    supabase
      .from("agenda_events")
      .select("id,title,category,date,description,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    requireSettingsRow()
  ]);

  if (articleError) throw articleError;
  if (countdownError) throw countdownError;
  if (eventError) throw eventError;

  articles = articleData || [];
  countdowns = countdownData || [];
  events = (eventData || []).sort((a, b) => agendaSortValue(a.date) - agendaSortValue(b.date));
  featuredIds = Array.isArray(settings.featured_article_ids) ? settings.featured_article_ids : [];
  sanitizeFeaturedIds();
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

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function renderAttachmentList() {
  if (!currentArticleAttachments.length) {
    articleAttachmentList.innerHTML = '<p class="text-[11px] text-slate-600">Nessun allegato caricato.</p>';
    return;
  }

  articleAttachmentList.innerHTML = currentArticleAttachments.map((item) => `
    <div class="border-2 border-black p-2 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="text-xs font-semibold truncate">${escapeHtml(item.name)}</p>
        <p class="text-[11px] text-slate-600">${escapeHtml(item.type || "file")} • ${formatBytes(item.size || 0)} ${item._newFile ? "• da caricare" : ""}</p>
      </div>
      <button type="button" data-attachment-remove-id="${item.id}" class="border-2 border-black px-2 py-1 text-[10px] font-bold uppercase">Rimuovi</button>
    </div>
  `).join("");
}

function resetArticleForm() {
  articleForm.reset();
  document.getElementById("articleId").value = "";
  document.getElementById("published").checked = true;
  document.getElementById("submitArticleBtn").textContent = "Salva Articolo";

  currentArticleImageUrl = "";
  currentArticleImagePath = "";
  currentArticleImageFile = null;
  articleImageInput.value = "";
  articleImagePreview.classList.add("hidden");
  articleImagePreview.removeAttribute("src");
  removeArticleImageBtn.classList.add("hidden");

  currentArticleAttachments = [];
  articleAttachmentInput.value = "";
  renderAttachmentList();
}

function startNewArticle() {
  setContentSection("articles");
  setArticleSubView("articles");
  resetArticleForm();
  document.getElementById("title").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillArticleForm(article) {
  setContentSection("articles");
  setArticleSubView("articles");

  document.getElementById("articleId").value = article.id;
  document.getElementById("title").value = article.title;
  document.getElementById("category").value = article.category;
  document.getElementById("excerpt").value = article.excerpt;
  document.getElementById("content").value = article.content;
  document.getElementById("published").checked = article.published;
  document.getElementById("submitArticleBtn").textContent = "Aggiorna Articolo";

  currentArticleImageUrl = article.image_url || "";
  currentArticleImagePath = article.image_path || "";
  currentArticleImageFile = null;
  articleImageInput.value = "";
  if (currentArticleImageUrl) {
    articleImagePreview.src = currentArticleImageUrl;
    articleImagePreview.classList.remove("hidden");
    removeArticleImageBtn.classList.remove("hidden");
  } else {
    articleImagePreview.classList.add("hidden");
    articleImagePreview.removeAttribute("src");
    removeArticleImageBtn.classList.add("hidden");
  }

  currentArticleAttachments = Array.isArray(article.attachments) ? article.attachments.map((att) => ({ ...att })) : [];
  articleAttachmentInput.value = "";
  renderAttachmentList();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAdminArticles() {
  if (!articles.length) {
    adminArticles.innerHTML = '<p class="text-sm">Nessun articolo presente.</p>';
    return;
  }

  adminArticles.innerHTML = articles.map((article) => `
    <article class="border-2 border-black p-4">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          ${article.image_url ? `<img src="${article.image_url}" alt="Anteprima ${escapeHtml(article.title)}" class="w-20 h-20 object-cover border-2 border-black mb-2" />` : ""}
          <p class="text-xs uppercase font-bold text-accent">${escapeHtml(article.category)}</p>
          <h4 class="text-lg font-semibold">${escapeHtml(article.title)}</h4>
          <p class="text-sm mt-1">${escapeHtml(article.excerpt)}</p>
          <p class="text-xs mt-2">Ultimo aggiornamento: ${new Date(article.updated_at).toLocaleString("it-IT")} | Stato: ${article.published ? "Pubblicato" : "Bozza"} | Allegati: ${(article.attachments || []).length}</p>
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <a href="article.html?id=${encodeURIComponent(article.id)}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">Apri</a>
          <button data-action="edit" data-id="${article.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">Modifica</button>
          <button data-action="toggle" data-id="${article.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">${article.published ? "Sposta in bozza" : "Pubblica"}</button>
          <button data-action="delete" data-id="${article.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase text-red-700">Elimina</button>
        </div>
      </div>
    </article>
  `).join("");
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

function resetAgendaForm() {
  agendaForm.reset();
  document.getElementById("agendaEventId").value = "";
  document.getElementById("submitAgendaBtn").textContent = "Salva Evento";
}

function resetCountdownForm() {
  countdownForm.reset();
  document.getElementById("countdownId").value = "";
  document.getElementById("countdownActive").checked = true;
  document.getElementById("countdownIsFeatured").checked = false;
  document.getElementById("submitCountdownBtn").textContent = "Salva Countdown";
}

function startNewCountdown() {
  setContentSection("countdown");
  resetCountdownForm();
  document.getElementById("countdownTitle").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillCountdownForm(item) {
  setContentSection("countdown");
  document.getElementById("countdownId").value = item.id;
  document.getElementById("countdownTitle").value = item.title;
  document.getElementById("countdownTargetAt").value = isoToDateTimeLocal(item.target_at);
  document.getElementById("countdownIsFeatured").checked = Boolean(item.is_featured);
  document.getElementById("countdownActive").checked = Boolean(item.active);
  document.getElementById("submitCountdownBtn").textContent = "Aggiorna Countdown";
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
          <h4 class="text-lg font-semibold">${escapeHtml(item.title)}</h4>
          <p class="text-sm mt-1">Data target: ${new Date(item.target_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p class="text-xs mt-2">
            Stato: ${item.active ? "Attivo" : "Disattivo"}
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

function startNewEvent() {
  setContentSection("agenda");
  resetAgendaForm();
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
          <p class="text-xs mt-2">Data: ${formatLocalDate(normalizeAgendaDateInput(item.date)) || "Data non valida"}</p>
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <button data-agenda-action="edit" data-id="${item.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase">Modifica</button>
          <button data-agenda-action="delete" data-id="${item.id}" class="border-2 border-black px-3 py-1 text-xs font-bold uppercase text-red-700">Elimina</button>
        </div>
      </div>
    </article>
  `).join("");
}

async function upsertFeaturedIds() {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ id: 1, featured_article_ids: featuredIds }, { onConflict: "id" });
  if (error) throw error;
}

async function uploadToStorage(articleId, file, kind) {
  const stamp = Date.now();
  const cleanName = toSlugSafeName(file.name);
  const path = `articles/${articleId}/${kind}/${stamp}-${cleanName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function handleAuthUi() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data?.session;
  const isAuth = Boolean(session);

  loginBox.classList.toggle("hidden", isAuth);
  adminPanel.classList.toggle("hidden", !isAuth);
  if (!isAuth) {
    setAdminStatus("");
    setLoginError("");
  }

  if (!isAuth) {
    setContentSection("articles");
    setArticleSubView("articles");
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
    setAdminStatus("");
  } catch (error) {
    console.error(error);
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
  } catch (error) {
    console.error(error);
    setLoginError(authErrorMessage(error));
  } finally {
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Accedi";
    }
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
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
});

newItemBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  if (currentSection === "countdown") {
    startNewCountdown();
    return;
  }
  if (currentSection === "agenda") {
    startNewEvent();
    return;
  }
  startNewArticle();
});

newCountdownBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  startNewCountdown();
});

articleImageInput.addEventListener("change", () => {
  const file = articleImageInput.files?.[0];
  if (!file) return;
  currentArticleImageFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    const preview = typeof reader.result === "string" ? reader.result : "";
    if (!preview) return;
    currentArticleImageUrl = preview;
    articleImagePreview.src = preview;
    articleImagePreview.classList.remove("hidden");
    removeArticleImageBtn.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

removeArticleImageBtn.addEventListener("click", () => {
  currentArticleImageUrl = "";
  currentArticleImagePath = "";
  currentArticleImageFile = null;
  articleImageInput.value = "";
  articleImagePreview.classList.add("hidden");
  articleImagePreview.removeAttribute("src");
  removeArticleImageBtn.classList.add("hidden");
});

articleAttachmentInput.addEventListener("change", () => {
  const files = Array.from(articleAttachmentInput.files || []);
  if (!files.length) return;

  currentArticleAttachments = currentArticleAttachments.concat(
    files.map((file) => ({
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      _newFile: true,
      _file: file
    }))
  );

  articleAttachmentInput.value = "";
  renderAttachmentList();
});

articleAttachmentList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const removeId = target.dataset.attachmentRemoveId;
  if (!removeId) return;
  currentArticleAttachments = currentArticleAttachments.filter((item) => item.id !== removeId);
  renderAttachmentList();
});

articleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const now = new Date().toISOString();
    const id = document.getElementById("articleId").value || crypto.randomUUID();

    let imageUrl = currentArticleImageUrl;
    let imagePath = currentArticleImagePath;

    if (currentArticleImageFile) {
      const uploaded = await uploadToStorage(id, currentArticleImageFile, "images");
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
    }

    const attachments = [];
    for (const item of currentArticleAttachments) {
      if (item._newFile && item._file) {
        const uploaded = await uploadToStorage(id, item._file, "attachments");
        attachments.push({
          id: crypto.randomUUID(),
          name: item.name,
          type: item.type,
          size: item.size,
          path: uploaded.path,
          url: uploaded.url
        });
      } else {
        attachments.push({
          id: item.id,
          name: item.name,
          type: item.type,
          size: item.size,
          path: item.path,
          url: item.url
        });
      }
    }

    const payload = {
      id,
      title: document.getElementById("title").value.trim(),
      category: document.getElementById("category").value.trim(),
      excerpt: document.getElementById("excerpt").value.trim(),
      content: document.getElementById("content").value.trim(),
      image_url: imageUrl || null,
      image_path: imagePath || null,
      attachments,
      published: document.getElementById("published").checked,
      updated_at: now
    };

    const existing = articles.find((article) => article.id === id);
    if (!existing) payload.created_at = now;

    const { error } = await supabase.from("articles").upsert(payload, { onConflict: "id" });
    if (error) throw error;

    await loadData();
    resetArticleForm();
    renderAdminArticles();
    renderFeaturedManager();
  } catch (error) {
    console.error(error);
    alert("Errore durante il salvataggio dell'articolo.");
  }
});

countdownForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const id = document.getElementById("countdownId").value || crypto.randomUUID();
    const now = new Date().toISOString();
    const title = document.getElementById("countdownTitle").value.trim();
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
    resetCountdownForm();
    renderAdminCountdowns();
  } catch (error) {
    console.error(error);
    alert(error?.message || "Errore durante il salvataggio del countdown.");
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
    resetAgendaForm();
    renderAdminAgendaEvents();
  } catch (error) {
    console.error(error);
    alert("Errore durante il salvataggio dell'evento.");
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
    }
  } catch (error) {
    console.error(error);
    alert("Errore operazione countdown.");
  }
});

adminArticles.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  const article = articles.find((item) => item.id === id);
  if (!article) return;

  try {
    if (action === "edit") {
      fillArticleForm(article);
      return;
    }

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
  } catch (error) {
    console.error(error);
    alert("Errore operazione articolo.");
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
    }
  } catch (error) {
    console.error(error);
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
  } catch (error) {
    console.error(error);
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
  } catch (error) {
    console.error(error);
    alert("Errore riordino evidenza.");
  }
});

featuredManagerList.addEventListener("dragend", () => {
  draggedFeaturedId = null;
  featuredManagerList.querySelectorAll("[data-drag-id]").forEach((item) => item.classList.remove("opacity-60", "ring-2", "ring-accent"));
});

supabase.auth.onAuthStateChange(() => {
  handleAuthUi().catch((error) => {
    console.error(error);
    setLoginError("Errore sincronizzazione sessione.");
  });
});

async function bootstrapAdmin() {
  renderAttachmentList();
  resetCountdownForm();

  if (REQUIRE_LOGIN_ON_EACH_VISIT) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error(error);
    }
  }

  await handleAuthUi();
}

bootstrapAdmin().catch((error) => {
  console.error(error);
  setLoginError("Errore inizializzazione admin.");
});
