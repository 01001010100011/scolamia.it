const TARGET_ARTICLE_TITLE = "Nuova circolare sulla ricreazione: cosa cambia davvero";
const DATA_URL = "/assets/data/turni-ricreazione-completo.json?v=20260306d";
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
    <div class="recreation-watermark-shell relative border-2 border-black overflow-hidden bg-white hidden md:block">
      <div class="recreation-watermark-overlay absolute inset-0 pointer-events-none grid place-items-center z-30">
        <div class="recreation-watermark-brand flex items-center gap-3">
          <img src="${BRAND_LOGO_URL}" alt="Logo Scola-Mia.com" class="w-20 h-20 object-contain" />
          <span class="headline text-6xl leading-none tracking-tight">Scola-Mia.com</span>
        </div>
      </div>
      <div class="relative z-10">
        <table class="w-full border-collapse text-sm">
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

function renderCards(rows) {
  return `
    <div class="recreation-watermark-shell relative mt-4 border-2 border-black overflow-hidden bg-white md:hidden">
      <div class="recreation-watermark-overlay absolute inset-0 pointer-events-none grid place-items-center z-30">
        <div class="recreation-watermark-brand flex items-center gap-2">
          <img src="${BRAND_LOGO_URL}" alt="Logo Scola-Mia.com" class="w-16 h-16 object-contain" />
          <span class="headline text-4xl leading-none tracking-tight">Scola-Mia.com</span>
        </div>
      </div>
      <div class="relative z-10 p-3 space-y-3">
        ${rows.map((row) => `
          <article class="border-2 border-black bg-paper p-3">
            <h3 class="headline text-3xl">${row.day}</h3>
            <div class="mt-2 space-y-2 text-sm">
              <p class="border border-black/20 p-2 ${getCellClass(row.firstText)}"><span class="font-bold">Prima ricreazione:</span> ${row.firstText}</p>
              <p class="border border-black/20 p-2 ${getCellClass(row.secondText)}"><span class="font-bold">Seconda ricreazione:</span> ${row.secondText}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSummary(rows) {
  return `
    ${renderTable(rows)}
    ${renderCards(rows)}
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

function withPdfOpacity(doc, opacity, drawFn) {
  if (typeof doc.GState === "function") {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity }));
    drawFn();
    doc.restoreGraphicsState();
    return;
  }
  drawFn();
}

async function drawPdfWatermark(doc, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = options.centerX || pageWidth / 2;
  const centerY = options.centerY || pageHeight / 2;
  const textSize = options.textSize || 52;
  const logoSize = options.logoSize || 86;
  const angle = Number(options.angle ?? 0);
  const opacity = Number(options.opacity ?? 0.13);
  const brandText = options.brandText || "Scola-Mia.com";
  const textGap = Number(options.textGap ?? 12);
  const font = options.font || "helvetica";

  doc.setFont(font, "bold");
  doc.setFontSize(textSize);
  const textWidth = doc.getTextWidth(brandText);
  const totalWidth = logoSize + textGap + textWidth;
  const startX = centerX - totalWidth / 2;
  const logoX = startX;
  const textX = logoX + logoSize + textGap;
  const baselineY = centerY + textSize * 0.15;

  try {
    const logoDataUrl = await fetchImageAsDataUrl(BRAND_LOGO_URL);
    withPdfOpacity(doc, opacity, () => {
      doc.addImage(logoDataUrl, "PNG", logoX, centerY - logoSize / 2, logoSize, logoSize);
    });
  } catch (error) {
    console.warn(error);
  }

  withPdfOpacity(doc, opacity, () => {
    doc.setFont(font, "bold");
    doc.setTextColor(55, 80, 140);
    doc.text(brandText, textX, baselineY, { align: "left", angle });
  });
  doc.setTextColor(0, 0, 0);
}

async function drawPdfBrandHeader(doc, y, title = "Scola Mia") {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const headerH = 42;
  doc.setDrawColor(0);
  doc.rect(margin, y - 12, pageWidth - margin * 2, headerH);

  try {
    const logoDataUrl = await fetchImageAsDataUrl(BRAND_LOGO_URL);
    doc.addImage(logoDataUrl, "PNG", margin + 8, y - 8, 28, 28);
  } catch (error) {
    console.warn(error);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin + 44, y + 11);
  return y + 50;
}

function drawPdfSlotText(doc, text, x, y, options = {}) {
  const maxWidth = options.maxWidth || 200;
  const lineHeight = options.lineHeight || 12;
  const prefix = options.prefix || "";
  const mainColor = options.mainColor || [0, 0, 0];
  const accentGreen = [22, 128, 61];
  const full = `${prefix}${text}`;

  if (!text.startsWith("Può uscire")) {
    doc.setTextColor(...mainColor);
    doc.text(full, x, y, { maxWidth });
    doc.setTextColor(0, 0, 0);
    return lineHeight;
  }

  const greenPart = `${prefix}Può uscire`;
  doc.setTextColor(...accentGreen);
  doc.text(greenPart, x, y, { maxWidth });

  doc.setTextColor(...mainColor);
  const rest = text.replace(/^Può uscire/, "");
  const restX = x + doc.getTextWidth(greenPart);
  doc.text(rest, restX, y, { maxWidth: Math.max(20, maxWidth - doc.getTextWidth(greenPart)) });
  doc.setTextColor(0, 0, 0);

  return lineHeight;
}

async function exportClassTablePdf(className, classRecord, rows) {
  const JsPDF = await ensureJsPdfLoaded();
  const doc = new JsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;
  y = await drawPdfBrandHeader(doc, y, "Scola Mia");

  y += 2;
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
  doc.setFontSize(10.6);

  for (const row of rows) {
    doc.rect(40, y - 16, colW[0] + colW[1] + colW[2], rowH);
    doc.line(colX[1], y - 16, colX[1], y - 16 + rowH);
    doc.line(colX[2], y - 16, colX[2], y - 16 + rowH);

    doc.text(row.day, colX[0] + 8, y + 2);
    drawPdfSlotText(doc, row.firstText, colX[1] + 8, y + 2, { maxWidth: colW[1] - 14 });
    drawPdfSlotText(doc, row.secondText, colX[2] + 8, y + 2, { maxWidth: colW[2] - 14 });
    y += rowH;
  }

  const tableTop = y - (rowH * rows.length) - rowH - 16;
  const tableHeight = rowH * (rows.length + 1);
  await drawPdfWatermark(doc, {
    centerX: 40 + (colW[0] + colW[1] + colW[2]) / 2,
    centerY: tableTop + tableHeight / 2,
    textSize: 44,
    logoSize: 74,
    opacity: 0.14
  });

  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10.5);
  doc.text("La possibilità di uscire resta sempre a discrezione del docente.", 40, y, {
    maxWidth: pageWidth - 80
  });
  y += 16;
  doc.setFontSize(9.5);
  doc.text("Funzionalità ancora in beta, per qualsiasi errore o problematica, contattare l'admin.", 40, y, {
    maxWidth: pageWidth - 80
  });

  const safeName = className.replace(/[^A-Za-z0-9_-]/g, "-");
  doc.save(`turni-ricreazione-tabella-${safeName}.pdf`);
}

async function exportClassCardsPdf(className, classRecord, rows) {
  const JsPDF = await ensureJsPdfLoaded();
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 34;
  const cardWidth = pageWidth - margin * 2;
  const cardHeight = 96;

  let y = 40;
  y = await drawPdfBrandHeader(doc, y, "Scola Mia");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Turni ricreazione - vista card", margin, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Classe selezionata: ${className}`, margin, y);
  y += 16;
  doc.text(buildClassMeta(className, classRecord), margin, y);

  y += 24;

  const cardsTop = y;
  const cardsHeight = rows.length * cardHeight + Math.max(0, rows.length - 1) * 10;
  await drawPdfWatermark(doc, {
    centerX: margin + cardWidth / 2,
    centerY: cardsTop + cardsHeight / 2,
    textSize: 44,
    logoSize: 70,
    opacity: 0.14,
    angle: 0
  });

  for (const row of rows) {
    doc.setDrawColor(0);
    doc.rect(margin, y, cardWidth, cardHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text(row.day, margin + 10, y + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.8);
    drawPdfSlotText(doc, row.firstText, margin + 10, y + 43, { maxWidth: cardWidth - 20, prefix: "Prima ricreazione: " });
    drawPdfSlotText(doc, row.secondText, margin + 10, y + 66, { maxWidth: cardWidth - 20, prefix: "Seconda ricreazione: " });

    y += cardHeight + 10;
  }

  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10.5);
  doc.text("La possibilità di uscire resta sempre a discrezione del docente.", margin, y, {
    maxWidth: pageWidth - margin * 2
  });
  y += 16;
  doc.setFontSize(9.5);
  doc.text("Funzionalità ancora in beta, per qualsiasi errore o problematica, contattare l'admin.", margin, y, {
    maxWidth: pageWidth - margin * 2
  });

  const safeName = className.replace(/[^A-Za-z0-9_-]/g, "-");
  doc.save(`turni-ricreazione-card-${safeName}.pdf`);
}

export function shouldRenderRecreationTool(article) {
  return normalize(article?.title) === normalize(TARGET_ARTICLE_TITLE);
}

export function renderRecreationToolSection() {
  return `
    <section id="recreationToolMount" class="mt-8 pt-6 border-t-2 border-black">
      <style>
        #recreationToolMount .recreation-watermark-overlay { opacity: 0.18; }
        #recreationToolMount .recreation-watermark-brand { transform: translateY(2px); }
        #recreationToolMount .recreation-watermark-brand span { white-space: nowrap; }
      </style>
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
      <p class="mt-1 text-[11px] italic text-slate-600">Funzionalità ancora in beta, per qualsiasi errore o problematica, contattare l'admin.</p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button id="downloadRecreationPdfBtn" type="button" class="border-2 border-black bg-accent text-white px-4 py-2 text-xs font-bold uppercase shadow-brutal">
          Scarica tabella in PDF
        </button>
        <button id="downloadRecreationCardsPdfBtn" type="button" class="border-2 border-black bg-black text-white px-4 py-2 text-xs font-bold uppercase shadow-brutal">
          Scarica card in PDF
        </button>
      </div>
    </section>
  `;
}

export async function initRecreationTool(article, options = {}) {
  const mountId = options.mountId || "recreationToolMount";
  const force = Boolean(options.force);
  const mount = document.getElementById(mountId);
  if (!mount) return;
  if (!force && !shouldRenderRecreationTool(article)) return;

  const select = document.getElementById("recreationClassSelect");
  const meta = document.getElementById("recreationClassMeta");
  const tableArea = document.getElementById("recreationTableArea");
  const downloadBtn = document.getElementById("downloadRecreationPdfBtn");
  const downloadCardsBtn = document.getElementById("downloadRecreationCardsPdfBtn");

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
    tableArea.innerHTML = renderSummary(rows);
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

  downloadCardsBtn?.addEventListener("click", async () => {
    if (!selectedClass || !dataset[selectedClass]) {
      window.alert("Seleziona prima una classe.");
      return;
    }

    try {
      const classRecord = dataset[selectedClass];
      const rows = computeWeekRows(selectedClass, classRecord);
      await exportClassCardsPdf(selectedClass, classRecord, rows);
    } catch (error) {
      console.error(error);
      window.alert("Errore durante la generazione del PDF card.");
    }
  });
}
