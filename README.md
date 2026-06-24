# Generator Soal & Bank Soal

Aplikasi generate soal berbasis AI dengan bank soal terintegrasi.

## Tech Stack

- **Frontend:** React 19 + Vite + TailwindCSS + React Router
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Database:** PostgreSQL (Neon — serverless)

---

## Cara Setup

### 1. Buat Project Neon Gratis

1. Buka https://neon.tech dan sign up (gratis, no credit card).
2. Buat project baru — pilih region terdekat.
3. Setelah jadi, klik **Connect** → pilih **Prisma** atau **Connection String**.
4. Copy connection string, format-nya seperti ini:

```
postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
```

> ⚠️ Pastikan ada `?sslmode=require` di akhir — Neon mewajibkan SSL.

### 2. Setup Backend

```bash
cd backend

# Copy environment variables
cp .env.example .env

# Edit .env — paste connection string Neon ke DATABASE_URL
# Contoh:
# DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Jalankan migration + seed data dummy
npm run db:migrate

# Alternatif: migrasi dulu, lalu seed manual
npm run db:migrate
npm run db:seed

# Reset database (hapus semua data + migration, mulai dari awal)
npm run db:reset

# Jalankan dev server (default: http://localhost:4000)
npm run dev
```

> `npm run db:migrate` otomatis menjalankan seed via konfigurasi `prisma.seed` di `package.json`.

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Jalankan dev server (default: http://localhost:5173)
npm run dev
```

Frontend sudah di-setup dengan proxy ke backend (`/api` → `http://localhost:4000`).

---

## Struktur Folder

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Semua model & enum
│   │   ├── seed.ts           # Seed data dummy
│   │   └── migrations/       # SQL migrations
│   ├── src/
│   │   ├── routes/           # Express route handlers
│   │   ├── services/         # Business logic
│   │   ├── jobs/             # Background job processors
│   │   ├── ai/               # AI provider abstraction
│   │   └── db/               # Database client (Prisma)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Halaman aplikasi
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── README.md
```

## Database Schema

| Table                | Deskripsi                                  |
|----------------------|--------------------------------------------|
| `skills`             | Kisi-kisi / skill generate soal            |
| `questions`          | Soal dengan content JSON, status, tags     |
| `generation_jobs`    | Tracking progress generate async           |
| `ai_review_logs`     | Log hasil review AI                        |
| `duplicate_scan_logs`| Log hasil scan duplikat (pg_trgm)          |
| `human_review_logs`  | Log review manual oleh editor              |
| `export_templates`   | Template export kolom                      |
| `export_logs`        | Riwayat export soal                        |
| `users`              | Pengguna sistem                            |

### Duplicate Detection

Duplikasi soal dideteksi dengan `pg_trgm` extension + GIN index pada kolom `question_text`:
```sql
CREATE INDEX ON "questions" USING GIN ("question_text" gin_trgm_ops);
```
Scan dilakukan dengan query `similarity()` atau `strict_word_similarity()` — tanpa embedding AI.

## Halaman Frontend

| Route       | Halaman            |
|-------------|--------------------|
| `/`         | Redirect ke Skills |
| `/skills`   | Kelola skill       |
| `/generate` | Generate soal AI   |
| `/review`   | Review hasil       |
| `/bank-soal`| Jelajahi bank soal |

## Scripts Backend

| Script               | Perintah                    |
|----------------------|-----------------------------|
| Dev server           | `npm run dev`               |
| Build                | `npm run build`             |
| Generate Prisma      | `npm run db:generate`       |
| Migration (dev)      | `npm run db:migrate`        |
| Migration (prod)     | `npm run db:migrate:prod`   |
| Seed data            | `npm run db:seed`           |
| Prisma Studio        | `npm run db:studio`         |
| Reset DB             | `npm run db:reset`          |
