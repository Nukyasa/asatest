const adminList = document.querySelector("#admin-list");
const totalEl = document.querySelector("#admin-total");
const likesEl = document.querySelector("#admin-likes");
const messagesEl = document.querySelector("#admin-messages");
const storageEl = document.querySelector("#admin-storage");
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
  meta.textContent = `${photo.guest || "Gost"} - ${photo.category || "Gosti"} - ${photo.likes || 0} srca`;
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

async function loadAdmin() {
  const [photosResponse, configResponse] = await Promise.all([
    fetch("/api/photos"),
    fetch("/api/config")
  ]);
  const photos = await photosResponse.json();
  const config = await configResponse.json();

  totalEl.textContent = photos.length;
  likesEl.textContent = photos.reduce((total, photo) => total + Number(photo.likes || 0), 0);
  messagesEl.textContent = photos.filter((photo) => photo.message).length;
  storageEl.textContent = config.cloudReady ? "cloud" : config.storageMode;

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
