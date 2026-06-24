# Panduan Deploy ke Hostinger Business Plan

Domain:
- **Frontend:** `https://generator.stubia.id`
- **Backend API:** `https://gen.stubia.id`

---

## Arsitektur

```
generator.stubia.id ─── public_html/ ─── frontend (Vite static files)
                                │
                                │ (fetch langsung via API_BASE)
                                │
gen.stubia.id ─── Node.js app (Setup Node.js hPanel) ─── Express API
                                │
                        Neon PostgreSQL (external)
```

Frontend memanggil backend langsung ke `https://gen.stubia.id/api/*` (bukan via proxy `.htaccess`). Ini lebih stabil karena tidak bergantung pada `mod_proxy` Apache.

---

## 1. Build Frontend (dengan API_BASE)

```bash
cd frontend
npm install

# Build dengan VITE_API_BASE menunjuk ke backend
$env:VITE_API_BASE="https://gen.stubia.id"
npm run build

# Atau via cmd:
# set VITE_API_BASE=https://gen.stubia.id && npm run build
```

Hasil: `frontend/dist/` — upload isi folder ini ke `public_html/`.

> **Catatan:** VITE_API_BASE membuat semua fetch `/api/...` otomatis jadi `https://gen.stubia.id/api/...`. CORS sudah diatur oleh Express (`cors()` middleware allow all origins).

---

## 2. Build Backend

```bash
cd backend
npm install
npx prisma generate
npx tsc
```

Hasil: `backend/dist/`.

---

## 3. Upload ke Hostinger via hPanel / FTP

### 3a. Frontend → `generator.stubia.id`

1. Login hPanel → **File Manager**
2. Masuk ke `public_html/`
3. Upload seluruh isi `frontend/dist/` ke `public_html/`
4. Hapus file default Hostinger (index.php dll)
5. File `.htaccess` sudah ada di dalam build (dari `frontend/public/.htaccess`)

### 3b. Backend → `gen.stubia.id`

1. Di hPanel → **Setup Node.js** → **Add Application**
2. Isi:
   - **Application path:** `backend-app/dist/index.js`
   - **Application URL:** `gen.stubia.id`
   - **Node.js version:** 20.x atau 22.x
3. Hostinger otomatis buat folder untuk subdomain
4. Upload file backend ke folder tersebut:
   ```
   backend-app/
   ├── dist/              # hasil tsc
   ├── package.json
   ├── package-lock.json
   ├── .env               # (buat baru, isi production)
   └── prisma/
       └── schema.prisma
   ```

### 3c. .env Production

Buat `.env` di `backend-app/`:

```env
PORT=4000
DATABASE_URL="postgresql://..."   # dari Neon production
GEMINI_API_KEY="..."
GROQ_API_KEY="..."
AI_GENERATOR_PROVIDER=gemini
AI_REVIEWER_PROVIDER=groq
AI_REVIEW_CONFIDENCE_THRESHOLD=0.8
DUPLICATE_SIMILARITY_THRESHOLD=0.6
```

---

## 4. Setup Database

Via SSH atau Console di hPanel:

```bash
cd backend-app
npm install
npx prisma generate
npx prisma migrate deploy
```

---

## 5. Domain & SSL

- Arahkan NS domain ke Hostinger
- Di hPanel → **SSL** → aktifkan Auto SSL untuk kedua subdomain
- Pastikan HTTPS aktif di `generator.stubia.id` dan `gen.stubia.id`

---

## 6. Verifikasi

- Buka `https://generator.stubia.id` → halaman login muncul
- Login → tes generate soal
- Cek tab Network di DevTools: fetch harus ke `https://gen.stubia.id/api/...`

---

## Troubleshooting

### ❌ CORS error
Backend sudah pakai `cors()` (allow all origins). Jika tetap error:
- Pastikan `VITE_API_BASE` sudah di-set saat build
- Cek apakah `gen.stubia.id` sudah SSL (HTTPS)

### ❌ 503 dari Gemini
Ganti sementara `AI_GENERATOR_PROVIDER=groq` di `.env`

### ❌ Prisma error
- `npx prisma generate` sudah jalan?
- IP Hostinger diizinkan di Neon? (Neon → Settings → IP Allow)

### ❌ Background job gagal
Shared hosting sering me-restart proses Node secara periodik. Solusi:
- Gunakan cron job untuk trigger `/api/generate` secara berkala
- Atau upgrade ke VPS (rekomendasi)

---

## Catatan Penting

| Item | Keterangan |
|------|-----------|
| **VITE_API_BASE** | Diisi `https://gen.stubia.id` saat build frontend |
| **CORS** | Backend allow all origins (cors middleware) |
| **.env** | Jangan commit, buat manual di server |
| **SSL** | Wajib aktif di kedua subdomain |
| **.htaccess frontend** | Hanya handle SPA routing + security |
| **.htaccess backend** | Opsional, untuk security headers saja |
