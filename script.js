const HISTORY_KEY = "qr-code-history-v2";
const MAX_HISTORY_ITEMS = 50;

const form = document.querySelector("#qr-form");
const primaryInput = document.querySelector("#primary-input");
const primaryLabel = document.querySelector("#primary-label");
const foregroundInput = document.querySelector("#foreground-color");
const backgroundInput = document.querySelector("#background-color");
const foregroundValue = document.querySelector("#foreground-value");
const backgroundValue = document.querySelector("#background-value");
const statusMessage = document.querySelector("#status-message");
const canvas = document.querySelector("#qr-canvas");
const downloadButtons = document.querySelectorAll("[data-download]");
const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector("#theme-label");
const singleTypeInputs = document.querySelectorAll('input[name="single-type"]');
const bulkTypeInputs = document.querySelectorAll('input[name="bulk-type"]');
const bulkForm = document.querySelector("#bulk-form");
const bulkInput = document.querySelector("#bulk-input");
const bulkLabel = document.querySelector("#bulk-label");
const bulkStatus = document.querySelector("#bulk-status");
const bulkGrid = document.querySelector("#bulk-grid");
const bulkDownloadAllButton = document.querySelector("#bulk-download-all");
const historyList = document.querySelector("#history-list");

let currentSingleData = null;
let bulkItems = [];
let historyItems = loadHistory();

function selectedType(group) {
  return document.querySelector(`input[name="${group}"]:checked`).value;
}

function setStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function updateColorOutputs() {
  foregroundValue.textContent = foregroundInput.value;
  backgroundValue.textContent = backgroundInput.value;
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const nextActionLabel = theme === "dark" ? "switch to light mode" : "switch to dark mode";
  themeLabel.textContent = nextActionLabel;
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.setAttribute("aria-label", nextActionLabel);
}

function toggleTheme() {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
}

function updateInputCopy() {
  const singleType = selectedType("single-type");
  const bulkType = selectedType("bulk-type");

  if (singleType === "phone") {
    primaryLabel.textContent = "Phone Number";
    primaryInput.placeholder = "+1 306 555 0100";
    primaryInput.inputMode = "tel";
  } else {
    primaryLabel.textContent = "Link URL";
    primaryInput.placeholder = "https://example.com";
    primaryInput.inputMode = "url";
  }

  if (bulkType === "phone") {
    bulkLabel.textContent = "Enter one phone number per line";
    bulkInput.placeholder = "+1 306 555 0100\n+1 306 555 0101\n+1 306 555 0102";
  } else {
    bulkLabel.textContent = "Enter one URL per line";
    bulkInput.placeholder = "https://example.com\nhttps://example.org\nhttps://example.net";
  }
}

function normalizePhone(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Enter a phone number to generate a QR code.");
  }

  const normalizedPhone = trimmed.replace(/[^\d+]/g, "");
  const plusCount = (normalizedPhone.match(/\+/g) || []).length;

  if (!normalizedPhone || plusCount > 1 || (normalizedPhone.includes("+") && !normalizedPhone.startsWith("+"))) {
    throw new Error("Please enter a valid phone number.");
  }

  if (normalizedPhone.replace(/\D/g, "").length < 7) {
    throw new Error("Please enter a valid phone number.");
  }

  return `tel:${normalizedPhone}`;
}

function normalizeUrl(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Enter a URL to generate a QR code.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    throw new Error("Please enter a valid URL.");
  }
}

function normalizeValue(value, type) {
  return type === "phone" ? normalizePhone(value) : normalizeUrl(value);
}

async function drawQrCode(
  targetCanvas,
  text,
  {
    transparentBackground = false,
    width = 280,
    foregroundColor = foregroundInput.value,
    backgroundColor = backgroundInput.value
  } = {}
) {
  if (typeof QRCode === "undefined") {
    throw new Error("QR library failed to load. Refresh the page and try again.");
  }

  await QRCode.toCanvas(targetCanvas, text, {
    width,
    margin: 2,
    color: {
      dark: foregroundColor,
      light: transparentBackground ? "#0000" : backgroundColor
    }
  });
}

async function createExportCanvas(
  text,
  {
    transparentBackground = false,
    foregroundColor = foregroundInput.value,
    backgroundColor = backgroundInput.value
  } = {}
) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1200;
  exportCanvas.height = 1200;

  await drawQrCode(exportCanvas, text, {
    transparentBackground,
    width: exportCanvas.width,
    foregroundColor,
    backgroundColor
  });

  return exportCanvas;
}

async function createSvgBlob(
  text,
  {
    foregroundColor = foregroundInput.value,
    backgroundColor = backgroundInput.value
  } = {}
) {
  const svgMarkup = await QRCode.toString(text, {
    type: "svg",
    margin: 2,
    color: {
      dark: foregroundColor,
      light: backgroundColor
    }
  });

  return new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function fileBaseName(source) {
  if (!source) {
    return "qr-code";
  }

  if (source.startsWith("tel:")) {
    return source.replace("tel:", "").replace(/[^\d]+/g, "-").replace(/^-|-$/g, "") || "phone-qr";
  }

  const hostname = new URL(source).hostname.replace(/^www\./, "");
  return hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "qr-code";
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems.slice(0, MAX_HISTORY_ITEMS)));
}

function storeHistoryItem(item) {
  historyItems = [item, ...historyItems].slice(0, MAX_HISTORY_ITEMS);
  saveHistory();
}

function buildQrItem({ original, normalized, type }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    original,
    normalized,
    qrText: normalized,
    type,
    foregroundColor: foregroundInput.value,
    backgroundColor: backgroundInput.value,
    createdAt: new Date().toISOString()
  };
}

async function renderHistory() {
  historyList.innerHTML = "";

  if (historyItems.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "history-empty";
    emptyState.textContent = "No QR history yet. Generate one to save it here.";
    historyList.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of historyItems) {
    const card = document.createElement("article");
    card.className = "history-item";

    const thumb = document.createElement("canvas");
    thumb.className = "history-thumb";
    thumb.width = 168;
    thumb.height = 168;
    await drawQrCode(thumb, item.qrText, {
      width: 168,
      foregroundColor: item.foregroundColor,
      backgroundColor: item.backgroundColor
    });

    const content = document.createElement("div");
    content.className = "history-content";

    const title = document.createElement("p");
    title.className = "history-title";
    title.textContent = item.type === "phone" ? "Phone QR" : "URL QR";

    const value = document.createElement("p");
    value.className = "history-value";
    value.textContent = item.original;

    const meta = document.createElement("p");
    meta.className = "history-meta";
    meta.textContent = new Date(item.createdAt).toLocaleString();

    content.append(title, value, meta);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const pngButton = document.createElement("button");
    pngButton.type = "button";
    pngButton.className = "download-button";
    pngButton.textContent = "PNG";
    pngButton.addEventListener("click", async () => {
      const exportCanvas = await createExportCanvas(item.qrText, {
        transparentBackground: true,
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor
      });
      exportCanvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `${fileBaseName(item.normalized)}.png`);
        }
      }, "image/png");
    });

    const svgButton = document.createElement("button");
    svgButton.type = "button";
    svgButton.className = "download-button";
    svgButton.textContent = "SVG";
    svgButton.addEventListener("click", async () => {
      const svgBlob = await createSvgBlob(item.qrText, {
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor
      });
      downloadBlob(svgBlob, `${fileBaseName(item.normalized)}.svg`);
    });

    actions.append(pngButton, svgButton);
    card.append(thumb, content, actions);
    fragment.append(card);
  }

  historyList.append(fragment);
}

async function renderSingleQrCode(rawValue) {
  const type = selectedType("single-type");
  const normalized = normalizeValue(rawValue, type);
  const item = buildQrItem({
    original: rawValue.trim(),
    normalized,
    type
  });

  await drawQrCode(canvas, item.qrText, {
    width: 280,
    foregroundColor: item.foregroundColor,
    backgroundColor: item.backgroundColor
  });

  currentSingleData = item;
  storeHistoryItem(item);
  await renderHistory();
  setStatus("QR code ready.");
}

function uniqueNormalizedItems(rawText, type) {
  const values = rawText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`Add at least one ${type === "phone" ? "phone number" : "URL"} for bulk generation.`);
  }

  const uniqueMap = new Map();

  for (const value of values) {
    const normalized = normalizeValue(value, type);

    if (!uniqueMap.has(normalized)) {
      uniqueMap.set(normalized, value);
    }
  }

  return Array.from(uniqueMap.entries()).map(([normalized, original]) =>
    buildQrItem({
      original,
      normalized,
      type
    })
  );
}

async function renderBulkCodes() {
  bulkGrid.innerHTML = "";

  if (bulkItems.length === 0) {
    bulkDownloadAllButton.classList.remove("is-visible");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of bulkItems) {
    const card = document.createElement("article");
    card.className = "bulk-item";

    const bulkCanvas = document.createElement("canvas");
    bulkCanvas.width = 220;
    bulkCanvas.height = 220;
    await drawQrCode(bulkCanvas, item.qrText, {
      width: 220,
      foregroundColor: item.foregroundColor,
      backgroundColor: item.backgroundColor
    });

    const meta = document.createElement("div");
    meta.className = "bulk-item-meta";

    const title = document.createElement("p");
    title.className = "bulk-item-title";
    title.textContent = item.type === "phone" ? "Phone QR" : "URL QR";

    const value = document.createElement("p");
    value.className = "bulk-item-value";
    value.textContent = item.original;

    const actions = document.createElement("div");
    actions.className = "bulk-item-actions";

    const pngButton = document.createElement("button");
    pngButton.type = "button";
    pngButton.className = "download-button";
    pngButton.textContent = "PNG";
    pngButton.addEventListener("click", async () => {
      const exportCanvas = await createExportCanvas(item.qrText, {
        transparentBackground: true,
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor
      });
      exportCanvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `${fileBaseName(item.normalized)}.png`);
        }
      }, "image/png");
    });

    const svgButton = document.createElement("button");
    svgButton.type = "button";
    svgButton.className = "download-button";
    svgButton.textContent = "SVG";
    svgButton.addEventListener("click", async () => {
      const svgBlob = await createSvgBlob(item.qrText, {
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor
      });
      downloadBlob(svgBlob, `${fileBaseName(item.normalized)}.svg`);
    });

    actions.append(pngButton, svgButton);
    meta.append(title, value);
    card.append(bulkCanvas, meta, actions);
    fragment.append(card);
  }

  bulkGrid.append(fragment);
  bulkDownloadAllButton.classList.add("is-visible");
}

async function rerenderAllIfPossible() {
  updateColorOutputs();

  if (currentSingleData) {
    currentSingleData.foregroundColor = foregroundInput.value;
    currentSingleData.backgroundColor = backgroundInput.value;
    await drawQrCode(canvas, currentSingleData.qrText, {
      width: 280,
      foregroundColor: currentSingleData.foregroundColor,
      backgroundColor: currentSingleData.backgroundColor
    });
  }

  if (bulkItems.length > 0) {
    bulkItems = bulkItems.map((item) => ({
      ...item,
      foregroundColor: foregroundInput.value,
      backgroundColor: backgroundInput.value
    }));
    await renderBulkCodes();
  }

  if (historyItems.length > 0) {
    await renderHistory();
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    await renderSingleQrCode(primaryInput.value);
  } catch (error) {
    currentSingleData = null;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setStatus(error.message, "error");
  }
}

async function handleBulkSubmit(event) {
  event.preventDefault();

  try {
    const type = selectedType("bulk-type");
    const items = uniqueNormalizedItems(bulkInput.value, type);
    const rawCount = bulkInput.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean).length;

    bulkItems = items;
    bulkItems.forEach(storeHistoryItem);
    await renderBulkCodes();
    await renderHistory();

    const duplicateCount = rawCount - items.length;
    bulkStatus.textContent =
      duplicateCount > 0
        ? `Generated ${items.length} unique QR codes. Removed ${duplicateCount} duplicate entr${duplicateCount === 1 ? "y" : "ies"}.`
        : `Generated ${items.length} unique QR codes.`;
  } catch (error) {
    bulkItems = [];
    bulkGrid.innerHTML = "";
    bulkDownloadAllButton.classList.remove("is-visible");
    bulkStatus.textContent = error.message;
  }
}

async function handleBulkDownloadAll() {
  for (const item of bulkItems) {
    const exportCanvas = await createExportCanvas(item.qrText, {
      transparentBackground: true,
      foregroundColor: item.foregroundColor,
      backgroundColor: item.backgroundColor
    });

    exportCanvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `${fileBaseName(item.normalized)}.png`);
      }
    }, "image/png");
  }
}

async function downloadSingle(format) {
  if (!currentSingleData) {
    throw new Error("Generate a QR code before downloading.");
  }

  if (format === "svg") {
    const svgBlob = await createSvgBlob(currentSingleData.qrText, {
      foregroundColor: currentSingleData.foregroundColor,
      backgroundColor: currentSingleData.backgroundColor
    });
    downloadBlob(svgBlob, `${fileBaseName(currentSingleData.normalized)}.svg`);
    setStatus("SVG downloaded.");
    return;
  }

  const transparentBackground = format === "png";
  const exportCanvas = await createExportCanvas(currentSingleData.qrText, {
    transparentBackground,
    foregroundColor: currentSingleData.foregroundColor,
    backgroundColor: currentSingleData.backgroundColor
  });

  if (format === "pdf") {
    if (typeof window.jspdf === "undefined") {
      throw new Error("PDF library failed to load.");
    }

    const imageData = exportCanvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [exportCanvas.width, exportCanvas.height]
    });

    pdf.addImage(imageData, "PNG", 0, 0, exportCanvas.width, exportCanvas.height);
    pdf.save(`${fileBaseName(currentSingleData.normalized)}.pdf`);
    setStatus("PDF downloaded.");
    return;
  }

  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  const extension = format === "jpg" ? "jpg" : "png";
  const quality = format === "jpg" ? 0.95 : undefined;

  exportCanvas.toBlob(
    (blob) => {
      if (!blob) {
        setStatus(`${format.toUpperCase()} export failed.`, "error");
        return;
      }

      downloadBlob(blob, `${fileBaseName(currentSingleData.normalized)}.${extension}`);
      setStatus(`${format.toUpperCase()} downloaded.`);
    },
    mimeType,
    quality
  );
}

async function handleDownload(event) {
  try {
    await downloadSingle(event.currentTarget.dataset.download);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

singleTypeInputs.forEach((input) =>
  input.addEventListener("change", () => {
    updateInputCopy();
    primaryInput.value = "";
    currentSingleData = null;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setStatus(`Enter a ${selectedType("single-type") === "phone" ? "phone number" : "URL"} to generate a QR code.`);
  })
);

bulkTypeInputs.forEach((input) =>
  input.addEventListener("change", () => {
    updateInputCopy();
    bulkInput.value = "";
    bulkItems = [];
    bulkGrid.innerHTML = "";
    bulkStatus.textContent = "";
    bulkDownloadAllButton.classList.remove("is-visible");
  })
);

form.addEventListener("submit", handleSubmit);
bulkForm.addEventListener("submit", handleBulkSubmit);
foregroundInput.addEventListener("input", () => rerenderAllIfPossible().catch((error) => setStatus(error.message, "error")));
backgroundInput.addEventListener("input", () => rerenderAllIfPossible().catch((error) => setStatus(error.message, "error")));
downloadButtons.forEach((button) => button.addEventListener("click", handleDownload));
bulkDownloadAllButton.addEventListener("click", () =>
  handleBulkDownloadAll().catch((error) => {
    bulkStatus.textContent = error.message;
  })
);
themeToggle.addEventListener("click", toggleTheme);

updateColorOutputs();
updateInputCopy();
applyTheme("light");
setStatus("Enter a URL to generate a QR code.");
renderHistory();
