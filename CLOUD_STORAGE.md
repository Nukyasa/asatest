# Cloud storage priprema

Aplikacija trenutno cuva slike lokalno u `uploads/`, a podatke u `data/photos.json`.

Backend podrzava Supabase Storage preko environment varijabli:

```powershell
$env:STORAGE_MODE="supabase"
$env:SUPABASE_URL="https://PROJECT_ID.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="tvoj-service-role-key"
$env:SUPABASE_BUCKET="wedding-photos"
node server.js
```

Bucket treba biti public ako zelis da se slike direktno prikazuju u galeriji. Aplikacija sprema:

- `optimized/` - manja verzija za brzu galeriju
- `original/` - originalna slika za arhivu/download

Ako zelis koristiti custom javni URL za bucket ili CDN, dodaj:

```powershell
$env:CLOUD_PUBLIC_URL="https://tvoj-cdn-domain/slike"
```

Bez Supabase varijabli aplikacija nastavlja raditi lokalno u `uploads/`.

Opcije za cloud:

- Firebase Storage
- Supabase Storage
- AWS S3 / Cloudflare R2

Supabase je trenutno najjednostavniji put za free test hosting.

## Render env varijable

Za pravi javni host na Renderu postavi ove Environment Variables:

```text
STORAGE_MODE=supabase
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET=wedding-photos
SUPABASE_PHOTOS_TABLE=wedding_photos
ADMIN_PASSWORD=izaberi-jaku-lozinku
ADMIN_SESSION_SECRET=dug-random-string
PUBLIC_APP_URL=https://tvoj-render-link.onrender.com
```

`PUBLIC_APP_URL` se koristi za QR poster i konfiguraciju javnog linka.

## Supabase baza

U Supabase SQL editoru pokreni fajl:

```text
supabase-schema.sql
```

Tabela `wedding_photos` cuva metapodatke galerije kao JSON, a slike idu u Supabase Storage bucket.
