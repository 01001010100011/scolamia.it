const TARGET_ARTICLE_TITLE = "Nuova circolare sulla ricreazione: cosa cambia davvero";
const DATA_URL = "/assets/data/turni-ricreazione-completo.json?v=20260306a";
const BRAND_LOGO_URL = "/assets/social/site-logo-512.png";

const DAY_CONFIG = [
  { key: "mon", label: "Lunedì" },
  { key: "tue", label: "Martedì" },
  { key: "wed", label: "Mercoledì" },
  { key: "thu", label: "Giovedì" },
  { key: "fri", label: "Venerdì" }
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isTriennioClassico(className) {
  const normalized = String(className || "").toUpperCase().replace(/\s+/g, "");
  const year = Number(normalized[0]);
  if (![3, 4, 5].includes(year)) return false;
  return /(AC|BC|CL)$/.test(normalized);
}

function isAlwaysOutsideByPalazzina(classRecord) {
  const palazzina = Number(classRecord?.palazzina || 0);
  return palazzina === 3 || palazzina === 4;
}

function formatSlot(isOutside, sector) {
  if (isOutside) return `Può uscire (settore ${sector})`;
  return "Resta in classe";
}

function mapSlotValue(slotValue) {
  return String(slotValue || "").toLowerCase() === "outside";
}

function computeWeekRows(className, classRecord) {
  const forceOutsideAlways = isAlwaysOutsideByPalazzina(classRecord);
  const isClassicWednesday = isTriennioClassico(className);
  const sector = String(classRecord?.sector || "").trim() || "-";

  return DAY_CONFIG.map((day) => {
    const dayData = classRecord?.[day.key] || {};

    let firstOutside = mapSlotValue(dayData.first);
    let secondOutside = mapSlotValue(dayData.second);

    if (forceOutsideAlways) {
      firstOutside = true;
      secondOutside = true;
    }

    if (day.key === "wed" && isClassicWednesday) {
      firstOutside = true;
      secondOutside = true;
    }

    return {
      day: day.label,
      firstText: formatSlot(firstOutside, sector),
      secondText: formatSlot(secondOutside, sector)
    };
  });
}

function getCellClass(text) {
  return text.startsWith("Può uscire")
    ? "bg-green-50 text-green-900"
    : "bg-slate-100 text-slate-800";
}

function renderTable(rows) {
  return `
    <div class="relative mt-4 border-2 border-black overflow-hidden bg-white">
      <div class="absolute inset-0 pointer-events-none grid place-items-center z-10">
        <div class="flex items-center gap-3 opacity-20">
          <img src="${BRAND_LOGO_URL}" alt="Logo Scola-Mia.com" class="w-16 h-16 object-contain" />
          <span class="headline text-6xl leading-none">Scola-Mia.com</span>
        </div>
      </div>
      <div class="relative z-20 overflow-x-auto">
        <table class="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr class="bg-paper">
              <th class="border-b-2 border-black text-left p-3">Giorno</th>
              <th class="border-b-2 border-l-2 border-black text-left p-3">Prima ricreazione</th>
              <th class="border-b-2 border-l-2 border-black text-left p-3">Seconda ricreazione</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td class="border-t border-black/20 p-3 font-semibold whitespace-nowrap">${row.day}</td>
                <td class="border-t border-l-2 border-black/20 p-3 ${getCellClass(row.firstText)}">${row.firstText}</td>
                <td class="border-t border-l-2 border-black/20 p-3 ${getCellClass(row.secondText)}">${row.secondText}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildClassMeta(className, classRecord) {
  return `Classe ${className} • Aula ${classRecord.aula} • Palazzina ${classRecord.palazzina}`;
}

let jsPdfLoaderPromise = null;

function ensureJsPdfLoaded() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (jsPdfLoaderPromise) return jsPdfLoaderPromise;

  jsPdfLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    script.onload = () => {
      if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
      else reject(new Error("jsPDF non disponibile dopo il caricamento."));
    };
    script.onerror = () => reject(new Error("Impossibile caricare la libreria PDF."));
    document.head.appendChild(script);
  });

  return jsPdfLoaderPromise;
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error("Logo non disponibile.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Impossibile convertire il logo."));
    reader.readAsDataURL(blob);
  });
}

async function exportClassTablePdf(className, classRecord, rows) {
  const JsPDF = await ensureJsPdfLoaded();
  const doc = new JsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 46;

  try {
    const logoDataUrl = await fetchImageAsDataUrl(BRAND_LOGO_URL);
    doc.addImage(logoDataUrl, "PNG", 40, y - 8, 32, 32);
  } catch (error) {
    console.warn(error);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Scola-Mia.com", 80, y + 14);

  y += 42;
  doc.setFontSize(13);
  doc.text("Controlla i tuoi turni di ricreazione", 40, y);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Classe selezionata: ${className}`, 40, y);

  y += 16;
  doc.text(buildClassMeta(className, classRecord), 40, y);

  y += 24;

  const colX = [40, 170, 360];
  const colW = [130, 190, 190];
  const rowH = 28;

  doc.setFillColor(244, 243, 238);
  doc.rect(40, y - 16, colW[0] + colW[1] + colW[2], rowH, "F");
  doc.setDrawColor(0);
  doc.rect(40, y - 16, colW[0] + colW[1] + colW[2], rowH);
  doc.line(colX[1], y - 16, colX[1], y - 16 + rowH);
  doc.line(colX[2], y - 16, colX[2], y - 16 + rowH);

  doc.setFont("helvetica", "bold");
  doc.text("Giorno", colX[0] + 8, y + 2);
  doc.text("Prima ricreazione", colX[1] + 8, y + 2);
  doc.text("Seconda ricreazione", colX[2] + 8, y + 2);

  y += rowH;
  doc.setFont("helvetica", "normal");

  for (const row of rows) {
    doc.rect(40, y - 16, colW[0] + colW[1] + colW[2], rowH);
    doc.line(colX[1], y - 16, colX[1], y - 16 + rowH);
    doc.line(colX[2], y - 16, colX[2], y - 16 + rowH);

    doc.text(row.day, colX[0] + 8, y + 2);
    doc.text(row.firstText, colX[1] + 8, y + 2, { maxWidth: colW[1] - 14 });
    doc.text(row.secondText, colX[2] + 8, y + 2, { maxWidth: colW[2] - 14 });
    y += rowH;
  }

  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10.5);
  doc.text("La possibilità di uscire resta sempre a discrezione del docente.", 40, y, {
    maxWidth: pageWidth - 80
  });

  const safeName = className.replace(/[^A-Za-z0-9_-]/g, "-");
  doc.save(`turni-ricreazione-${safeName}.pdf`);
}

export function shouldRenderRecreationTool(article) {
  return normalize(article?.title) === normalize(TARGET_ARTICLE_TITLE);
}

export function renderRecreationToolSection() {
  return `
    <section id="recreationToolMount" class="mt-8 pt-6 border-t-2 border-black">
      <h2 class="headline text-4xl">Controlla i tuoi turni di ricreazione</h2>
      <p class="mt-2 text-sm">Seleziona la tua classe per visualizzare il riepilogo settimanale dei due turni.</p>

      <div class="mt-4 max-w-md">
        <label for="recreationClassSelect" class="block text-xs font-bold uppercase mb-1">Classe</label>
        <select id="recreationClassSelect" class="w-full border-2 border-black bg-white p-2 text-sm">
          <option value="">Seleziona una classe</option>
        </select>
      </div>

      <p id="recreationClassMeta" class="mt-3 text-xs font-semibold text-slate-600"></p>
      <div id="recreationTableArea" class="mt-2"></div>
      <p class="mt-4 text-xs font-semibold">La possibilità di uscire resta sempre a discrezione del docente.</p>

      <button id="downloadRecreationPdfBtn" type="button" class="mt-4 border-2 border-black bg-accent text-white px-4 py-2 text-xs font-bold uppercase shadow-brutal">
        Scarica la tabella in PDF
      </button>
    </section>
  `;
}

export async function initRecreationTool(article) {
  const mount = document.getElementById("recreationToolMount");
  if (!mount || !shouldRenderRecreationTool(article)) return;

  const select = document.getElementById("recreationClassSelect");
  const meta = document.getElementById("recreationClassMeta");
  const tableArea = document.getElementById("recreationTableArea");
  const downloadBtn = document.getElementById("downloadRecreationPdfBtn");

  let dataset = {};
  let selectedClass = "";

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("File dati turni non disponibile.");
    dataset = await response.json();
  } catch (error) {
    console.error(error);
    mount.innerHTML = '<p class="text-sm font-semibold text-red-700">Errore caricamento turni ricreazione.</p>';
    return;
  }

  const classNames = Object.keys(dataset || {})
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "it", { numeric: true, sensitivity: "base" }));

  for (const className of classNames) {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    select.appendChild(option);
  }

  const renderForClass = (className) => {
    selectedClass = className;
    if (!className || !dataset[className]) {
      meta.textContent = "";
      tableArea.innerHTML = "";
      return;
    }

    const classRecord = dataset[className];
    const rows = computeWeekRows(className, classRecord);
    meta.textContent = buildClassMeta(className, classRecord);
    tableArea.innerHTML = renderTable(rows);
  };

  select.addEventListener("change", () => {
    renderForClass(select.value);
  });

  downloadBtn?.addEventListener("click", async () => {
    if (!selectedClass || !dataset[selectedClass]) {
      window.alert("Seleziona prima una classe.");
      return;
    }

    try {
      const classRecord = dataset[selectedClass];
      const rows = computeWeekRows(selectedClass, classRecord);
      await exportClassTablePdf(selectedClass, classRecord, rows);
    } catch (error) {
      console.error(error);
      window.alert("Errore durante la generazione del PDF.");
    }
  });
}
