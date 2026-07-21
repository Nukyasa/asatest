const adminList = document.querySelector("#admin-list");
const totalEl = document.querySelector("#admin-total");
const likesEl = document.querySelector("#admin-likes");
const messagesEl = document.querySelector("#admin-messages");
const devicesEl = document.querySelector("#admin-devices");
const storageEl = document.querySelector("#admin-storage");
const limitEl = document.querySelector("#admin-limit");
const backupEl = document.querySelector("#admin-backup");
const liveBadge = document.querySelector("#admin-live-badge");
const statusStorageMode = document.querySelector("#status-storage-mode");
const statusCloud = document.querySelector("#status-cloud");
const statusBackupSync = document.querySelector("#status-backup-sync");
const statusBackupAuto = document.querySelector("#status-backup-auto");
const statusBackupLatest = document.querySelector("#status-backup-latest");
const statusGuests = document.querySelector("#status-guests");
const qrImage = document.querySelector("#admin-qr-image");
const downloadQr = document.querySelector("#download-qr");
const refreshButton = document.querySelector("#refresh-admin");
const runBackupButton = document.querySelector("#run-backup");
const logoutButton = document.querySelector("#admin-logout");

function rowTemplate(photo) {
  const row = document.createElement("article");
  row.className = "admin-photo-row";

  const image = document.createElement("img");
  image.src = photo.url;
  image.alt = "";

  const content = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = photo.caption || "Svadbena uspomena";
  const meta = document.createElement("p");
  meta.textContent = `${photo.guest || "Gost"} - ${photo.likes || 0} srca`;
  const message = document.createElement("p");
  message.textContent = photo.message || "";
  content.append(title, meta, message);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Obrisi";
  deleteButton.addEventListener("click", async () => {
    const response = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
      method: "DELETE"
    });
    if (response.ok) loadAdmin();
  });

  row.append(image, content, deleteButton);
  return row;
}

function formatBackupDate(value) {
  if (!value) return "Nema jos";
  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderStatus(status) {
  totalEl.textContent = status.totalPhotos;
  likesEl.textContent = status.totalLikes;
  messagesEl.textContent = status.messages;
  devicesEl.textContent = `${status.devices}/${status.guests}`;
  storageEl.textContent = status.cloudReady ? "cloud" : status.storageMode;
  limitEl.textContent = status.maxUploadsPerDevice;
  backupEl.textContent = status.latestBackup.exists ? "OK" : "Nema";

  liveBadge.textContent = status.cloudReady || status.storageMode === "local" ? "Online" : "Provjeriti";
  liveBadge.classList.toggle("is-warning", !status.cloudReady && status.storageMode !== "local");
  statusStorageMode.textContent = status.storageMode;
  statusCloud.textContent = status.cloudReady ? "Da" : "Ne";
  statusBackupSync.textContent = status.backupSyncReady ? "Podesen" : "Nije podesen";
  statusBackupAuto.textContent = status.backupOnChange
    ? `Na promjenu + svakih ${status.backupIntervalHours}h`
    : `Svakih ${status.backupIntervalHours}h`;
  statusBackupLatest.textContent = status.latestBackup.exists
    ? `${formatBackupDate(status.latestBackup.createdAt)} (${status.latestBackup.sizeMb} MB)`
    : "Nema jos";
  statusGuests.textContent = `${status.guests} imena, ${status.devices} uredjaja`;
}

async function loadAdmin() {
  const [photosResponse, statusResponse, configResponse] = await Promise.all([
    fetch("/api/photos"),
    fetch("/api/admin/status"),
    fetch("/api/config")
  ]);
  const photos = await photosResponse.json();
  const status = await statusResponse.json();
  const config = await configResponse.json();
  renderStatus(status);

  const galleryUrl = config.publicAppUrl || window.location.origin;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=24&ecc=M&format=png&data=${encodeURIComponent(galleryUrl)}`;
  qrImage.src = qrUrl;
  downloadQr.href = qrUrl;
  downloadQr.download = "nurdin-adna-qr-kod.png";

  adminList.replaceChildren();
  if (!photos.length) {
    const empty = document.createElement("p");
    empty.textContent = "Jos nema uploadovanih slika.";
    adminList.appendChild(empty);
    return;
  }
  photos.forEach((photo) => adminList.appendChild(rowTemplate(photo)));
}

refreshButton.addEventListener("click", loadAdmin);
logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin.html";
});
runBackupButton.addEventListener("click", async () => {
  runBackupButton.disabled = true;
  runBackupButton.textContent = "Backup...";
  try {
    await fetch("/api/backups/run", { method: "POST" });
  } finally {
    runBackupButton.disabled = false;
    runBackupButton.textContent = "Napravi backup";
    loadAdmin();
  }
});
loadAdmin();
