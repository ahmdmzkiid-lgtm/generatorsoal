# Panduan Deploy ke Hostinger Business Plan

## Persyaratan

- Hostinger Business Plan (shared hosting) — atau VPS/Cloud untuk hasil lebih optimal
- Domain sudah terhubung ke Hostinger
- Akun [Neon](https://neon.tech) (PostgreSQL serverless) — sudah terpakai
- API key Gemini & Groq — sudah ada di `.env`

---

## Arsitektur Deploy

```
Domain (misal: generatorsoal.com)
├── Frontend → static files (Vite build) → public_html/
└── Backend  → Node.js app via Setup Node.js → port (disediakan Hostinger)
     └── Database → Neon PostgreSQL (external)
```

---

## 1. Persiapan Repo & Push ke GitHub

```bash
# Init git dan push ke GitHub (private repo)
cd C:\generatorsoal
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main
```

> **PENTING:** File `.env` sudah di-*gitignore*. Jangan commit `.env`.

---

## 2. Build Frontend

```bash
cd frontend
npm install
npm run build
```

Hasil build ada di `frontend/dist/`. Ini akan di-upload ke `public_html/`.

---

## 3. Build Backend

```bash
cd backend
npm install
npx prisma generate
npx tsc
```

Hasil build ada di `backend/dist/`.

---

## 4. Upload ke Hostinger via hPanel (File Manager) atau FTP

### 4a. Upload Frontend

1. Login ke hPanel Hostinger
2. Buka **File Manager** → `public_html/`
3. Upload isi folder `frontend/dist/` ke `public_html/`
4. Hapus file default (`index.html` bawaan Hostinger jika ada)

### 4b. Upload Backend

1. Buat folder di luar `public_html/`, misal: `backend-app/`
2. Upload isi folder `backend/` (kecuali `node_modules/`, `src/`) ke `backend-app/`
3. Struktur `backend-app/` yang diupload:
   ```
   backend-app/
   ├── dist/          # hasil tsc
   ├── package.json
   ├── package-lock.json
   ├── .env           # buat file baru, isi dengan env production
   └── prisma/
       └── schema.prisma
   ```

### 4c. Setup .env Production di Hostinger

Buat file `.env` di `backend-app/` dengan isi:

```env
PORT=4000
DATABASE_URL="postgresql://..."  # pakai dari Neon production
GEMINI_API_KEY="..."
GROQ_API_KEY="..."
AI_GENERATOR_PROVIDER=gemini
AI_REVIEWER_PROVIDER=groq
AI_REVIEW_CONFIDENCE_THRESHOLD=0.8
DUPLICATE_SIMILARITY_THRESHOLD=0.6
```

---

## 5. Setup Node.js di Hostinger (via hPanel)

1. Di hPanel, cari **Setup Node.js** (atau **Node.js Selector**)
2. Klik **Install** atau **Add Application**
3. Isi:
   - **Application path:** `backend-app/dist/index.js`
   - **Application URL:** pilih subdomain atau domain (misal: `api.generatorsoal.com`)
   - **Node.js version:** pilih 20.x atau 22.x
   - **Entry point:** `index.js`
4. Setelah dibuat, Hostinger akan memberikan **port** dan **URL** untuk API
5. Catat port yang diberikan (misal: `12345`)

> **Catatan:** Di Business Plan shared hosting, Node.js berjalan sebagai *process* dengan port random. Hostinger akan memberikan URL seperti `https://api.generatorsoal.com` yang sudah *reverse proxy* ke port tersebut.

---

## 6. Setup Database Migration

Setelah Node.js app terdaftar, akses terminal via **SSH** atau **Console** di hPanel:

```bash
cd backend-app
npm install
npx prisma generate
npx prisma migrate deploy
```

Atau jalankan via `package.json` scripts → **NPM Scripts** di hPanel (jika ada fitur).

---

## 7. Redirect Frontend ke Backend API

Frontend di `public_html/` perlu tahu endpoint API backend.

**Cara 1 — Edit Vite build output langsung:**
Cari di file JS hasil build (`frontend/dist/assets/*.js`) string `"/api/generate"` dan sejenisnya. Ganti base URL jika backend di subdomain berbeda.

**Cara 2 — Pakai reverse proxy di hPanel:**
Di hPanel → **Redirects** → buat rule:
- From: `generatorsoal.com/api/*`
- To: `http://localhost:<PORT_BACKEND>/*`
- Type: **Proxy** (bukan 302)

Atau buat file `.htaccess` di `public_html/`:

```apache
RewriteEngine On
RewriteRule ^api/(.*) http://localhost:<PORT_BACKEND>/$1 [P,L]
```

---

## 8. Domain & SSL

- Arahkan domain ke nameserver Hostinger
- Di hPanel → **SSL** → aktifkan Auto SSL / Let's Encrypt
- Pastikan SSL aktif untuk domain utama dan subdomain API

---

## 9. Testing

- Buka `https://generatorsoal.com` → harusnya muncul halaman login
- Tes login
- Tes generate soal
- Cek job status

---

## 10. Masalah yang Sering Muncul

### ❌ 502/503 terus
- Cek apakah backend Node.js sudah jalan di **Setup Node.js**
- Cek log error di hPanel → **Setup Node.js** → **Logs**
- Pastikan port di `.htaccess` cocok dengan port dari Setup Node.js

### ❌ Background job gagal
- Di shared hosting, background job (`processGenerationJob`) bisa mati karena proses Node.js di-restart secara periodik
- **Solusi:** ganti mekanisme jadi polling-based atau pakai cron job yang memicu endpoint tertentu

### ❌ Prisma error
- Pastikan `npx prisma generate` sudah jalan
- Pastikan `DATABASE_URL` benar dan IP Hostinger diizinkan di Neon

---

## Opsi yang Lebih Stabil: Hostinger VPS / Cloud

Business Plan shared hosting **terbatas** untuk Node.js dengan background job.

> **Rekomendasi:** Jika memungkinkan, upgrade ke **Hostinger VPS** (mulai ~$10/bulan) atau **Cloud Startup**.
> Di VPS kamu punya full akses root, PM2 untuk process management, dan background job jalan stabil.

### Quick setup di VPS:

```bash
# Install Node.js 22, git, nginx
ssh root@ip-vps-anda

# Clone repo
git clone https://github.com/<username>/<repo>.git /var/www/app
cd /var/www/app/backend
cp .env.example .env
nano .env  # isi konfigurasi

# Install dependencies & build
npm install
npx prisma generate
npx prisma migrate deploy
npx tsc

# Jalankan dengan PM2
npm install -g pm2
pm2 start dist/index.js --name "soal-backend"
pm2 save
pm2 startup

# Build & deploy frontend
cd /var/www/app/frontend
npm install
npm run build
# Arahkan nginx ke frontend/dist/
```

---

## Referensi

- [Hostinger Node.js Setup Docs](https://support.hostinger.com/en/articles/8162982-how-to-set-up-a-node-js-application)
- [Neon PostgreSQL](https://neon.tech)
- [PM2 Process Manager](https://pm2.keymetrics.io/)
