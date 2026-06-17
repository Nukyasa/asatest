const form = document.querySelector("#upload-form");
const fileInput = document.querySelector("#photo");
const fileLabel = document.querySelector("#file-label");
const statusEl = document.querySelector("#status");
const submitButton = document.querySelector("#submit-button");
const uploadProgress = document.querySelector("#upload-progress");
const uploadProgressBar = document.querySelector("#upload-progress-bar");
const gallery = document.querySelector("#gallery");
const template = document.querySelector("#photo-template");
const emptyState = document.querySelector("#empty-state");
const photoCount = document.querySelector("#photo-count");
const popularSection = document.querySelector("#popular-section");
const popularGrid = document.querySelector("#popular-grid");
const filterButtons = document.querySelectorAll(".filter-button");
const qrImage = document.querySelector("#qr-image");
const shareUrl = document.querySelector("#share-url");
const slideshowButton = document.querySelector("#start-slideshow");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const lightboxMeta = document.querySelector("#lightbox-meta");
const lightboxMessage = document.querySelector("#lightbox-message");
const lightboxClose = document.querySelector(".lightbox-close");
const lightboxPrev = document.querySelector(".lightbox-prev");
const lightboxNext = document.querySelector(".lightbox-next");
const hideSlideshowMessages = document.querySelector("#hide-slideshow-messages");
const countdownDays = document.querySelector("#countdown-days");
const countdownHours = document.querySelector("#countdown-hours");
const countdownMinutes = document.querySelector("#countdown-minutes");

let allPhotos = [];
let visiblePhotos = [];
let activeFilter = "Sve";
let activeIndex = 0;
let slideshowTimer = null;
let slideshowRefreshTimer = null;
let lastUploadHash = "";
let lastUploadAt = 0;
const OPTIMIZED_MAX_SIZE = 1800;
const OPTIMIZED_QUALITY = 0.82;
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
const UPLOAD_COOLDOWN_MS = 3500;
const WEDDING_DATE = new Date("2026-07-25T16:00:00+02:00");
const HERO_IMAGE_CANDIDATES = ["/hero-custom.jpg", "/hero-custom.jpeg", "/hero-custom.png", "/hero-custom.webp"];

function formatCount(count) {
  if (count === 1) return "1 slika";
  if (count > 1 && count < 5) return `${count} slike`;
  return `${count} slika`;
}

function getVisiblePhotos() {
  if (activeFilter === "Najpopularnije") {
    return [...allPhotos].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
  }
  return activeFilter === "Sve"
    ? allPhotos
    : allPhotos.filter((photo) => (photo.category || "Gosti") === activeFilter);
}

function renderPhotos() {
  visiblePhotos = getVisiblePhotos();
  gallery.replaceChildren();
  photoCount.textContent = formatCount(visiblePhotos.length);
  emptyState.hidden = visiblePhotos.length > 0;
  renderPopular();

  visiblePhotos.forEach((photo, index) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".photo-card");
    const openButton = node.querySelector(".photo-link");
    const image = node.querySelector("img");
    const category = node.querySelector(".category");
    const caption = node.querySelector(".caption");
    const message = node.querySelector(".message");
    const guest = node.querySelector(".guest");
    const likeButton = node.querySelector(".like-button");
    const likeCount = node.querySelector(".like-count");

    image.src = photo.url;
    image.alt = photo.caption || `Slika koju je dodao ${photo.guest || "gost"}`;
    category.textContent = photo.category || "Gosti";
    caption.textContent = photo.caption || "Svadbena uspomena";
    message.textContent = photo.message || "";
    message.hidden = !photo.message;
    guest.textContent = photo.guest ? `Dodao/la ${photo.guest}` : "Dodao gost";
    likeCount.textContent = photo.likes || 0;
    card.dataset.photoId = photo.id;

    openButton.addEventListener("click", () => openLightbox(index));
    likeButton.addEventListener("click", () => likePhoto(photo.id));
    gallery.appendChild(node);
  });
}

function renderPopular() {
  const popular = [...allPhotos]
    .filter((photo) => Number(photo.likes || 0) > 0)
    .sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0))
    .slice(0, 3);

  popularGrid.replaceChildren();
  popularSection.hidden = popular.length === 0;
  popular.forEach((photo) => {
    const button = document.createElement("button");
    button.className = "popular-item";
    button.type = "button";
    const image = document.createElement("img");
    image.src = photo.optimizedUrl || photo.url;
    image.alt = photo.caption || "Popularna slika";
    const badge = document.createElement("span");
    badge.textContent = `${photo.likes || 0} srca`;
    button.append(image, badge);
    button.addEventListener("click", () => {
      activeFilter = "Sve";
      visiblePhotos = getVisiblePhotos();
      openLightbox(visiblePhotos.findIndex((entry) => entry.id === photo.id));
    });
    popularGrid.appendChild(button);
  });
}

async function loadPhotos() {
  const response = await fetch("/api/photos");
  if (!response.ok) throw new Error("Galerija trenutno nije dostupna.");
  allPhotos = await response.json();
  renderPhotos();
}

async function likePhoto(id) {
  const response = await fetch(`/api/photos/${encodeURIComponent(id)}/like`, {
    method: "POST"
  });
  if (!response.ok) return;
  const updated = await response.json();
  allPhotos = allPhotos.map((photo) => (photo.id === updated.id ? updated : photo));
  renderPhotos();
  const likedCard = gallery.querySelector(`[data-photo-id="${CSS.escape(id)}"] .like-button`);
  if (likedCard) {
    likedCard.classList.remove("is-liked");
    void likedCard.offsetWidth;
    likedCard.classList.add("is-liked");
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function optimizeImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    const scale = Math.min(1, OPTIMIZED_MAX_SIZE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", OPTIMIZED_QUALITY);
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "-web.jpg"), { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fileHash(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/photos");
    request.timeout = 120000;

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(5, Math.round((event.loaded / event.total) * 100));
      uploadProgressBar.style.width = `${percent}%`;
      statusEl.textContent = `Upload ${percent}%`;
    });

    request.addEventListener("load", () => {
      let payload = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = {};
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error || `Upload nije uspio (${request.status}).`));
    });

    request.addEventListener("timeout", () => {
      reject(new Error("Upload traje predugo. Provjeri internet i pokusaj ponovo."));
    });
    request.addEventListener("error", () => {
      reject(new Error("Upload nije uspio. Provjeri internet konekciju."));
    });
    request.addEventListener("abort", () => {
      reject(new Error("Upload je prekinut."));
    });

    request.send(formData);
  });
}

function friendlyUploadError(error) {
  if (error.message.includes("vec uploadovana")) return error.message;
  if (error.message.includes("413") || error.message.includes("prevelika")) {
    return "Slika je prevelika. Probaj manju sliku ili screenshot.";
  }
  if (error.message.includes("format") || error.message.includes("Dozvoljene")) {
    return "Format slike nije podrzan. Koristi JPG, PNG, WEBP ili GIF.";
  }
  return error.message || "Upload nije uspio. Pokusaj ponovo.";
}

function openLightbox(index) {
  if (!visiblePhotos.length) return;
  activeIndex = index;
  const photo = visiblePhotos[activeIndex];
  lightboxImage.src = photo.optimizedUrl || photo.url;
  lightboxImage.alt = photo.caption || "Svadbena slika";
  lightboxCaption.textContent = photo.caption || "Svadbena uspomena";
  lightboxMeta.textContent = `${photo.category || "Gosti"} - ${photo.guest || "Gost"} - ${photo.likes || 0} srca`;
  lightboxMessage.textContent = photo.message || "";
  lightboxMessage.hidden = !photo.message || (slideshowTimer && hideSlideshowMessages.checked);
  lightbox.hidden = false;
  document.body.classList.add("is-lightbox-open");
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.classList.remove("is-lightbox-open");
  stopSlideshow();
}

function showPhoto(delta) {
  if (!visiblePhotos.length) return;
  activeIndex = (activeIndex + delta + visiblePhotos.length) % visiblePhotos.length;
  openLightbox(activeIndex);
}

function stopSlideshow() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
    slideshowButton.textContent = "Pokreni slideshow";
  }
  if (slideshowRefreshTimer) {
    clearInterval(slideshowRefreshTimer);
    slideshowRefreshTimer = null;
  }
  lightbox.classList.remove("is-slideshow");
}

function startSlideshow() {
  if (!visiblePhotos.length) {
    statusEl.textContent = "Dodaj barem jednu sliku prije slideshow prikaza.";
    return;
  }
  openLightbox(0);
  lightbox.classList.add("is-slideshow");
  slideshowButton.textContent = "Slideshow aktivan";
  slideshowTimer = setInterval(() => showPhoto(1), 4200);
  slideshowRefreshTimer = setInterval(() => {
    loadPhotos().catch(() => {});
  }, 15000);
}

async function setupQr() {
  let url = window.location.origin;
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const config = await response.json();
      if (config.publicAppUrl) url = config.publicAppUrl;
    }
  } catch {
    url = window.location.origin;
  }
  shareUrl.textContent = url;
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileLabel.textContent = file ? file.name : "Izaberi ili uslikaj fotografiju";
});

function updateCountdown() {
  if (!countdownDays || !countdownHours || !countdownMinutes) return;
  const remaining = Math.max(0, WEDDING_DATE.getTime() - Date.now());
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  countdownDays.textContent = String(days);
  countdownHours.textContent = String(hours).padStart(2, "0");
  countdownMinutes.textContent = String(minutes).padStart(2, "0");
}

function imageExists(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function setupHeroImage() {
  for (const candidate of HERO_IMAGE_CANDIDATES) {
    if (await imageExists(candidate)) {
      document.documentElement.style.setProperty("--hero-image", `url("${candidate}")`);
      document.body.classList.add("has-custom-hero");
      return;
    }
  }
}

function startIntroAnimation() {
  requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderPhotos();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "";

  if (!fileInput.files.length) {
    statusEl.textContent = "Prvo izaberi sliku.";
    return;
  }

  const formData = new FormData(form);
  const originalFile = fileInput.files[0];
  if (!originalFile.type.startsWith("image/")) {
    statusEl.textContent = "Izabrani fajl nije slika.";
    return;
  }
  if (originalFile.size > MAX_UPLOAD_BYTES) {
    statusEl.textContent = "Slika je prevelika. Maksimalno je 60 MB.";
    return;
  }

  submitButton.disabled = true;
  uploadProgress.hidden = false;
  uploadProgressBar.style.width = "4%";
  submitButton.textContent = "Priprema slike...";

  try {
    const hash = await fileHash(originalFile);
    const now = Date.now();
    if (hash === lastUploadHash && now - lastUploadAt < 60 * 1000) {
      throw new Error("Ova slika je vec poslana. Pricekaj malo prije ponovnog pokusaja.");
    }
    if (now - lastUploadAt < UPLOAD_COOLDOWN_MS) {
      throw new Error("Pricekaj par sekundi prije sljedeceg uploada.");
    }

    const optimizedFile = await optimizeImage(originalFile);
    formData.set("photo", optimizedFile, optimizedFile.name);
    formData.set("originalPhoto", originalFile, originalFile.name);
    formData.set("originalHash", hash);
    submitButton.textContent = "Upload traje...";

    await uploadWithProgress(formData);
    lastUploadHash = hash;
    lastUploadAt = Date.now();

    form.reset();
    fileLabel.textContent = "Izaberi ili uslikaj fotografiju";
    uploadProgressBar.style.width = "100%";
    statusEl.textContent = "Slika je dodana u galeriju.";
    await loadPhotos();
  } catch (error) {
    statusEl.textContent = friendlyUploadError(error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Posalji u galeriju";
    setTimeout(() => {
      uploadProgress.hidden = true;
      uploadProgressBar.style.width = "0%";
    }, 1000);
  }
});

slideshowButton.addEventListener("click", () => {
  if (slideshowTimer) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", () => showPhoto(-1));
lightboxNext.addEventListener("click", () => showPhoto(1));
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") showPhoto(-1);
  if (event.key === "ArrowRight") showPhoto(1);
});

startIntroAnimation();
setupHeroImage();
setupQr();
updateCountdown();
setInterval(updateCountdown, 60000);
loadPhotos().catch((error) => {
  statusEl.textContent = error.message;
});
