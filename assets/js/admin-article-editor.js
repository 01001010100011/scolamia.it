import { escapeHtml, supabase, toSlugSafeName } from "./supabase-client.js?v=20260224e";
import { markdownToHtml } from "./markdown.js?v=20260303c";
import { buildArticleSlugMap, getArticleSlug } from "./article-url.js?v=20260303b";

const BUCKET = "article-media";

const form = document.getElementById("articleEditorForm");
const editorError = document.getElementById("editorError");
const cancelBtn = document.getElementById("cancelBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const publishBtn = document.getElementById("publishBtn");

const contextTitle = document.getElementById("editorContextTitle");
const contextMeta = document.getElementById("editorContextMeta");

const articleIdInput = document.getElementById("articleId");
const titleInput = document.getElementById("title");
const articleSlugPreview = document.getElementById("articleSlugPreview");
const categoryInput = document.getElementById("category");
const authorNameInput = document.getElementById("authorName");
const excerptInput = document.getElementById("excerpt");
const contentInput = document.getElementById("content");
const importMarkdownBtn = document.getElementById("importMarkdownBtn");
const markdownFileInput = document.getElementById("markdownFileInput");
const markdownImportNotice = document.getElementById("markdownImportNotice");
const markdownPreview = document.getElementById("markdownPreview");
const creditAuthorInput = document.getElementById("creditAuthor");
const creditPhotosInput = document.getElementById("creditPhotos");
const creditDirectorInput = document.getElementById("creditDirector");

const articleImageInput = document.getElementById("articleImageInput");
const articleImagePreview = document.getElementById("articleImagePreview");
const removeArticleImageBtn = document.getElementById("removeArticleImageBtn");
const articleAttachmentInput = document.getElementById("articleAttachmentInput");
const articleAttachmentList = document.getElementById("articleAttachmentList");
const imageNormalizationNotice = document.getElementById("imageNormalizationNotice");
const normalizeAllImagesBtn = document.getElementById("normalizeAllImagesBtn");

let originalRecord = null;
let currentArticleImageUrl = "";
let currentArticleImagePath = "";
let currentArticleImageFile = null;
let currentArticleAttachments = [];
let currentPublished = false;
let isSaving = false;
let slugPreviewArticles = [];

const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1080;
const OUTPUT_IMAGE_TYPE = "image/jpeg";
const OUTPUT_IMAGE_QUALITY = 0.9;
const ARTICLE_SELECT_FIELDS = "*";

function setError(message = "") {
  if (!message) {
    editorError.classList.add("hidden");
    editorError.textContent = "";
    return;
  }
  editorError.textContent = message;
  editorError.classList.remove("hidden");
}

function setImageNotice(message = "") {
  if (!imageNormalizationNotice) return;
  if (!message) {
    imageNormalizationNotice.classList.add("hidden");
    imageNormalizationNotice.textContent = "";
    return;
  }
  imageNormalizationNotice.textContent = message;
  imageNormalizationNotice.classList.remove("hidden");
}

function setMarkdownImportNotice(message = "") {
  if (!markdownImportNotice) return;
  if (!message) {
    markdownImportNotice.classList.add("hidden");
    markdownImportNotice.textContent = "";
    return;
  }
  markdownImportNotice.textContent = message;
  markdownImportNotice.classList.remove("hidden");
}

function isMarkdownFile(file) {
  if (!file) return false;
  return /\.md$/i.test(file.name || "");
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

function setImagePreview(url = "") {
  if (!url) {
    articleImagePreview.classList.add("hidden");
    articleImagePreview.removeAttribute("src");
    removeArticleImageBtn.classList.add("hidden");
    return;
  }
  articleImagePreview.src = url;
  articleImagePreview.classList.remove("hidden");
  removeArticleImageBtn.classList.remove("hidden");
}

function syncContext() {
  const id = articleIdInput.value || "non assegnato";
  const status = currentPublished ? "Online" : "Bozza";
  contextTitle.textContent = titleInput.value.trim() || (articleIdInput.value ? "Articolo in modifica" : "Nuovo articolo");
  contextMeta.textContent = `ID: ${id} | Stato: ${status}`;
  renderArticleSlugPreview();
}

function renderArticleSlugPreview() {
  if (!articleSlugPreview) return;
  const title = titleInput.value.trim();
  if (!title) {
    articleSlugPreview.textContent = `${window.location.origin}/article/{slug}/`;
    return;
  }

  const currentId = String(articleIdInput.value || "").trim();
  const workingArticles = Array.isArray(slugPreviewArticles) ? [...slugPreviewArticles] : [];
  const previewId = currentId || "__draft-preview__";
  const index = workingArticles.findIndex((item) => String(item?.id || "") === previewId);

  if (index >= 0) {
    workingArticles[index] = { ...workingArticles[index], title };
  } else {
    workingArticles.push({ id: previewId, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }

  const slugMap = buildArticleSlugMap(workingArticles);
  const slug = getArticleSlug({ id: previewId, title }, slugMap);
  articleSlugPreview.textContent = `${window.location.origin}/article/${slug}/`;
}

async function loadArticleSlugPreviewData() {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("id,title,created_at,updated_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    slugPreviewArticles = data || [];
  } catch (error) {
    console.warn("Impossibile caricare dati anteprima slug articoli:", error);
    slugPreviewArticles = [];
  } finally {
    renderArticleSlugPreview();
  }
}

function renderMarkdownPreview() {
  if (!markdownPreview) return;
  const markdown = contentInput.value.trim();
  if (!markdown) {
    markdownPreview.innerHTML = '<p class="text-sm text-slate-600">Anteprima vuota: inizia a scrivere contenuto Markdown per vedere il risultato.</p>';
    return;
  }
  markdownPreview.innerHTML = markdownToHtml(markdown);
}

function updateActionButtons() {
  const hasId = Boolean(articleIdInput.value);
  saveDraftBtn.textContent = currentPublished ? "Sposta nelle bozze" : "Salva nelle bozze";
  publishBtn.textContent = currentPublished && hasId ? "Aggiorna articolo" : "Pubblica articolo";
}

function cleanPlainText(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
}

function setSavingState(saving) {
  isSaving = saving;
  cancelBtn.disabled = saving;
  saveDraftBtn.disabled = saving;
  publishBtn.disabled = saving;
  if (!saving) {
    updateActionButtons();
    return;
  }
  saveDraftBtn.textContent = "Salvataggio...";
  publishBtn.textContent = "Salvataggio...";
}

function validateRequiredFields() {
  if (!titleInput.value.trim()) return "Titolo obbligatorio.";
  if (!categoryInput.value.trim()) return "Categoria obbligatoria.";
  if (!excerptInput.value.trim()) return "Descrizione / Estratto obbligatoria.";
  if (!contentInput.value.trim()) return "Contenuto obbligatorio.";
  return "";
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

async function uploadToStoragePath(path, file) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

function buildNormalizedImagePath(articleId, title = "") {
  const stamp = Date.now();
  const cleanTitle = toSlugSafeName(title || `article-${articleId}`) || `article-${articleId}`;
  return `articles/${articleId}/images/${stamp}-${cleanTitle}-fhd-sdr.jpg`;
}

function withCacheBust(url) {
  if (!url) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${Date.now()}`;
}

function getResizedDimensions(width, height) {
  const ratio = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossibile esportare l'immagine normalizzata."));
    }, type, quality);
  });
}

async function readImageBitmap(source) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(source);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile leggere l'immagine selezionata."));
    img.src = URL.createObjectURL(source);
  });
}

function getSourceDimensions(source) {
  return {
    width: source.width || source.videoWidth || 1,
    height: source.height || source.videoHeight || 1
  };
}

async function normalizeImageFile(file, baseName = "") {
  const source = await readImageBitmap(file);
  const sourceDims = getSourceDimensions(source);
  const targetDims = getResizedDimensions(sourceDims.width, sourceDims.height);
  const canvas = document.createElement("canvas");
  canvas.width = targetDims.width;
  canvas.height = targetDims.height;

  const ctx = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" });
  if (!ctx) throw new Error("Impossibile inizializzare il motore grafico per la normalizzazione.");
  ctx.drawImage(source, 0, 0, targetDims.width, targetDims.height);

  if (typeof source.close === "function") {
    source.close();
  }

  const blob = await canvasToBlob(canvas, OUTPUT_IMAGE_TYPE, OUTPUT_IMAGE_QUALITY);
  const cleanBase = toSlugSafeName(baseName || file.name || "immagine").replace(/\.[a-z0-9]+$/i, "");
  const normalizedName = `${cleanBase || "immagine"}-fhd-sdr.jpg`;
  const normalizedFile = new File([blob], normalizedName, {
    type: OUTPUT_IMAGE_TYPE,
    lastModified: Date.now()
  });

  return {
    file: normalizedFile,
    width: targetDims.width,
    height: targetDims.height,
    resized: targetDims.width !== sourceDims.width || targetDims.height !== sourceDims.height,
    sourceWidth: sourceDims.width,
    sourceHeight: sourceDims.height
  };
}

async function normalizeRemoteImage(url, baseName = "immagine") {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Download immagine fallito.");
  const blob = await response.blob();
  const file = new File([blob], `${toSlugSafeName(baseName)}.bin`, { type: blob.type || "image/jpeg" });
  return normalizeImageFile(file, baseName);
}

function mapRecordToForm(record) {
  articleIdInput.value = record.id;
  titleInput.value = record.title || "";
  categoryInput.value = record.category || "";
  authorNameInput.value = record.author_name || "";
  excerptInput.value = record.excerpt || "";
  contentInput.value = record.content || "";
  creditAuthorInput.value = record.credit_author || "";
  creditPhotosInput.value = record.credit_photos || "";
  creditDirectorInput.value = record.credit_director || "";
  currentPublished = Boolean(record.published);

  currentArticleImageUrl = record.image_url || "";
  currentArticleImagePath = record.image_path || "";
  currentArticleImageFile = null;
  articleImageInput.value = "";
  setImagePreview(currentArticleImageUrl);

  currentArticleAttachments = Array.isArray(record.attachments) ? record.attachments.map((att) => ({ ...att })) : [];
  articleAttachmentInput.value = "";
  renderAttachmentList();

  updateActionButtons();
  syncContext();
  renderMarkdownPreview();
  renderArticleSlugPreview();
}

function resetToNew() {
  originalRecord = null;
  form.reset();
  articleIdInput.value = "";
  currentPublished = false;

  currentArticleImageUrl = "";
  currentArticleImagePath = "";
  currentArticleImageFile = null;
  articleImageInput.value = "";
  setImagePreview("");

  currentArticleAttachments = [];
  articleAttachmentInput.value = "";
  renderAttachmentList();

  updateActionButtons();
  syncContext();
  renderMarkdownPreview();
  renderArticleSlugPreview();
}

async function loadArticle(id) {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT_FIELDS)
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function isMissingColumnError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42703"
    || code === "PGRST204"
    || message.includes("schema cache")
    || message.includes("could not find the 'credit_");
}

async function bootstrap() {
  setError("");
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session) {
    window.location.href = "/admin/";
    return;
  }

  const isAdmin = await ensureCurrentUserIsAdmin();
  if (!isAdmin) {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/admin/";
    return;
  }

  await loadArticleSlugPreviewData();

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    resetToNew();
    return;
  }

  const record = await loadArticle(id);
  if (!record) {
    setError("Articolo non trovato.");
    resetToNew();
    return;
  }

  originalRecord = structuredClone(record);
  mapRecordToForm(record);
}

articleImageInput.addEventListener("change", () => {
  const file = articleImageInput.files?.[0];
  if (!file) return;

  (async () => {
    try {
      setImageNotice("Normalizzazione immagine in corso (SDR + max Full HD)...");
      const normalized = await normalizeImageFile(file, file.name);
      currentArticleImageFile = normalized.file;

      const preview = URL.createObjectURL(normalized.file);
      currentArticleImageUrl = preview;
      setImagePreview(preview);
      setImageNotice(`Immagine pronta: ${normalized.width}x${normalized.height} (SDR, JPG).`);
    } catch (error) {
      console.error(error);
      currentArticleImageFile = null;
      articleImageInput.value = "";
      setImageNotice("");
      setError("Impossibile normalizzare l'immagine selezionata.");
    }
  })();
});

removeArticleImageBtn.addEventListener("click", () => {
  currentArticleImageUrl = "";
  currentArticleImagePath = "";
  currentArticleImageFile = null;
  articleImageInput.value = "";
  setImagePreview("");
  setImageNotice("");
  syncContext();
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

cancelBtn.addEventListener("click", () => {
  if (isSaving) return;
  if (originalRecord) {
    mapRecordToForm(originalRecord);
    return;
  }
  resetToNew();
});

[titleInput, categoryInput, authorNameInput, excerptInput, contentInput, creditAuthorInput, creditPhotosInput, creditDirectorInput].forEach((node) => {
  node.addEventListener("input", syncContext);
  node.addEventListener("change", syncContext);
});

contentInput.addEventListener("input", renderMarkdownPreview);
contentInput.addEventListener("change", renderMarkdownPreview);

importMarkdownBtn?.addEventListener("click", () => {
  if (isSaving) return;
  markdownFileInput?.click();
});

markdownFileInput?.addEventListener("change", async () => {
  const file = markdownFileInput.files?.[0];
  markdownFileInput.value = "";
  if (!file) return;

  setError("");
  setMarkdownImportNotice("");

  if (!isMarkdownFile(file)) {
    setError("Formato non valido: carica solo file .md (Markdown).");
    return;
  }

  try {
    const markdownContent = await file.text();
    contentInput.value = markdownContent;
    syncContext();
    renderMarkdownPreview();
    setMarkdownImportNotice(`Contenuto importato da ${file.name}.`);
  } catch (error) {
    console.error(error);
    setError("Impossibile leggere il file Markdown selezionato.");
  }
});

async function saveArticle(targetPublished) {
  if (isSaving) return;
  setError("");

  try {
    const validationError = validateRequiredFields();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingState(true);

    const now = new Date().toISOString();
    const id = articleIdInput.value || crypto.randomUUID();

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

    const creditAuthor = cleanPlainText(creditAuthorInput.value) || null;
    const creditPhotos = cleanPlainText(creditPhotosInput.value) || null;
    const creditDirector = cleanPlainText(creditDirectorInput.value) || null;
    const authorName = cleanPlainText(authorNameInput.value) || null;
    const hasCreditsInput = Boolean(creditAuthor || creditPhotos || creditDirector);
    const hasExtendedMetadataInput = Boolean(authorName || hasCreditsInput);

    const fullPayload = {
      title: titleInput.value.trim(),
      category: categoryInput.value.trim(),
      author_name: authorName,
      excerpt: excerptInput.value.trim(),
      content: contentInput.value.trim(),
      credit_author: creditAuthor,
      credit_photos: creditPhotos,
      credit_director: creditDirector,
      image_url: imageUrl || null,
      image_path: imagePath || null,
      attachments,
      published: targetPublished,
      updated_at: now
    };

    const legacyPayload = {
      title: fullPayload.title,
      category: fullPayload.category,
      excerpt: fullPayload.excerpt,
      content: fullPayload.content,
      image_url: fullPayload.image_url,
      image_path: fullPayload.image_path,
      attachments: fullPayload.attachments,
      published: fullPayload.published,
      updated_at: fullPayload.updated_at
    };

    let saved = null;

    if (articleIdInput.value) {
      let { data, error } = await supabase
        .from("articles")
        .update(fullPayload)
        .eq("id", id)
        .select(ARTICLE_SELECT_FIELDS)
        .single();
      if (error && isMissingColumnError(error)) {
        if (hasExtendedMetadataInput) {
          throw new Error("I campi metadata (autore/crediti) non sono ancora attivi nel database Supabase. Esegui la migrazione SQL e riprova.");
        }
        ({ data, error } = await supabase
          .from("articles")
          .update(legacyPayload)
          .eq("id", id)
          .select(ARTICLE_SELECT_FIELDS)
          .single());
      }
      if (error) throw error;
      saved = data;
    } else {
      let { data, error } = await supabase
        .from("articles")
        .insert({ id, ...fullPayload, created_at: now })
        .select(ARTICLE_SELECT_FIELDS)
        .single();
      if (error && isMissingColumnError(error)) {
        if (hasExtendedMetadataInput) {
          throw new Error("I campi metadata (autore/crediti) non sono ancora attivi nel database Supabase. Esegui la migrazione SQL e riprova.");
        }
        ({ data, error } = await supabase
          .from("articles")
          .insert({ id, ...legacyPayload, created_at: now })
          .select(ARTICLE_SELECT_FIELDS)
          .single());
      }
      if (error) throw error;
      saved = data;
      history.replaceState(null, "", `/admin-article-editor/?id=${encodeURIComponent(saved.id)}`);
    }

    originalRecord = structuredClone(saved);
    mapRecordToForm(saved);
    await loadArticleSlugPreviewData();
    setError("");
  } catch (error) {
    console.error(error);
    setError(error?.message || "Errore durante il salvataggio dell'articolo.");
  } finally {
    setSavingState(false);
  }
}

saveDraftBtn.addEventListener("click", () => saveArticle(false));
publishBtn.addEventListener("click", () => saveArticle(true));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveArticle(currentPublished);
});

normalizeAllImagesBtn?.addEventListener("click", async () => {
  if (isSaving) return;

  const shouldRun = window.confirm(
    "Normalizzare TUTTE le foto articoli esistenti in SDR e Full HD (max 1920x1080)? L'operazione può richiedere alcuni minuti."
  );
  if (!shouldRun) return;

  try {
    setSavingState(true);
    setError("");
    setImageNotice("Normalizzazione foto esistenti avviata...");

    const { data: articles, error } = await supabase
      .from("articles")
      .select("id,title,image_url,image_path")
      .not("image_url", "is", null);
    if (error) throw error;

    const items = (articles || []).filter((item) => item.image_url);
    let done = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const normalized = await normalizeRemoteImage(item.image_url, item.title || item.id);
        const targetPath = buildNormalizedImagePath(item.id, item.title);
        const uploaded = await uploadToStoragePath(targetPath, normalized.file);
        const { error: updateErr } = await supabase
          .from("articles")
          .update({ image_url: withCacheBust(uploaded.url), image_path: uploaded.path, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        if (updateErr) throw updateErr;
        done += 1;
      } catch (itemError) {
        console.error("Normalizzazione immagine fallita per articolo:", item.id, itemError);
        failed += 1;
      }
      setImageNotice(`Normalizzazione foto esistenti: ${done}/${items.length} completate${failed ? `, ${failed} con errore` : ""}`);
    }

    if (failed) {
      setError(`Normalizzazione completata con errori: ${done} aggiornate, ${failed} non aggiornate.`);
    }
    setImageNotice(`Normalizzazione completata: ${done} immagini aggiornate (SDR + max Full HD).`);
  } catch (error) {
    console.error(error);
    setError(error?.message || "Errore durante la normalizzazione delle immagini esistenti.");
    setImageNotice("");
  } finally {
    setSavingState(false);
  }
});

bootstrap().catch((error) => {
  console.error(error);
  setError("Errore inizializzazione editor articolo.");
});
