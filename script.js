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

let currentSingleData = { type: "url", value: "", normalized: "" };
let bulkItems = [];

function selectedType(group) {
  return document.querySelector(`input[name="${group}"]:checked`).value;
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
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
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

  const digitCount = normalizedPhone.replace(/\D/g, "").length;

  if (digitCount < 7) {
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

function setStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function handleError(message) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  currentSingleData = { type: selectedType("single-type"), value: "", normalized: "" };
  setStatus(message, "error");
}

async function drawQrCode(targetCanvas, text, { transparentBackground = false, width = 280 } = {}) {
  if (typeof QRCode === "undefined") {
    throw new Error("QR library failed to load. Check your internet connection and refresh.");
  }

  await QRCode.toCanvas(targetCanvas, text, {
    width,
    margin: 2,
    color: {
      dark: foregroundInput.value,
      light: transparentBackground ? "#0000" : backgroundInput.value
    }
  });
}

async function renderSingleQrCode(rawValue) {
  const type = selectedType("single-type");
  const normalized = normalizeValue(rawValue, type);

  await drawQrCode(canvas, normalized, { width: 280 });

  currentSingleData = {
    type,
    value: rawValue.trim(),
    normalized
  };

  setStatus("QR code ready.");
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    await renderSingleQrCode(primaryInput.value);
  } catch (error) {
    handleError(error.message);
  }
}

function rerenderIfPossible() {
  updateColorOutputs();

  if (!currentSingleData.normalized || !primaryInput.value.trim()) {
    return;
  }

  renderSingleQrCode(primaryInput.value).catch((error) => {
    handleError(error.message);
  });

  if (bulkItems.length > 0) {
    renderBulkCodes().catch((error) => {
      bulkStatus.textContent = error.message;
    });
  }
}

function fileBaseName(source = currentSingleData.normalized) {
  if (!source) {
    return "qr-code";
  }

  if (source.startsWith("tel:")) {
    return source.replace("tel:", "").replace(/[^\d]+/g, "-").replace(/^-|-$/g, "") || "phone-qr";
  }

  const hostname = new URL(source).hostname.replace(/^www\./, "");
  return hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "qr-code";
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);

  link.href = objectUrl;
  link.download = fileName;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function createExportCanvas(text, { transparentBackground = false } = {}) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1200;
  exportCanvas.height = 1200;

  await drawQrCode(exportCanvas, text, {
    transparentBackground,
    width: exportCanvas.width
  });

  return exportCanvas;
}

async function downloadPng() {
  if (!currentSingleData.normalized) {
    throw new Error("Generate a QR code before downloading.");
  }

  const exportCanvas = await createExportCanvas(currentSingleData.normalized, {
    transparentBackground: true
  });

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      handleError("PNG export failed.");
      return;
    }

    downloadBlob(blob, `${fileBaseName()}.png`);
    setStatus("Transparent PNG downloaded.");
  }, "image/png");
}

async function downloadJpg() {
  if (!currentSingleData.normalized) {
    throw new Error("Generate a QR code before downloading.");
  }

  const exportCanvas = await createExportCanvas(currentSingleData.normalized);

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      handleError("JPG export failed.");
      return;
    }

    downloadBlob(blob, `${fileBaseName()}.jpg`);
    setStatus("JPG downloaded.");
  }, "image/jpeg", 0.95);
}

async function downloadPdf() {
  if (!currentSingleData.normalized) {
    throw new Error("Generate a QR code before downloading.");
  }

  if (typeof window.jspdf === "undefined") {
    throw new Error("PDF library failed to load.");
  }

  const exportCanvas = await createExportCanvas(currentSingleData.normalized);
  const imageData = exportCanvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [exportCanvas.width, exportCanvas.height]
  });

  pdf.addImage(imageData, "PNG", 0, 0, exportCanvas.width, exportCanvas.height);
  pdf.save(`${fileBaseName()}.pdf`);
  setStatus("PDF downloaded.");
}

async function handleDownload(event) {
  const format = event.currentTarget.dataset.download;

  try {
    if (format === "png") {
      await downloadPng();
      return;
    }

    if (format === "jpg") {
      await downloadJpg();
      return;
    }

    if (format === "pdf") {
      await downloadPdf();
    }
  } catch (error) {
    handleError(error.message);
  }
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
      uniqueMap.set(normalized, {
        original: value,
        normalized,
        type
      });
    }
  }

  return Array.from(uniqueMap.values());
}

async function renderBulkCodes() {
  bulkGrid.innerHTML = "";

  if (bulkItems.length === 0) {
    bulkDownloadAllButton.classList.remove("is-visible");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const [index, item] of bulkItems.entries()) {
    const card = document.createElement("article");
    card.className = "bulk-item";

    const bulkCanvas = document.createElement("canvas");
    bulkCanvas.width = 220;
    bulkCanvas.height = 220;
    await drawQrCode(bulkCanvas, item.normalized, { width: 220 });

    const meta = document.createElement("div");
    meta.className = "bulk-item-meta";

    const title = document.createElement("p");
    title.className = "bulk-item-title";
    title.textContent = `QR ${index + 1}`;

    const value = document.createElement("p");
    value.className = "bulk-item-value";
    value.textContent = item.original;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "download-button";
    button.textContent = "Download PNG";
    button.addEventListener("click", async () => {
      const exportCanvas = await createExportCanvas(item.normalized, { transparentBackground: true });
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          bulkStatus.textContent = "Bulk PNG export failed.";
          return;
        }

        downloadBlob(blob, `${fileBaseName(item.normalized)}-${index + 1}.png`);
      }, "image/png");
    });

    meta.append(title, value);
    card.append(bulkCanvas, meta, button);
    fragment.append(card);
  }

  bulkGrid.append(fragment);
  bulkDownloadAllButton.classList.add("is-visible");
}

async function handleBulkSubmit(event) {
  event.preventDefault();

  try {
    const type = selectedType("bulk-type");
    const uniqueItems = uniqueNormalizedItems(bulkInput.value, type);
    const rawCount = bulkInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean).length;

    bulkItems = uniqueItems;
    await renderBulkCodes();

    const duplicateCount = rawCount - uniqueItems.length;
    bulkStatus.textContent =
      duplicateCount > 0
        ? `Generated ${uniqueItems.length} unique QR codes. Removed ${duplicateCount} duplicate entr${duplicateCount === 1 ? "y" : "ies"}.`
        : `Generated ${uniqueItems.length} unique QR codes.`;
  } catch (error) {
    bulkItems = [];
    bulkGrid.innerHTML = "";
    bulkDownloadAllButton.classList.remove("is-visible");
    bulkStatus.textContent = error.message;
  }
}

async function handleBulkDownloadAll() {
  for (const [index, item] of bulkItems.entries()) {
    const exportCanvas = await createExportCanvas(item.normalized, { transparentBackground: true });

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        bulkStatus.textContent = "One of the bulk PNG exports failed.";
        return;
      }

      downloadBlob(blob, `${fileBaseName(item.normalized)}-${index + 1}.png`);
    }, "image/png");
  }
}

singleTypeInputs.forEach((input) =>
  input.addEventListener("change", () => {
    updateInputCopy();
    primaryInput.value = "";
    currentSingleData = { type: selectedType("single-type"), value: "", normalized: "" };
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
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
foregroundInput.addEventListener("input", rerenderIfPossible);
backgroundInput.addEventListener("input", rerenderIfPossible);
downloadButtons.forEach((button) => button.addEventListener("click", handleDownload));
bulkDownloadAllButton.addEventListener("click", handleBulkDownloadAll);
themeToggle.addEventListener("click", toggleTheme);

updateColorOutputs();
updateInputCopy();
applyTheme("light");
setStatus("Enter a URL to generate a QR code.");
