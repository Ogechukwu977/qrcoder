const statusNode = document.querySelector("#redirect-status");
const params = new URLSearchParams(window.location.search);
const key = params.get("key");
const target = params.get("target");
const namespace = "jadyndesignlab-qr";

async function hitCounter() {
  if (!key) {
    return;
  }

  try {
    await fetch(`https://api.countapi.xyz/hit/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
  } catch {
    // Redirect continues even if analytics fails.
  }
}

async function redirect() {
  if (!target) {
    statusNode.textContent = "Missing destination URL.";
    return;
  }

  await hitCounter();
  window.location.replace(target);
}

redirect();
