const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!name || process.env[name] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[name] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 5177);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const ORIGINAL_UPLOAD_DIR = path.join(UPLOAD_DIR, "originals");
const OPTIMIZED_UPLOAD_DIR = path.join(UPLOAD_DIR, "optimized");
const DATA_DIR = path.join(ROOT, "data");
const BACKUP_DIR = path.join(ROOT, "backups");
const PHOTOS_FILE = path.join(DATA_DIR, "photos.json");
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
const BACKUP_SYNC_DIR = process.env.BACKUP_SYNC_DIR || "";
const BACKUP_INTERVAL_HOURS = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24));
const BACKUP_ON_CHANGE = process.env.BACKUP_ON_CHANGE !== "false";
const BACKUP_CHANGE_DELAY_SECONDS = Math.max(10, Number(process.env.BACKUP_CHANGE_DELAY_SECONDS || 120));
const STORE_ORIGINAL_UPLOADS = process.env.STORE_ORIGINAL_UPLOADS !== "false";
const MAX_UPLOADS_PER_DEVICE = Math.max(1, Number(process.env.MAX_UPLOADS_PER_DEVICE || 5));
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "wedding-photos";
const SUPABASE_PHOTOS_TABLE = process.env.SUPABASE_PHOTOS_TABLE || "wedding_photos";
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "nurdin-adna-svadba";
const HAS_CLOUDINARY = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "wedding-photos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
const HAS_R2 = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);
const GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "";
const GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64 = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64 || "";
const GOOGLE_DRIVE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || "";
const GOOGLE_DRIVE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "";
const GOOGLE_DRIVE_REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "";
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
const GOOGLE_DRIVE_PUBLIC = process.env.GOOGLE_DRIVE_PUBLIC !== "false";
const HAS_GOOGLE_DRIVE_OAUTH = Boolean(
  GOOGLE_DRIVE_CLIENT_ID && GOOGLE_DRIVE_CLIENT_SECRET && GOOGLE_DRIVE_REFRESH_TOKEN && GOOGLE_DRIVE_FOLDER_ID
);
const HAS_GOOGLE_DRIVE_SERVICE_ACCOUNT = Boolean(
  (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64) && GOOGLE_DRIVE_FOLDER_ID
);
const HAS_GOOGLE_DRIVE = HAS_GOOGLE_DRIVE_OAUTH || HAS_GOOGLE_DRIVE_SERVICE_ACCOUNT;
const STORAGE_MODE = process.env.STORAGE_MODE || (HAS_R2 ? "r2" : HAS_CLOUDINARY ? "cloudinary" : HAS_SUPABASE ? "supabase" : "local");
const USE_SUPABASE_DB = HAS_SUPABASE && STORAGE_MODE !== "local";
const CLOUD_PUBLIC_URL = process.env.CLOUD_PUBLIC_URL || "";
const CLOUD_STORAGE_READY =
  STORAGE_MODE === "r2"
    ? HAS_R2
    : STORAGE_MODE === "drive"
      ? HAS_GOOGLE_DRIVE
    : STORAGE_MODE === "cloudinary"
      ? HAS_CLOUDINARY
      : STORAGE_MODE === "supabase"
        ? HAS_SUPABASE
        : Boolean(CLOUD_PUBLIC_URL);
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v"
};

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime", "video/x-m4v"
]);
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v"
};

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ORIGINAL_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OPTIMIZED_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_FILE)) {
  fs.writeFileSync(PHOTOS_FILE, "[]\n");
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=");
        return index === -1 ? [entry, ""] : [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
      })
  );
}

function adminToken() {
  return crypto.createHash("sha256").update(`${ADMIN_PASSWORD}:${ADMIN_SESSION_SECRET}`).digest("hex");
}

function isAdminAuthenticated(req) {
  if (!ADMIN_PASSWORD) return false;
  return parseCookies(req).wedding_admin === adminToken();
}

function normalizeDeviceId(value) {
  return /^[a-f0-9-]{36}$/i.test(value || "") ? value : "";
}

function getUploadDeviceId(req) {
  return normalizeDeviceId(parseCookies(req).wedding_device) || crypto.randomUUID();
}

function uploadDeviceCookie(deviceId) {
  return `wedding_device=${encodeURIComponent(deviceId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`;
}

function sendUnauthorized(res) {
  sendJson(res, 401, { error: "Admin pristup zahtijeva login." });
}

function sendBuffer(res, statusCode, payload, headers) {
  res.writeHead(statusCode, {
    "Content-Length": payload.length,
    ...headers
  });
  res.end(payload);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function normalizePhoto(photo) {
  return {
    likes: 0,
    message: "",
    hidden: false,
    optimizedUrl: photo.url,
    originalUrl: photo.url,
    ...photo
  };
}

function driveFileIdFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return "";
  try {
    const parsed = new URL(fileUrl);
    if (!parsed.hostname.endsWith("google.com") && !parsed.hostname.endsWith("googleusercontent.com")) return "";
    return parsed.searchParams.get("id") || "";
  } catch {
    return "";
  }
}

function publicPhoto(photo) {
  const result = { ...photo };
  if (result.storage !== "drive") return result;

  const previewFileId = result.optimizedObjectPath || driveFileIdFromUrl(result.optimizedUrl || result.url);
  if (previewFileId && String(result.mediaType || result.mimeType || "").startsWith("video/")) {
    result.drivePreviewUrl = `https://drive.google.com/file/d/${encodeURIComponent(previewFileId)}/preview`;
  }

  ["url", "optimizedUrl", "originalUrl"].forEach((field) => {
    const fileId = driveFileIdFromUrl(result[field]);
    if (fileId) result[field] = `/api/media/${encodeURIComponent(fileId)}`;
  });
  return result;
}

function readLocalPhotos() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PHOTOS_FILE, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePhoto);
  } catch {
    return [];
  }
}

function writeLocalPhotos(photos) {
  fs.writeFileSync(PHOTOS_FILE, `${JSON.stringify(photos, null, 2)}\n`);
}

async function supabaseRest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase baza nije odgovorila: ${response.status} ${detail}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function readPhotos() {
  if (!USE_SUPABASE_DB) return readLocalPhotos();
  const rows = await supabaseRest(`${SUPABASE_PHOTOS_TABLE}?select=photo&order=created_at.desc`);
  return rows.map((row) => normalizePhoto(row.photo || {}));
}

async function insertPhoto(photo) {
  if (!USE_SUPABASE_DB) {
    const photos = readLocalPhotos();
    photos.unshift(photo);
    writeLocalPhotos(photos);
    scheduleBackupAfterChange();
    return photo;
  }

  await supabaseRest(SUPABASE_PHOTOS_TABLE, {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      id: photo.id,
      photo,
      created_at: photo.uploadedAt
    })
  });
  scheduleBackupAfterChange();
  return photo;
}

async function replacePhoto(photo) {
  if (!USE_SUPABASE_DB) {
    const photos = readLocalPhotos().map((entry) => (entry.id === photo.id ? photo : entry));
    writeLocalPhotos(photos);
    scheduleBackupAfterChange();
    return photo;
  }

  await supabaseRest(`${SUPABASE_PHOTOS_TABLE}?id=eq.${encodeURIComponent(photo.id)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ photo })
  });
  scheduleBackupAfterChange();
  return photo;
}

async function removePhotoRow(id) {
  if (!USE_SUPABASE_DB) {
    writeLocalPhotos(readLocalPhotos().filter((entry) => entry.id !== id));
    scheduleBackupAfterChange();
    return;
  }

  await supabaseRest(`${SUPABASE_PHOTOS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" }
  });
  scheduleBackupAfterChange();
}

function safePublicPath(baseDir, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(baseDir, normalized);
  return filePath.startsWith(baseDir) ? filePath : null;
}

function serveFile(res, filePath) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      sendError(res, 404, "Fajl nije pronadjen.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": filePath.includes(`${path.sep}uploads${path.sep}`)
        ? "public, max-age=31536000, immutable"
        : "no-store, max-age=0, must-revalidate"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        reject(new Error("Slika je prevelika. Maksimalna velicina je 60 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let position = buffer.indexOf(boundaryBuffer);

  while (position !== -1) {
    let nextPosition = buffer.indexOf(boundaryBuffer, position + boundaryBuffer.length);
    if (nextPosition === -1) break;

    let part = buffer.slice(position + boundaryBuffer.length, nextPosition);
    if (part.slice(0, 2).toString() === "\r\n") part = part.slice(2);
    if (part.slice(-2).toString() === "\r\n") part = part.slice(0, -2);

    const separator = part.indexOf(Buffer.from("\r\n\r\n"));
    if (separator !== -1) {
      const rawHeaders = part.slice(0, separator).toString("utf8");
      const content = part.slice(separator + 4);
      const headers = {};
      rawHeaders.split("\r\n").forEach((line) => {
        const index = line.indexOf(":");
        if (index > -1) {
          headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
        }
      });
      parts.push({ headers, content });
    }

    position = nextPosition;
  }

  return parts;
}

function getDispositionValue(disposition, key) {
  const match = new RegExp(`${key}="([^"]*)"`).exec(disposition || "");
  return match ? match[1] : "";
}

function getTextPart(parts, name, maxLength) {
  const part = parts.find((entry) => {
    const disposition = entry.headers["content-disposition"] || "";
    return getDispositionValue(disposition, "name") === name;
  });
  return part ? part.content.toString("utf8").trim().slice(0, maxLength) : "";
}

function findPart(parts, name) {
  return parts.find((entry) => {
    const disposition = entry.headers["content-disposition"] || "";
    return getDispositionValue(disposition, "name") === name;
  });
}

function getPhotoFilename(photo) {
  try {
    return path.basename(new URL(photo.url, "http://localhost").pathname);
  } catch {
    return "";
  }
}

function getUrlPathname(fileUrl) {
  try {
    return decodeURIComponent(new URL(fileUrl, "http://localhost").pathname);
  } catch {
    return "";
  }
}

function getLocalUploadPath(fileUrl) {
  const pathname = getUrlPathname(fileUrl);
  if (!pathname.startsWith("/uploads/")) return null;
  return safePublicPath(UPLOAD_DIR, pathname.replace("/uploads/", ""));
}

function getExtensionFromMime(mimeType, fallbackName) {
  return EXT_BY_MIME[mimeType] || path.extname(fallbackName || "").toLowerCase() || ".jpg";
}

function supabasePublicUrl(objectPath) {
  const base = CLOUD_PUBLIC_URL || `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${SUPABASE_BUCKET}`;
  return `${base.replace(/\/$/, "")}/${objectPath}`;
}

async function uploadToSupabase(objectPath, content, contentType) {
  const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "cache-control": "3600",
      "content-type": contentType,
      "x-upsert": "false"
    },
    body: content
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase upload nije uspio: ${response.status} ${detail}`);
  }

  return supabasePublicUrl(objectPath);
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function googleDriveServiceAccount() {
  try {
    const raw = GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
      : GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    return JSON.parse(raw);
  } catch {
    throw new Error("Google Drive service account JSON nije ispravan.");
  }
}

async function googleDriveAccessToken() {
  if (!HAS_GOOGLE_DRIVE) {
    throw new Error("Google Drive nije konfigurisan. Potrebni su OAuth podaci ili service account i GOOGLE_DRIVE_FOLDER_ID.");
  }

  if (HAS_GOOGLE_DRIVE_OAUTH) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        client_secret: GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN,
        grant_type: "refresh_token"
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(`Google Drive OAuth token nije dostupan: ${response.status} ${payload.error_description || ""}`.trim());
    }
    return payload.access_token;
  }

  const account = googleDriveServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(account.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google Drive token nije dostupan: ${response.status} ${payload.error_description || ""}`.trim());
  }
  return payload.access_token;
}

function googleDrivePublicUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

async function uploadToGoogleDrive(objectPath, content, contentType) {
  const token = await googleDriveAccessToken();
  const boundary = `drive-${crypto.randomBytes(12).toString("hex")}`;
  const metadata = Buffer.from(JSON.stringify({
    name: path.basename(objectPath),
    parents: [GOOGLE_DRIVE_FOLDER_ID]
  }));
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    metadata,
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": `multipart/related; boundary=${boundary}`
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) {
    throw new Error(`Google Drive upload nije uspio: ${response.status} ${payload.error?.message || ""}`.trim());
  }

  if (GOOGLE_DRIVE_PUBLIC) {
    const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(payload.id)}/permissions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ role: "reader", type: "anyone" })
    });
    if (!permissionResponse.ok) {
      const detail = await permissionResponse.text().catch(() => "");
      throw new Error(`Google Drive dozvola nije podešena: ${permissionResponse.status} ${detail}`);
    }
  }

  return { url: googleDrivePublicUrl(payload.id), fileId: payload.id };
}

async function deleteGoogleDriveAsset(fileId) {
  if (!HAS_GOOGLE_DRIVE || !fileId) return;
  try {
    const token = await googleDriveAccessToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error(`Google Drive brisanje nije uspjelo za ${fileId}: ${error.message}`);
  }
}

function cloudinarySignature(params) {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${CLOUDINARY_API_SECRET}`).digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function awsUriEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function r2ObjectUrl(objectPath) {
  const encodedPath = objectPath.split("/").map(awsUriEncode).join("/");
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${awsUriEncode(R2_BUCKET)}/${encodedPath}`;
}

function r2PublicUrl(objectPath) {
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${objectPath.split("/").map(awsUriEncode).join("/")}`;
}

function r2SignedHeaders({ method, objectPath, content, contentType = "" }) {
  const url = new URL(r2ObjectUrl(objectPath));
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(content || "");
  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };
  if (contentType) headers["content-type"] = contentType;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((key) => `${key}:${headers[key]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");

  return {
    url,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  };
}

async function r2Request({ method, objectPath, content, contentType }) {
  if (!HAS_R2) {
    throw new Error("Cloudflare R2 nije konfigurisan. Nedostaju R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET ili R2_PUBLIC_URL.");
  }

  const signed = r2SignedHeaders({
    method,
    objectPath,
    content: content || "",
    contentType
  });
  const response = await fetch(signed.url, {
    method,
    headers: signed.headers,
    body: content || undefined
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 zahtjev nije uspio: ${response.status} ${detail}`);
  }

  return response;
}

async function uploadToR2(objectPath, content, contentType) {
  await r2Request({
    method: "PUT",
    objectPath,
    content,
    contentType
  });
  return r2PublicUrl(objectPath);
}

async function deleteR2Asset(objectPath) {
  if (!HAS_R2 || !objectPath) return;
  try {
    await r2Request({
      method: "DELETE",
      objectPath,
      content: ""
    });
  } catch (error) {
    console.error(`Cloudflare R2 brisanje nije uspjelo za ${objectPath}: ${error.message}`);
  }
}

async function uploadToCloudinary({ publicId, content, contentType }) {
  if (!HAS_CLOUDINARY) {
    throw new Error("Cloudinary nije konfigurisan. Nedostaju CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ili CLOUDINARY_API_SECRET.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    folder: CLOUDINARY_FOLDER,
    overwrite: "false",
    public_id: publicId,
    timestamp
  };
  const formData = new FormData();
  formData.append("file", new Blob([content], { type: contentType }), publicId);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("folder", params.folder);
  formData.append("overwrite", params.overwrite);
  formData.append("public_id", params.public_id);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", cloudinarySignature(params));

  const resourceType = contentType.startsWith("video/") ? "video" : "image";
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text || "{}");
  } catch {
    payload = { error: { message: text } };
  }
  if (!response.ok) {
    const detail = payload?.error?.message || JSON.stringify(payload);
    throw new Error(`Cloudinary upload nije uspio: ${response.status} ${detail}`);
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    format: payload.format,
    bytes: payload.bytes
  };
}

async function deleteCloudinaryAsset(publicId) {
  if (!HAS_CLOUDINARY || !publicId) return;
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    public_id: publicId,
    timestamp
  };
  const formData = new FormData();
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("public_id", publicId);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", cloudinarySignature(params));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/destroy`,
    {
      method: "POST",
      body: formData
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Cloudinary brisanje nije uspjelo za ${publicId}: ${response.status} ${detail}`);
  }
}

async function saveUploadAsset({ id, kind, content, contentType, originalName }) {
  const extension = getExtensionFromMime(contentType, originalName);
  const filename = `${Date.now()}-${id}-${kind}${extension}`;

  if (STORAGE_MODE === "drive") {
    const objectPath = `${kind}/${filename}`;
    try {
      const uploaded = await uploadToGoogleDrive(objectPath, content, contentType);
      return {
        url: uploaded.url,
        objectPath: uploaded.fileId,
        filename,
        storage: "drive"
      };
    } catch (error) {
      if (!HAS_SUPABASE) throw error;
      console.error(`Google Drive upload nije uspio, koristim Supabase fallback: ${error.message}`);
      return {
        url: await uploadToSupabase(objectPath, content, contentType),
        objectPath,
        filename,
        storage: "supabase"
      };
    }
  }

  if (STORAGE_MODE === "r2") {
    const objectPath = `${kind}/${filename}`;
    return {
      url: await uploadToR2(objectPath, content, contentType),
      objectPath,
      filename,
      storage: "r2"
    };
  }

  if (STORAGE_MODE === "cloudinary") {
    const publicId = `${kind}/${Date.now()}-${id}-${kind}`;
    const uploaded = await uploadToCloudinary({
      publicId,
      content,
      contentType
    });
    return {
      url: uploaded.url,
      objectPath: uploaded.publicId,
      filename: `${path.basename(uploaded.publicId)}.${uploaded.format || extension.replace(".", "")}`,
      storage: "cloudinary"
    };
  }

  if (STORAGE_MODE === "supabase") {
    if (!HAS_SUPABASE) {
      throw new Error("Supabase nije konfigurisan. Nedostaju SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.");
    }
    const objectPath = `${kind}/${filename}`;
    return {
      url: await uploadToSupabase(objectPath, content, contentType),
      objectPath,
      filename,
      storage: "supabase"
    };
  }

  const directory = kind === "original" ? ORIGINAL_UPLOAD_DIR : OPTIMIZED_UPLOAD_DIR;
  const savedPath = path.join(directory, filename);
  fs.writeFileSync(savedPath, content);

  return {
    url: `/uploads/${kind === "original" ? "originals" : "optimized"}/${filename}`,
    objectPath: "",
    filename,
    storage: "local"
  };
}

async function readAssetContent(fileUrl) {
  if (!fileUrl) return null;
  const localPath = getLocalUploadPath(fileUrl);
  if (localPath && fs.existsSync(localPath)) return fs.readFileSync(localPath);
  if (/^https?:\/\//i.test(fileUrl)) {
    const response = await fetch(fileUrl);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = dosDateTime(new Date());

  files.forEach((file) => {
    const nameBuffer = Buffer.from(file.name.replace(/\\/g, "/"));
    const checksum = crc32(file.content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(file.content.length, 18);
    localHeader.writeUInt32LE(file.content.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, file.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(file.content.length, 20);
    centralHeader.writeUInt32LE(file.content.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + file.content.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

async function createPhotosZip(type = "all") {
  const photos = await readPhotos();
  const files = [];

  for (const [index, photo] of photos.entries()) {
    const safeGuest = (photo.guest || "gost").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40);
    const assets = [];
    if (type === "all" || type === "originals") {
      const originalUrl = photo.originalUrl || photo.url;
      const optimizedUrl = photo.optimizedUrl || photo.url;
      if (type === "originals" || originalUrl !== optimizedUrl) {
        assets.push({ folder: "originals", url: originalUrl });
      }
    }
    if (type === "all" || type === "optimized") {
      assets.push({ folder: "optimized", url: photo.optimizedUrl || photo.url });
    }

    for (const asset of assets) {
      const content = await readAssetContent(asset.url);
      if (!content) continue;
      const extension = path.extname(getUrlPathname(asset.url)) || ".jpg";
      files.push({
        name: `${asset.folder}/${String(index + 1).padStart(3, "0")}-${safeGuest}${extension}`,
        content
      });
    }
  }

  files.push({
    name: "metadata.json",
    content: Buffer.from(JSON.stringify(photos, null, 2))
  });

  return createZip(files);
}

async function writeBackupZip() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `nurdin-adna-backup-${timestamp}.zip`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  const zip = await createPhotosZip("all");
  fs.writeFileSync(backupPath, zip);
  fs.writeFileSync(path.join(BACKUP_DIR, "latest.txt"), backupPath);

  if (BACKUP_SYNC_DIR) {
    fs.mkdirSync(BACKUP_SYNC_DIR, { recursive: true });
    const syncedBackupPath = path.join(BACKUP_SYNC_DIR, backupName);
    fs.copyFileSync(backupPath, syncedBackupPath);
    fs.writeFileSync(path.join(BACKUP_SYNC_DIR, "latest.txt"), syncedBackupPath);
  }

  return backupPath;
}

function latestBackupPath() {
  const latestFile = path.join(BACKUP_DIR, "latest.txt");
  if (fs.existsSync(latestFile)) {
    const storedPath = fs.readFileSync(latestFile, "utf8").trim();
    if (storedPath && fs.existsSync(storedPath)) return storedPath;
  }
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith(".zip"))
    .sort()
    .reverse();
  return backups.length ? path.join(BACKUP_DIR, backups[0]) : "";
}

function latestBackupInfo() {
  const backupPath = latestBackupPath();
  if (!backupPath) {
    return {
      exists: false,
      name: "",
      createdAt: "",
      sizeMb: 0
    };
  }
  const stats = fs.statSync(backupPath);
  return {
    exists: true,
    name: path.basename(backupPath),
    createdAt: stats.mtime.toISOString(),
    sizeMb: Math.round((stats.size / 1024 / 1024) * 10) / 10
  };
}

function uploadStatusForDevice(photos, deviceId) {
  const uploaded = photos.filter((photo) => photo.uploaderDeviceId === deviceId).length;
  const remaining = Math.max(0, MAX_UPLOADS_PER_DEVICE - uploaded);
  return {
    uploaded,
    remaining,
    maxUploadsPerDevice: MAX_UPLOADS_PER_DEVICE
  };
}

function adminStatusFromPhotos(photos) {
  const devices = new Set(photos.map((photo) => photo.uploaderDeviceId).filter(Boolean));
  const guests = new Set(
    photos
      .map((photo) => String(photo.guest || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return {
    totalPhotos: photos.length,
    totalLikes: photos.reduce((total, photo) => total + Number(photo.likes || 0), 0),
    messages: photos.filter((photo) => photo.message).length,
    devices: devices.size,
    guests: guests.size,
    storageMode: STORAGE_MODE,
    cloudReady: CLOUD_STORAGE_READY,
    backupSyncReady: Boolean(BACKUP_SYNC_DIR),
    backupOnChange: BACKUP_ON_CHANGE,
    backupIntervalHours: BACKUP_INTERVAL_HOURS,
    maxUploadsPerDevice: MAX_UPLOADS_PER_DEVICE,
    latestBackup: latestBackupInfo()
  };
}

let pendingChangeBackup = null;

function scheduleBackupAfterChange() {
  if (!BACKUP_ON_CHANGE) return;
  clearTimeout(pendingChangeBackup);
  pendingChangeBackup = setTimeout(() => {
    pendingChangeBackup = null;
    writeBackupZip().catch((error) => console.error(`Backup nakon promjene nije uspio: ${error.message}`));
  }, BACKUP_CHANGE_DELAY_SECONDS * 1000);
}

function scheduleAutomaticBackups() {
  setTimeout(() => {
    writeBackupZip().catch((error) => console.error(`Backup nije uspio: ${error.message}`));
  }, 60 * 1000);
  setInterval(() => {
    writeBackupZip().catch((error) => console.error(`Backup nije uspio: ${error.message}`));
  }, BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
}

async function deletePhoto(id) {
  const photos = await readPhotos();
  const photo = photos.find((entry) => entry.id === id);
  if (!photo) return false;

  [photo.url, photo.optimizedUrl, photo.originalUrl].forEach((fileUrl) => {
    const filePath = getLocalUploadPath(fileUrl);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
  if (photo.storage === "cloudinary") {
    await Promise.all([
      deleteCloudinaryAsset(photo.optimizedObjectPath),
      deleteCloudinaryAsset(photo.originalObjectPath)
    ]);
  }
  if (photo.storage === "r2") {
    await Promise.all([
      deleteR2Asset(photo.optimizedObjectPath),
      deleteR2Asset(photo.originalObjectPath)
    ]);
  }
  if (photo.storage === "drive") {
    await Promise.all([
      deleteGoogleDriveAsset(photo.optimizedObjectPath),
      deleteGoogleDriveAsset(photo.originalObjectPath)
    ]);
  }

  await removePhotoRow(id);
  return true;
}

async function likePhoto(id) {
  const photos = await readPhotos();
  const photo = photos.find((entry) => entry.id === id);
  if (!photo) return null;
  photo.likes = Number(photo.likes || 0) + 1;
  return replacePhoto(photo);
}

async function findDuplicatePhoto(hash) {
  if (!hash) return null;
  return (await readPhotos()).find((photo) => photo.originalHash === hash || photo.optimizedHash === hash) || null;
}

async function handleUpload(req, res) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);

  if (!boundaryMatch) {
    sendError(res, 400, "Upload nije ispravan.");
    return;
  }

  let body;
  try {
    body = await collectRequestBody(req);
  } catch (error) {
    sendError(res, 413, error.message);
    return;
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const parts = parseMultipart(body, boundary);
  const optimizedPart = findPart(parts, "photo");
  const originalPart = findPart(parts, "originalPhoto");
  const photoPart = optimizedPart || originalPart;

  if (!photoPart || photoPart.content.length === 0) {
    sendError(res, 400, "Izaberi sliku ili video za upload.");
    return;
  }

  const optimizedType = (photoPart.headers["content-type"] || "").toLowerCase();
  const originalType = ((originalPart || photoPart).headers["content-type"] || "").toLowerCase();
  if (!ALLOWED_MEDIA_TYPES.has(optimizedType) || !ALLOWED_MEDIA_TYPES.has(originalType)) {
    sendError(res, 415, "Dozvoljene su JPG, PNG, WEBP, GIF, MP4, WEBM i MOV datoteke.");
    return;
  }

  const id = crypto.randomUUID();
  const originalName =
    getDispositionValue((originalPart || photoPart).headers["content-disposition"], "filename") || "svadba";
  const clientHash = getTextPart(parts, "originalHash", 128);
  const originalHash =
    clientHash || crypto.createHash("sha256").update((originalPart || photoPart).content).digest("hex");
  const optimizedHash = crypto.createHash("sha256").update(photoPart.content).digest("hex");
  const duplicate = await findDuplicatePhoto(originalHash);
  if (duplicate) {
    sendJson(res, 409, {
      error: "Ova slika je vec uploadovana.",
      duplicateId: duplicate.id
    });
    return;
  }

  const uploaderDeviceId = getUploadDeviceId(req);
  const deviceUploadCount = (await readPhotos()).filter((photo) => photo.uploaderDeviceId === uploaderDeviceId).length;
  if (deviceUploadCount >= MAX_UPLOADS_PER_DEVICE) {
    sendJson(
      res,
      429,
      { error: `Dosegli ste limit od ${MAX_UPLOADS_PER_DEVICE} slika sa ovog uredjaja.` },
      { "Set-Cookie": uploadDeviceCookie(uploaderDeviceId) }
    );
    return;
  }

  let optimizedAsset;
  let originalAsset;
  try {
    optimizedAsset = await saveUploadAsset({
      id,
      kind: "optimized",
      content: photoPart.content,
      contentType: optimizedType,
      originalName
    });
    originalAsset = STORE_ORIGINAL_UPLOADS
      ? await saveUploadAsset({
          id,
          kind: "original",
          content: (originalPart || photoPart).content,
          contentType: originalType,
          originalName
        })
      : optimizedAsset;
  } catch (error) {
    sendError(res, 500, error.message);
    return;
  }

  const photo = {
    id,
    url: optimizedAsset.url,
    optimizedUrl: optimizedAsset.url,
    originalUrl: originalAsset.url,
    optimizedFilename: optimizedAsset.filename,
    originalFilename: originalAsset.filename,
    optimizedObjectPath: optimizedAsset.objectPath,
    originalObjectPath: originalAsset.objectPath,
    originalName,
    originalHash,
    optimizedHash,
    mediaType: optimizedType,
    caption: getTextPart(parts, "caption", 120),
    guest: getTextPart(parts, "guest", 60),
    message: getTextPart(parts, "message", 240),
    uploaderDeviceId,
    likes: 0,
    hidden: false,
    storage: optimizedAsset.storage,
    uploadedAt: new Date().toISOString()
  };

  await insertPhoto(photo);
  sendJson(res, 201, publicPhoto(photo), { "Set-Cookie": uploadDeviceCookie(uploaderDeviceId) });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    if (!ADMIN_PASSWORD) {
      sendJson(res, 503, { error: "Admin lozinka nije podesena na serveru." });
      return;
    }

    const body = await collectRequestBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body.toString("utf8") || "{}");
    } catch {
      payload = {};
    }

    if (payload.password === ADMIN_PASSWORD) {
      const token = adminToken();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `wedding_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`
      });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    sendJson(res, 401, { error: "Pogresna admin lozinka." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "wedding_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      storageMode: STORAGE_MODE,
      cloudReady: CLOUD_STORAGE_READY,
      backupSyncReady: Boolean(BACKUP_SYNC_DIR)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/photos") {
    sendJson(res, 200, (await readPhotos()).map(publicPhoto));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/upload-status") {
    const uploaderDeviceId = getUploadDeviceId(req);
    const photos = await readPhotos();
    sendJson(res, 200, uploadStatusForDevice(photos, uploaderDeviceId), {
      "Set-Cookie": uploadDeviceCookie(uploaderDeviceId)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/status") {
    if (!isAdminAuthenticated(req)) {
      sendUnauthorized(res);
      return;
    }
    sendJson(res, 200, adminStatusFromPhotos(await readPhotos()));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      storageMode: STORAGE_MODE,
      cloudReady: CLOUD_STORAGE_READY,
      cloudPublicUrl: CLOUD_PUBLIC_URL,
      publicAppUrl: PUBLIC_APP_URL,
      supabaseReady: HAS_SUPABASE,
      cloudinaryReady: HAS_CLOUDINARY,
      r2Ready: HAS_R2,
      backupSyncReady: Boolean(BACKUP_SYNC_DIR),
      backupIntervalHours: BACKUP_INTERVAL_HOURS,
      backupOnChange: BACKUP_ON_CHANGE,
      storeOriginalUploads: STORE_ORIGINAL_UPLOADS,
      maxUploadsPerDevice: MAX_UPLOADS_PER_DEVICE,
      maxUploadMb: Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/photos/download") {
    if (!isAdminAuthenticated(req)) {
      sendUnauthorized(res);
      return;
    }
    const type = url.searchParams.get("type") || "all";
    const zip = await createPhotosZip(type);
    sendBuffer(res, 200, zip, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="nurdin-adna-${type}.zip"`
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/backups/run") {
    if (!isAdminAuthenticated(req)) {
      sendUnauthorized(res);
      return;
    }
    const backupPath = await writeBackupZip();
    sendJson(res, 200, { ok: true, path: backupPath });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/backups/latest") {
    if (!isAdminAuthenticated(req)) {
      sendUnauthorized(res);
      return;
    }
    let backupPath = latestBackupPath();
    if (!backupPath) backupPath = await writeBackupZip();
    const content = fs.readFileSync(backupPath);
    sendBuffer(res, 200, content, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${path.basename(backupPath)}"`
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/photos") {
    await handleUpload(req, res);
    return;
  }

  const likeMatch = url.pathname.match(/^\/api\/photos\/([^/]+)\/like$/);
  if (req.method === "POST" && likeMatch) {
    const photo = await likePhoto(decodeURIComponent(likeMatch[1]));
    if (!photo) {
      sendError(res, 404, "Slika nije pronadjena.");
      return;
    }
    sendJson(res, 200, publicPhoto(photo));
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    if (!isAdminAuthenticated(req)) {
      sendUnauthorized(res);
      return;
    }
    if (!(await deletePhoto(decodeURIComponent(deleteMatch[1])))) {
      sendError(res, 404, "Slika nije pronadjena.");
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/uploads/")) {
    const filePath = safePublicPath(UPLOAD_DIR, url.pathname.replace("/uploads/", ""));
    if (!filePath) {
      sendError(res, 400, "Neispravna putanja.");
      return;
    }
    serveFile(res, filePath);
    return;
  }

  const mediaMatch = url.pathname.match(/^\/api\/media\/([a-zA-Z0-9_-]+)$/);
  if (req.method === "GET" && mediaMatch) {
    const fileId = mediaMatch[1];
    const range = req.headers.range;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        headers: {
          authorization: `Bearer ${await googleDriveAccessToken()}`,
          ...(range ? { range } : {})
        }
      }
    );
    if (!response.ok) {
      sendError(res, 404, "Medijski fajl nije pronadjen.");
      return;
    }
    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      sendError(res, 502, "Google Drive nije vratio podrzan medijski fajl.");
      return;
    }
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Range"
    };
    for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) headers[name.replace(/(^|-)([a-z])/g, (_, dash, letter) => dash + letter.toUpperCase())] = value;
    }
    res.writeHead(response.status, headers);
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
    return;
  }

  if (req.method === "GET") {
    const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
    if (requestPath === "/admin.html" && !isAdminAuthenticated(req)) {
      serveFile(res, path.join(PUBLIC_DIR, "admin-login.html"));
      return;
    }
    const filePath = safePublicPath(PUBLIC_DIR, requestPath);
    if (!filePath) {
      sendError(res, 400, "Neispravna putanja.");
      return;
    }
    serveFile(res, filePath);
    return;
  }

  sendError(res, 405, "Metoda nije podrzana.");
}

scheduleAutomaticBackups();

http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendError(res, 500, "Server greska.");
  });
}).listen(PORT, () => {
  console.log(`Nurdin i Adna galerija radi na http://localhost:${PORT}`);
});
