const form = document.querySelector("#qr-form");
const urlInput = document.querySelector("#url-input");
const foregroundInput = document.querySelector("#foreground-color");
const backgroundInput = document.querySelector("#background-color");
const foregroundValue = document.querySelector("#foreground-value");
const backgroundValue = document.querySelector("#background-value");
const statusMessage = document.querySelector("#status-message");
const canvas = document.querySelector("#qr-canvas");
const downloadButtons = document.querySelectorAll("[data-download]");
const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector("#theme-label");
let currentQrUrl = "";

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

async function renderQrCode(rawValue) {
  if (typeof QRCode === "undefined") {
    throw new Error("QR library failed to load. Check your internet connection and refresh.");
  }

  const text = normalizeUrl(rawValue);

  await QRCode.toCanvas(canvas, text, {
    width: 280,
    margin: 2,
    color: {
      dark: foregroundInput.value,
      light: backgroundInput.value
    }
  });

  currentQrUrl = text;
  statusMessage.textContent = "QR code ready.";
  statusMessage.className = "status-message success";
}

function handleError(message) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  currentQrUrl = "";
  statusMessage.textContent = message;
  statusMessage.className = "status-message error";
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    await renderQrCode(urlInput.value);
  } catch (error) {
    handleError(error.message);
  }
}

function rerenderIfPossible() {
  updateColorOutputs();

  if (!urlInput.value.trim()) {
    return;
  }

  renderQrCode(urlInput.value).catch((error) => {
    handleError(error.message);
  });
}

function setStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function createExportCanvas({ transparentBackground = false } = {}) {
  if (!currentQrUrl) {
    throw new Error("Generate a QR code before downloading.");
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1200;
  exportCanvas.height = 1200;

  const options = {
    width: exportCanvas.width,
    margin: 4,
    color: {
      dark: foregroundInput.value,
      light: transparentBackground ? "#0000" : backgroundInput.value
    }
  };

  return QRCode.toCanvas(exportCanvas, currentQrUrl, options).then(() => exportCanvas);
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);

  link.href = objectUrl;
  link.download = fileName;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function fileBaseName() {
  const hostname = currentQrUrl ? new URL(currentQrUrl).hostname.replace(/^www\./, "") : "qr-code";
  return (hostname || "qr-code").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "qr-code";
}

async function downloadPng() {
  const exportCanvas = await createExportCanvas({ transparentBackground: true });

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
  const exportCanvas = await createExportCanvas();

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
  if (typeof window.jspdf === "undefined") {
    throw new Error("PDF library failed to load.");
  }

  const exportCanvas = await createExportCanvas();
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

form.addEventListener("submit", handleSubmit);
foregroundInput.addEventListener("input", rerenderIfPossible);
backgroundInput.addEventListener("input", rerenderIfPossible);
downloadButtons.forEach((button) => button.addEventListener("click", handleDownload));
themeToggle.addEventListener("click", toggleTheme);

updateColorOutputs();
applyTheme("light");
