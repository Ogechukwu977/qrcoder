const HISTORY_KEY = "qr-code-history-v1";
const ANALYTICS_NAMESPACE = "jadyndesignlab-qr";
const MAX_HISTORY_ITEMS = 50;

const form = document.querySelector("#qr-form");
const primaryInput = document.querySelector("#primary-input");
const primaryLabel = document.querySelector("#primary-label");
const foregroundInput = document.querySelector("#foreground-color");
const backgroundInput = document.querySelector("#background-color");
const foregroundValue = document.querySelector("#foreground-value");
const backgroundValue = document.querySelector("#background-value");
const logoUpload = document.querySelector("#logo-upload");
const statusMessage = document.querySelector("#status-message");
const trackingNote = document.querySelector("#tracking-note");
const canvas = document.querySelector("#qr-canvas");
const singleScanCount = document.querySelector("#single-scan-count");
const singleTrackUrl = document.querySelector("#single-track-url");
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

const analyticsEnabled = ["http:", "https:"].includes(window.location.protocol);
let currentLogoDataUrl = "";
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

function updateColorOutputs() {
  foregroundValue.textContent = foregroundInput.value;
  backgroundValue.textContent = backgroundInput.value;
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

function analyticsApiUrl(action, key) {
  return `https://api.countapi.xyz/${action}/${encodeURIComponent(ANALYTICS_NAMESPACE)}/${encodeURIComponent(key)}`;
}

async function fetchScanCount(counterKey) {
  if (!analyticsEnabled || !counterKey) {
    return 0;
  }

  try {
    const response = await fetch(analyticsApiUrl("get", counterKey));
    const payload = await response.json();
    return typeof payload.value === "number" ? payload.value : 0;
  } catch {
    return 0;
  }
}

function createCounterKey() {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12)
      : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;

  return `qr-${Date.now()}-${randomPart}`.slice(0, 63);
}

function buildTrackableUrl(counterKey, target) {
  if (!analyticsEnabled) {
    return target;
  }

  const redirectUrl = new URL("./redirect.html", window.location.href);
  redirectUrl.searchParams.set("key", counterKey);
  redirectUrl.searchParams.set("target", target);
  return redirectUrl.toString();
}

function updateSingleAnalyticsDisplay(item) {
  if (!item) {
    singleScanCount.textContent = analyticsEnabled ? "Scans: 0" : "Scans unavailable in local file mode";
    singleTrackUrl.textContent = "";
    return;
  }

  if (analyticsEnabled) {
    singleScanCount.textContent = `Scans: ${item.scanCount ?? 0}`;
    singleTrackUrl.textContent = item.trackUrl;
  } else {
    singleScanCount.textContent = "Scans unavailable in local file mode";
    singleTrackUrl.textContent = "Host this app on a public http(s) URL to enable scan analytics.";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Logo upload failed."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Logo image could not be loaded."));
    image.src = source;
  });
}

async function drawLogoOverlay(targetCanvas, logoDataUrl) {
  if (!logoDataUrl) {
    return;
  }

  const context = targetCanvas.getContext("2d");
  const image = await loadImage(logoDataUrl);
  const size = targetCanvas.width;
  const backdropSize = size * 0.24;
  const logoSize = size * 0.16;
  const offset = (size - backdropSize) / 2;
  const logoOffset = (size - logoSize) / 2;
  const radius = backdropSize * 0.22;

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(offset + radius, offset);
  context.lineTo(offset + backdropSize - radius, offset);
  context.quadraticCurveTo(offset + backdropSize, offset, offset + backdropSize, offset + radius);
  context.lineTo(offset + backdropSize, offset + backdropSize - radius);
  context.quadraticCurveTo(
    offset + backdropSize,
    offset + backdropSize,
    offset + backdropSize - radius,
    offset + backdropSize
  );
  context.lineTo(offset + radius, offset + backdropSize);
  context.quadraticCurveTo(offset, offset + backdropSize, offset, offset + backdropSize - radius);
  context.lineTo(offset, offset + radius);
  context.quadraticCurveTo(offset, offset, offset + radius, offset);
  context.closePath();
  context.fill();

  context.drawImage(image, logoOffset, logoOffset, logoSize, logoSize);
}

async function drawQrCode(
  targetCanvas,
  text,
  {
    transparentBackground = false,
    width = 280,
    logoDataUrl = "",
    foregroundColor = foregroundInput.value,
    backgroundColor = backgroundInput.value
  } = {}
) {
  if (typeof QRCode === "undefined") {
    throw new Error("QR library failed to load. Check your internet connection and refresh.");
  }

  await QRCode.toCanvas(targetCanvas, text, {
    width,
    margin: 2,
    color: {
      dark: foregroundColor,
      light: transparentBackground ? "#0000" : backgroundColor
    }
  });

  if (logoDataUrl) {
    await drawLogoOverlay(targetCanvas, logoDataUrl);
  }
}

async function createExportCanvas(
  text,
  {
    transparentBackground = false,
    logoDataUrl = "",
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
    logoDataUrl,
    foregroundColor,
    backgroundColor
  });

  return exportCanvas;
}

function buildSvgWithLogo(svgMarkup, logoDataUrl) {
  if (!logoDataUrl) {
    return svgMarkup;
  }

  const viewBoxMatch = svgMarkup.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/i);

  if (!viewBoxMatch) {
    return svgMarkup;
  }

  const size = Number(viewBoxMatch[1]);
  const backdropSize = size * 0.24;
  const logoSize = size * 0.16;
  const offset = (size - backdropSize) / 2;
  const logoOffset = (size - logoSize) / 2;
  const radius = backdropSize * 0.22;
  const overlay = `
    <rect x="${offset}" y="${offset}" width="${backdropSize}" height="${backdropSize}" rx="${radius}" ry="${radius}" fill="#ffffff" />
    <image href="${logoDataUrl}" x="${logoOffset}" y="${logoOffset}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />
  `;

  return svgMarkup.replace("</svg>", `${overlay}</svg>`);
}

async function createSvgBlob(
  text,
  logoDataUrl = "",
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

  const finalMarkup = buildSvgWithLogo(svgMarkup, logoDataUrl);
  return new Blob([finalMarkup], { type: "image/svg+xml;charset=utf-8" });
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

async function syncHistoryCounts() {
  if (!analyticsEnabled || historyItems.length === 0) {
    renderHistory();
    return;
  }

  historyItems = await Promise.all(
    historyItems.map(async (item) => ({
      ...item,
      scanCount: await fetchScanCount(item.counterKey)
    }))
  );

  saveHistory();
  renderHistory();

  if (currentSingleData) {
    const match = historyItems.find((item) => item.id === currentSingleData.id);
    if (match) {
      currentSingleData.scanCount = match.scanCount;
      updateSingleAnalyticsDisplay(currentSingleData);
    }
  }
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
      logoDataUrl: item.logoDataUrl || "",
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
    meta.textContent = analyticsEnabled
      ? `Scans: ${item.scanCount ?? 0} • ${new Date(item.createdAt).toLocaleString()}`
      : `${new Date(item.createdAt).toLocaleString()} • Analytics needs http(s) hosting`;

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
        logoDataUrl: item.logoDataUrl || "",
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor
      });
      exportCanvas.toBlob((blob) => blob && downloadBlob(blob, `${fileBaseName(item.normalized)}.png`), "image/png");
    });

    const svgButton = document.createElement("button");
    svgButton.type = "button";
    svgButton.className = "download-button";
    svgButton.textContent = "SVG";
    svgButton.addEventListener("click", async () => {
      const svgBlob = await createSvgBlob(item.qrText, item.logoDataUrl || "", {
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

function buildQrItem({ original, normalized, type, logoDataUrl = "" }) {
  const counterKey = createCounterKey();
  const qrText = buildTrackableUrl(counterKey, normalized);

  return {
    id: `${counterKey}-${Date.now()}`,
    original,
    normalized,
    type,
    counterKey,
    qrText,
    trackUrl: qrText,
    scanCount: 0,
    createdAt: new Date().toISOString(),
    logoDataUrl,
    foregroundColor: foregroundInput.value,
    backgroundColor: backgroundInput.value
  };
}

async function renderSingleQrCode(rawValue) {
  const type = selectedType("single-type");
  const normalized = normalizeValue(rawValue, type);
  const item = buildQrItem({
    original: rawValue.trim(),
    normalized,
    type,
    logoDataUrl: currentLogoDataUrl
  });

  await drawQrCode(canvas, item.qrText, {
    width: 280,
    logoDataUrl: currentLogoDataUrl,
    foregroundColor: item.foregroundColor,
    backgroundColor: item.backgroundColor
  });

  currentSingleData = item;
  updateSingleAnalyticsDisplay(item);
  storeHistoryItem(item);
  renderHistory();
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
      type,
      logoDataUrl: currentLogoDataUrl
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
      logoDataUrl: item.logoDataUrl || "",
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
    value.textContent = analyticsEnabled ? `${item.original} • Scans: ${item.scanCount}` : item.original;

    const actions = document.createElement("div");
    actions.className = "bulk-item-actions";

    const pngButton = document.createElement("button");
    pngButton.type = "button";
    pngButton.className = "download-button";
    pngButton.textContent = "PNG";
    pngButton.addEventListener("click", async () => {
      const exportCanvas = await createExportCanvas(item.qrText, {
        transparentBackground: true,
        logoDataUrl: item.logoDataUrl || "",
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor
      });
      exportCanvas.toBlob((blob) => blob && downloadBlob(blob, `${fileBaseName(item.normalized)}.png`), "image/png");
    });

    const svgButton = document.createElement("button");
    svgButton.type = "button";
    svgButton.className = "download-button";
    svgButton.textContent = "SVG";
    svgButton.addEventListener("click", async () => {
      const svgBlob = await createSvgBlob(item.qrText, item.logoDataUrl || "", {
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

async function rerenderSingleIfPossible() {
  if (!currentSingleData) {
    return;
  }

  await drawQrCode(canvas, currentSingleData.qrText, {
    width: 280,
    logoDataUrl: currentSingleData.logoDataUrl || "",
    foregroundColor: currentSingleData.foregroundColor,
    backgroundColor: currentSingleData.backgroundColor
  });
}

async function rerenderAllIfPossible() {
  updateColorOutputs();

  if (currentSingleData) {
    currentSingleData.logoDataUrl = currentLogoDataUrl;
    currentSingleData.foregroundColor = foregroundInput.value;
    currentSingleData.backgroundColor = backgroundInput.value;
    await rerenderSingleIfPossible();
  }

  if (bulkItems.length > 0) {
    bulkItems = bulkItems.map((item) => ({
      ...item,
      logoDataUrl: currentLogoDataUrl,
      foregroundColor: foregroundInput.value,
      backgroundColor: backgroundInput.value
    }));
    await renderBulkCodes();
  }

  if (historyItems.length > 0) {
    renderHistory();
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    await renderSingleQrCode(primaryInput.value);
  } catch (error) {
    currentSingleData = null;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    updateSingleAnalyticsDisplay(null);
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
    renderHistory();

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
      logoDataUrl: item.logoDataUrl || "",
      foregroundColor: item.foregroundColor,
      backgroundColor: item.backgroundColor
    });

    exportCanvas.toBlob((blob) => blob && downloadBlob(blob, `${fileBaseName(item.normalized)}.png`), "image/png");
  }
}

async function downloadSingle(format) {
  if (!currentSingleData) {
    throw new Error("Generate a QR code before downloading.");
  }

  if (format === "svg") {
    const svgBlob = await createSvgBlob(currentSingleData.qrText, currentSingleData.logoDataUrl || "", {
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
    logoDataUrl: currentSingleData.logoDataUrl || "",
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
  const fileExtension = format === "jpg" ? "jpg" : "png";
  const quality = format === "jpg" ? 0.95 : undefined;

  exportCanvas.toBlob(
    (blob) => {
      if (!blob) {
        setStatus(`${format.toUpperCase()} export failed.`, "error");
        return;
      }

      downloadBlob(blob, `${fileBaseName(currentSingleData.normalized)}.${fileExtension}`);
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

async function handleLogoUpload(event) {
  const [file] = event.target.files || [];

  if (!file) {
    currentLogoDataUrl = "";

    if (currentSingleData) {
      currentSingleData.logoDataUrl = "";
    }

    await rerenderAllIfPossible();
    return;
  }

  try {
    currentLogoDataUrl = await readFileAsDataUrl(file);

    if (currentSingleData) {
      currentSingleData.logoDataUrl = currentLogoDataUrl;
    }

    await rerenderAllIfPossible();
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
    updateSingleAnalyticsDisplay(null);
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
logoUpload.addEventListener("change", (event) => handleLogoUpload(event));
downloadButtons.forEach((button) => button.addEventListener("click", handleDownload));
bulkDownloadAllButton.addEventListener("click", () =>
  handleBulkDownloadAll().catch((error) => {
    bulkStatus.textContent = error.message;
  })
);
themeToggle.addEventListener("click", toggleTheme);

trackingNote.textContent = analyticsEnabled
  ? "Scan analytics are active. Every generated QR code uses a trackable redirect URL."
  : "Scan analytics need this app to be hosted on a public http(s) URL. Local file mode can still generate QR codes.";

updateColorOutputs();
updateInputCopy();
applyTheme("light");
updateSingleAnalyticsDisplay(null);
setStatus("Enter a URL to generate a QR code.");
renderHistory();
syncHistoryCounts();
