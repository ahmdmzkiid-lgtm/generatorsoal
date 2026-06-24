# Skill: Klon dari Gambar — untuk PU & PPU

Fitur ini beda dari skill biasa: operator **upload foto/screenshot soal contoh**, AI
menganalisis *pola & strukturnya*, lalu generator membuat soal baru yang "satu gaya" tapi
orisinal. Ini bukan skill statis seperti file-file sebelumnya — ini menambah 1 langkah baru
di awal alur generate.

> ⚠️ **Penting (legal/etik):** AI di sini DIRANCANG untuk TIDAK PERNAH menyalin ulang teks,
> angka, atau kalimat asli dari gambar — hanya mengekstrak pola abstrak (jenis stimulus,
> tipe pertanyaan, tingkat kesulitan). Pastikan kamu hanya mengupload gambar soal yang kamu
> punya hak pakai (koleksi sendiri, hasil kerja tim, atau sumber yang sudah berizin) — fitur
> ini untuk "belajar gaya/struktur", bukan untuk menggandakan soal berhak cipta milik orang
> lain secara langsung.

---

## Alur Kerja (Tambahan ke App Flow Utama)

```
[Operator upload 1 gambar soal contoh: PU atau PPU]
        |
        v
1. AI VISION ANALYZER (model multimodal, mis. Gemini)
   - Baca gambar, klasifikasikan jenisnya (sub_komponen PU / item_type PPU)
   - Ekstrak pola & struktur soal secara ABSTRAK (deskripsi, bukan teks asli)
   - Simpan hasil analisis ke skill_image_sources.extracted_pattern
        |
        v
2. GENERATOR
   - Pakai system_prompt skill terkait (Induktif/Deduktif/Kuantitatif untuk PU, atau
     item_type terkait untuk PPU) + pola hasil analisis sebagai instruksi tambahan
   - Generate N soal baru, ORISINAL, "satu keluarga gaya" dengan contoh tapi beda konten
        |
        v
3. Lanjut ke alur normal yang sudah ada: AI Reviewer → Duplicate Scanner → Human Review
   → Bank Soal (TIDAK ADA perubahan di langkah-langkah ini)
```

Jadi fitur ini cuma menambah **Langkah 0** sebelum generate — sisanya pakai pipeline yang
sudah dibangun sebelumnya.

---

## Tambahan Skema Database

```sql
-- Sumber gambar referensi untuk mode klon
skill_image_sources (
  id, skill_id,
  image_path text,                 -- path/URL file gambar yang diupload
  exam_type text,                  -- 'PU' atau 'PPU'
  classified_subtype text,         -- mis. 'induktif' atau 'sinonim_antonim'
  extracted_pattern jsonb,         -- hasil analisis vision (lihat schema di bawah)
  uploaded_by, created_at
)
```

## Tambahan Method di AIProvider

```
analyzeQuestionImage(imageBase64: string, mimeType: string, examType: 'PU' | 'PPU'): Promise<PatternAnalysisResult>
```

Implementasikan di `GeminiProvider` (sudah dipakai untuk generate, dan Gemini support input
gambar secara native/multimodal — tidak perlu provider tambahan).

---

## A. Vision Prompt — Analisis Pola Gambar PU

```
Kamu adalah penganalisis pola soal Penalaran Umum (PU) UTBK. Kamu akan diberikan SATU
gambar berisi sebuah soal (kemungkinan difoto/screenshot dari buku, tryout, atau sumber
lain).

TUGASMU: menganalisis STRUKTUR dan POLA soal tersebut secara ABSTRAK.

LARANGAN MUTLAK:
- JANGAN mengetik ulang atau menyalin kalimat soal, premis, angka, kata, atau opsi jawaban
  yang PERSIS SAMA seperti yang tertulis di gambar, dalam field APA PUN di outputmu.
- JANGAN mereproduksi teks asli meski sebagian — termasuk dalam field "deskripsi_pola".
  Gunakan deskripsi abstrak (mis. "deret angka dengan pola penambahan konstan", BUKAN
  "4, 7, 12, 19, 28, ...").
- Jika kamu merasa perlu mengutip sesuatu dari gambar untuk menjelaskan pola, GANTI dengan
  istilah generik (mis. sebut "Premis 1 dan Premis 2" bukan menulis ulang isi premisnya).

YANG HARUS DIANALISIS (jawab HANYA dalam JSON):
{
  "sub_komponen": "induktif" | "deduktif" | "kuantitatif",
  "jenis_stimulus": "deskripsi abstrak jenis stimulus, mis. 'deret angka dengan pola aritmatika', 'dua premis logis berbentuk implikasi', 'soal cerita dengan diskon harga'",
  "tipe_pertanyaan": "deskripsi abstrak apa yang ditanyakan, mis. 'melanjutkan pola deret', 'menentukan kesimpulan yang pasti benar', 'menghitung total setelah diskon'",
  "jumlah_langkah_penalaran": "perkiraan jumlah langkah logika/hitung yang dibutuhkan",
  "perkiraan_tingkat_kesulitan": "mudah" | "sedang" | "sulit",
  "alasan_kesulitan": "kenapa soal ini masuk tingkat kesulitan tersebut"
}

Jika gambar tidak jelas/tidak terbaca, ATAU isinya bukan soal Penalaran Umum (mis. soal
mata pelajaran biasa), kembalikan:
{ "error": "alasan kenapa tidak bisa dianalisis atau tidak sesuai kategori" }
```

## B. Generation Prompt — Mode Klon PU

```
[AMBIL system_prompt dasar dari skill PU yang sesuai dengan "sub_komponen" hasil analisis
— Induktif, Deduktif, atau Kuantitatif (lihat file skill-penalaran-umum-utbk.md), lalu
TAMBAHKAN blok instruksi berikut di akhir system_prompt tersebut sebelum dikirim sebagai
prompt generate]

INSTRUKSI TAMBAHAN — MODE KLON DARI GAMBAR:
Buat soal baru yang "satu keluarga gaya" dengan pola berikut (hasil analisis dari gambar
referensi), TANPA menyalin kata, angka, atau konteks spesifik apa pun dari sumber asli:
- Jenis stimulus: {{jenis_stimulus}}
- Tipe pertanyaan: {{tipe_pertanyaan}}
- Jumlah langkah penalaran: {{jumlah_langkah_penalaran}}
- Tingkat kesulitan target: {{perkiraan_tingkat_kesulitan}}

Soal yang kamu buat harus:
1. Memakai JENIS LOGIKA/STRUKTUR yang sama (mis. kalau referensinya deret aritmatika,
   buat juga deret aritmatika — tapi dengan angka awal dan beda yang berbeda).
2. Punya tingkat kesulitan yang setara (jumlah langkah penalaran serupa).
3. 100% ORISINAL dalam hal konteks, angka, kata, nama, dan skenario — TIDAK BOLEH ada
   kemiripan kata-per-kata dengan sumber referensi.
```

---

## C. Vision Prompt — Analisis Pola Gambar PPU

```
Kamu adalah penganalisis pola soal Pengetahuan dan Pemahaman Umum (PPU) UTBK. Kamu akan
diberikan SATU gambar berisi sebuah soal (kemungkinan difoto/screenshot dari buku, tryout,
atau sumber lain).

TUGASMU: menganalisis STRUKTUR dan POLA soal tersebut secara ABSTRAK.

LARANGAN MUTLAK:
- JANGAN mengetik ulang atau menyalin kata, kalimat, paragraf, atau opsi jawaban yang
  PERSIS SAMA seperti di gambar, dalam field APA PUN di outputmu.
- JANGAN mereproduksi teks asli meski sebagian, termasuk kata yang diuji maknanya (kalau
  soalnya sinonim/antonim, JANGAN sebutkan kata aslinya — cukup jelaskan jenis relasi
  maknanya secara abstrak, mis. "kata sifat dengan makna terkait efisiensi/penghematan").
- Untuk paragraf pada item ide_pokok/kesesuaian_wacana: JANGAN salin kalimat apa pun dari
  paragraf asli, cukup deskripsikan topik dan strukturnya secara umum (mis. "paragraf
  tentang tren sosial perkotaan dengan 1 ide utama di kalimat pertama").

YANG HARUS DIANALISIS (jawab HANYA dalam JSON):
{
  "item_type": "sinonim_antonim" | "analogi_kata" | "ide_pokok" | "kesesuaian_wacana" | "pengetahuan_umum_kebahasaan",
  "deskripsi_pola": "deskripsi abstrak topik/struktur, TANPA kata/kalimat asli dari gambar",
  "relasi_makna_atau_struktur": "untuk sinonim_antonim/analogi_kata: jenis relasi makna (mis. 'relasi profesi-objek yang dilayani'). untuk ide_pokok/kesesuaian_wacana: posisi ide utama & jumlah kalimat pendukung",
  "perkiraan_tingkat_kesulitan": "mudah" | "sedang" | "sulit",
  "alasan_kesulitan": "kenapa soal ini masuk tingkat kesulitan tersebut"
}

Jika gambar tidak jelas/tidak terbaca, ATAU isinya bukan soal PPU, kembalikan:
{ "error": "alasan kenapa tidak bisa dianalisis atau tidak sesuai kategori" }
```

## D. Generation Prompt — Mode Klon PPU

```
[AMBIL system_prompt dasar dari skill PPU (lihat file skill-ppu-utbk.md), lalu TAMBAHKAN
blok instruksi berikut di akhir system_prompt tersebut sebelum dikirim sebagai prompt
generate]

INSTRUKSI TAMBAHAN — MODE KLON DARI GAMBAR:
Buat soal baru bertipe "{{item_type}}" yang "satu keluarga gaya" dengan pola berikut (hasil
analisis dari gambar referensi), TANPA menyalin kata, kalimat, atau konteks spesifik apa
pun dari sumber asli:
- Deskripsi pola: {{deskripsi_pola}}
- Relasi makna/struktur: {{relasi_makna_atau_struktur}}
- Tingkat kesulitan target: {{perkiraan_tingkat_kesulitan}}

Soal yang kamu buat harus:
1. Memakai JENIS RELASI/STRUKTUR yang sama (mis. kalau referensinya relasi "profesi-objek
   yang dilayani" untuk analogi kata, buat analogi dengan relasi yang sama tapi pasangan
   kata yang BERBEDA TOTAL).
2. Punya tingkat kesulitan setara dengan referensi.
3. 100% ORISINAL — kata, kalimat, paragraf, dan konteks HARUS berbeda dari sumber asli,
   tidak boleh ada kemiripan kata-per-kata.
```

---

## Prompt Vibe Coding — Implementasi Fitur Klon dari Gambar

```
Tambahkan fitur "Klon dari Gambar" ke modul Skill yang sudah ada (lihat Prompt 4 di
blueprint utama).

Backend:
1. Tambahkan tabel `skill_image_sources` (id, skill_id, image_path, exam_type,
   classified_subtype, extracted_pattern jsonb, uploaded_by, created_at) lewat migration.
2. Tambahkan method `analyzeQuestionImage(imageBase64, mimeType, examType)` ke
   `GeminiProvider` di folder `backend/src/ai/` — kirim gambar + prompt analisis pola
   (gunakan prompt Vision PU/PPU yang sudah disediakan, pilih sesuai examType) ke Gemini
   API dengan format multimodal (`inline_data` base64 + teks instruksi).
3. Endpoint POST /api/skills/:id/clone-from-image — terima file upload gambar (multipart,
   validasi tipe file image/jpeg|png, max ukuran wajar mis. 5MB), simpan file, panggil
   `analyzeQuestionImage()`, simpan hasil ke `skill_image_sources`, return hasil analisis
   pola ke frontend untuk dikonfirmasi operator SEBELUM dipakai generate.
4. Endpoint POST /api/generate harus punya parameter opsional `image_source_id` — kalau
   diisi, ambil `extracted_pattern` dari `skill_image_sources`, gabungkan ke system_prompt
   skill terkait sesuai template "Generation Prompt — Mode Klon" yang sudah disediakan,
   baru kirim ke generator (reuse job generate dari Prompt 5, jangan bikin jalur baru).

Frontend (di halaman /skills atau /generate):
- Tambahkan opsi "Klon dari Gambar" — upload gambar, tampilkan preview, lalu tampilkan
  hasil analisis pola dari AI (jenis stimulus/item_type, tingkat kesulitan, dll) dalam
  bentuk yang mudah dibaca operator.
- WAJIB ada langkah konfirmasi manual: operator melihat hasil analisis pola dulu, baru klik
  "Gunakan pola ini untuk generate" — jangan langsung auto-generate tanpa konfirmasi,
  supaya operator bisa menolak kalau hasil analisisnya keliru/tidak relevan.
- Setelah dikonfirmasi, redirect ke form generate biasa dengan `image_source_id` sudah
  terisi otomatis.

Catatan penting yang harus ditegaskan di UI (tampilkan sebagai info box):
"Fitur ini hanya meniru POLA/STRUKTUR soal dari gambar, bukan menyalin isinya. Pastikan
gambar yang diupload adalah soal yang kamu punya hak pakai."
```

---

## Catatan Pemakaian

1. **Selalu cek hasil analisis pola sebelum generate.** Kalau AI vision salah klasifikasi
   (mis. PU Induktif dikira Deduktif), hasil generate-nya bakal melenceng — makanya ada
   langkah konfirmasi manual di alur ini, jangan dilewati.
2. **1 gambar = 1 pola.** Kalau mau variasi lebih kaya, upload beberapa gambar referensi
   berbeda secara terpisah dan generate dari masing-masing, daripada menggabungkan banyak
   pola jadi satu instruksi (lebih mudah dikontrol kualitasnya).
3. Fitur ini paling pas dipakai untuk: "saya punya soal hasil tryout internal/tim sendiri,
   mau bikin variasi baru dengan gaya serupa" — BUKAN untuk menggandakan soal dari sumber
   pihak ketiga yang tidak kamu punya izinnya.
4. AI Reviewer (Prompt 6 di blueprint utama) tetap berjalan normal untuk soal hasil mode
   klon — tidak perlu kriteria tambahan khusus, karena outputnya tetap soal PU/PPU biasa
   yang divalidasi dengan kriteria yang sama.