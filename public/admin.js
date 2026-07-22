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
const searchInput = document.querySelector("#admin-search");
const videoLightbox = document.querySelector("#admin-video-lightbox");
const videoViewer = document.querySelector("#admin-video-viewer");
const videoClose = document.querySelector("#admin-video-close");
let adminPhotos = [];

function closeAdminVideo() {
  videoLightbox.hidden = true;
  videoViewer.replaceChildren();
  document.body.classList.remove("admin-video-open");
}

function openAdminVideo(photo) {
  videoViewer.replaceChildren();
  if (photo.drivePreviewUrl) {
    const frame = document.createElement("iframe");
    frame.src = photo.drivePreviewUrl;
    frame.title = "Pregled svadbenog videa";
    frame.allow = "autoplay; fullscreen";
    frame.allowFullscreen = true;
    videoViewer.appendChild(frame);
  } else {
    const video = document.createElement("video");
    video.src = photo.optimizedUrl || photo.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    videoViewer.appendChild(video);
  }
  videoLightbox.hidden = false;
  document.body.classList.add("admin-video-open");
}

function buildQrWithLogo(sourceUrl) {
  return new Promise((resolve) => {
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth || 900;
      canvas.height = source.naturalHeight || 900;
      const context = canvas.getContext("2d");
      context.drawImage(source, 0, 0, canvas.width, canvas.height);

      const size = Math.round(canvas.width * 0.19);
      const center = canvas.width / 2;
      context.fillStyle = "#fffdf8";
      context.beginPath();
      context.arc(center, center, size / 2 + 14, 0, Math.PI * 2);
      context.fill();

      const logoGradient = context.createLinearGradient(center - size / 2, center + size / 2, center + size / 2, center - size / 2);
      logoGradient.addColorStop(0, "#bd5b91");
      logoGradient.addColorStop(1, "#e0a84f");
      context.fillStyle = logoGradient;
      context.beginPath();
      context.arc(center, center, size / 2, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#fffdf8";
      context.font = `700 ${Math.round(size * 0.27)}px Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("N & A", center, center);
      resolve(canvas.toDataURL("image/png"));
    };
    source.onerror = () => resolve(sourceUrl);
    source.src = sourceUrl;
  });
}

function rowTemplate(photo) {
  const row = document.createElement("article");
  row.className = "admin-photo-row";

  const isVideo = String(photo.mediaType || photo.mimeType || "").startsWith("video/");
  const media = document.createElement("div");
  media.className = `admin-media-frame${isVideo ? " is-video" : ""}`;
  const image = document.createElement("img");
  image.src = isVideo ? (photo.driveThumbnailUrl || photo.optimizedUrl || photo.url) : (photo.optimizedUrl || photo.url);
  image.alt = isVideo ? "Prvi kadar svadbenog videa" : "Svadbena uspomena";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    const fallback = photo.optimizedUrl || photo.originalUrl;
    if (fallback && image.src !== fallback) image.src = fallback;
  }, { once: true });
  media.appendChild(image);

  if (isVideo) {
    const videoLabel = document.createElement("span");
    videoLabel.className = "admin-video-label";
    videoLabel.textContent = "VIDEO";
    media.appendChild(videoLabel);
    const openVideo = document.createElement("button");
    openVideo.className = "admin-play-button";
    openVideo.type = "button";
    openVideo.setAttribute("aria-label", "Otvori video");
    openVideo.innerHTML = "<span aria-hidden=\"true\">▶</span>";
    openVideo.addEventListener("click", () => openAdminVideo(photo));
    media.appendChild(openVideo);
  }

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
    if (!window.confirm("Obrisati ovu uspomenu?")) return;
    const response = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
      method: "DELETE"
    });
    if (response.ok) loadAdmin();
  });

  row.append(media, content, deleteButton);
  return row;
}

function renderAdminList() {
  const query = searchInput.value.trim().toLowerCase();
  adminList.replaceChildren();
  const filtered = adminPhotos.filter((photo) => [photo.caption, photo.message, photo.guest, photo.originalName]
    .filter(Boolean).join(" ").toLowerCase().includes(query));
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty-copy";
    empty.textContent = query ? "Nema rezultata za ovu pretragu." : "Još nema uploadovanih uspomena.";
    adminList.appendChild(empty);
    return;
  }
  filtered.forEach((photo) => adminList.appendChild(rowTemplate(photo)));
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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=24&ecc=H&format=png&data=${encodeURIComponent(galleryUrl)}`;
  const qrWithLogo = await buildQrWithLogo(qrUrl);
  qrImage.src = qrWithLogo;
  downloadQr.href = qrWithLogo;
  downloadQr.download = "nurdin-adna-qr-kod.png";

  adminPhotos = photos;
  renderAdminList();
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
searchInput.addEventListener("input", renderAdminList);
videoClose.addEventListener("click", closeAdminVideo);
videoLightbox.addEventListener("click", (event) => {
  if (event.target === videoLightbox) closeAdminVideo();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !videoLightbox.hidden) closeAdminVideo();
});
loadAdmin();
