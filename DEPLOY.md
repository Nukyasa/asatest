# Deploy: Nurdin & Adna galerija

Najjednostavniji hosting za ovu aplikaciju je:

- Render za Node server
- Supabase za bazu i slike
- OneDrive lokalno ostaje dodatni backup na tvom racunaru

## 1. Supabase

1. Napravi Supabase projekat.
2. U SQL editoru pokreni `supabase-schema.sql`.
3. Napravi public Storage bucket: `wedding-photos`.
4. Kopiraj:
   - Project URL
   - service_role key

## 2. GitHub

Napravi GitHub repo za projekat, npr. `nurdin-adna-svadba`, i pushaj kod.

Ne pushati:

- `.env`
- `uploads/`
- `backups/`
- `data/photos.json`

`.gitignore` je vec podesen za to.

## 3. Render

1. Render > New > Web Service.
2. Povezi GitHub repo.
3. Render ce procitati `render.yaml`.
4. U Environment Variables postavi:

```text
STORAGE_MODE=supabase
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tvoj-service-role-key
SUPABASE_BUCKET=wedding-photos
SUPABASE_PHOTOS_TABLE=wedding_photos
ADMIN_PASSWORD=izaberi-jaku-lozinku
PUBLIC_APP_URL=https://tvoj-render-link.onrender.com
```

`ADMIN_SESSION_SECRET` Render moze generisati automatski preko `render.yaml`.

## Optional: Google Drive za fotografije

Google Drive se može uključiti kao primarni storage bez promjene Render hostinga. Supabase ostaje fallback ako Drive upload ne uspije.

1. Napravi Google Cloud service account i uključi Google Drive API.
2. Napravi folder u Google Driveu i podijeli ga sa service-account email adresom kao Editor.
3. JSON credentials pretvori u Base64 i postavi na Renderu:

```text
STORAGE_MODE=drive
GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64=tvoj-base64-json
GOOGLE_DRIVE_FOLDER_ID=id-foldera
GOOGLE_DRIVE_PUBLIC=true
```

Folder mora dozvoliti javno čitanje fotografija ako želiš da ih gosti vide u galeriji.

## 4. Provjera

Nakon deploya otvori:

```text
https://tvoj-render-link.onrender.com/api/health
```

Treba vratiti:

```json
{
  "ok": true,
  "storageMode": "supabase",
  "cloudReady": true
}
```

Zatim testiraj:

- upload slike na javnoj stranici
- admin login na `/admin.html`
- backup dugme u adminu
