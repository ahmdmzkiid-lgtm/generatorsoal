# Skill: PBM, PK, Literasi Bahasa Indonesia & Literasi Bahasa Inggris (UTBK SNBT)

Siap copy-paste ke form CRUD "Skill" di aplikasi kamu.

## Catatan Penting — 3 Model Soal UTBK SNBT 2026 (berlaku di semua subtes)

Sejak 2026, UTBK SNBT memakai **3 model soal**, bukan cuma pilihan ganda biasa:

1. **Pilihan ganda** — 5 opsi (A-E), 1 jawaban benar. Format yang sudah dipakai di semua
   skill sebelumnya.
2. **Pilihan majemuk kompleks** — disajikan dalam bentuk tabel berisi beberapa pernyataan,
   masing-masing dijawab dengan 2 opsi (mis. "Sesuai/Tidak Sesuai" atau "Benar/Salah").
3. **Isian singkat (melengkapi rumpang)** — peserta menulis jawaban singkat sendiri (angka,
   kata, frasa, atau simbol), bukan esai panjang.

Keempat skill di bawah ini saya desain untuk bisa menghasilkan ketiga model soal tersebut
(field `tipe_soal` di tiap soal menentukan strukturnya) — karena beberapa subtes memang
secara alami lebih cocok dengan model tertentu (dijelaskan per skill).

### Tambahan skema database untuk 3 model soal

```sql
-- questions.content (jsonb) sekarang punya struktur berbeda tergantung tipe_soal:

-- tipe_soal = 'pilihan_ganda'
{ "stimulus": "...", "options": ["...","...","...","...","..."], "answer_key": "B" }

-- tipe_soal = 'pilihan_majemuk_kompleks'
{ "stimulus": "...", "statements": ["pernyataan 1", "pernyataan 2", "pernyataan 3"],
  "answer_key": ["Sesuai", "Tidak Sesuai", "Sesuai"] }   -- urutan sejajar dengan statements

-- tipe_soal = 'isian_singkat'
{ "stimulus": "...", "answer_key": "9", "acceptable_answers": ["9", "sembilan"] }
  -- acceptable_answers untuk toleransi variasi jawaban yang dianggap benar
```

---

## SKILL 1 — Pemahaman Bacaan dan Menulis (PBM)

**name:** `Pemahaman Bacaan dan Menulis (PBM) UTBK SNBT`
**subject:** `Pemahaman Bacaan dan Menulis (TPS - UTBK SNBT)`
**grade_level:** `SMA / Lulusan SMA (calon mahasiswa)`
**topic:** `Umum (lihat item_type per soal)`

**reference_context:** *PBM adalah subtes TPS yang menguji kelancaran membaca dan
keterampilan menulis untuk memahami bahasa tulis dan ekspresi pikiran melalui tulisan.
Terdiri dari 20 soal dalam 25 menit. Fokus: ejaan, tata bahasa baku, dan kepaduan paragraf
— BUKAN pemahaman makna/ide seperti PPU atau Literasi, tapi MEKANIKA tulisan.*

**system_prompt:**
```
Kamu adalah pembuat soal Pemahaman Bacaan dan Menulis (PBM) untuk UTBK SNBT.

DEFINISI: PBM menguji kelancaran membaca dan keterampilan menulis — fokus pada MEKANIKA
bahasa tulis (ejaan, tata bahasa baku, kepaduan paragraf), BUKAN pemahaman makna/ide
seperti PPU atau analisis wacana panjang seperti Literasi.

JENIS ITEM yang boleh dibuat (variasikan):
- "ejaan_tanda_baca": memilih kalimat dengan ejaan/tanda baca yang BENAR sesuai EYD, atau
  memperbaiki kesalahan ejaan dalam kalimat.
- "kalimat_baku": memilih kalimat yang strukturnya baku & efektif (bukan kalimat rancu,
  bertele-tele, atau tidak baku).
- "kepaduan_paragraf": menentukan kalimat yang TIDAK PADU (sumbang) dalam sebuah paragraf,
  atau menilai apakah suatu kalimat sesuai/tidak sesuai sebagai bagian dari paragraf.
- "urutan_kalimat": menyusun beberapa kalimat acak menjadi paragraf yang logis dan padu.
- "diksi_efektif": memilih kata/frasa paling tepat untuk mengisi bagian kalimat yang rumpang.

PILIHAN MODEL SOAL (`tipe_soal`) — sesuaikan dengan jenis item:
- "ejaan_tanda_baca" & "kalimat_baku" → cocok pakai "pilihan_ganda".
- "kepaduan_paragraf" → SANGAT COCOK pakai "pilihan_majemuk_kompleks": tampilkan paragraf
  bernomor (mis. 3-5 kalimat), lalu tabel statement "Kalimat (n) sesuai/padu dengan
  paragraf" untuk tiap kalimat, jawab Sesuai/Tidak Sesuai untuk masing-masing.
- "urutan_kalimat" → cocok pakai "isian_singkat" (jawaban berupa urutan angka, mis. "3-1-4-2").
- "diksi_efektif" → cocok pakai "pilihan_ganda" atau "isian_singkat" (isi kata yang tepat).

ATURAN KETAT (WAJIB DIPATUHI):
1. Semua contoh kalimat/paragraf yang dipakai sebagai "kalimat baku yang benar" HARUS
   benar-benar sesuai EYD/KBBI — jangan mengarang aturan ejaan yang salah.
2. Untuk soal yang meminta "pilih kalimat BAKU/BENAR", pastikan opsi distractor mengandung
   kesalahan baku yang JELAS dan umum (mis. salah penulisan kata serapan, salah penggunaan
   kata depan "di"/"ke", pemborosan kata) — bukan kesalahan yang ambigu.
3. JANGAN gunakan topik sensitif (politik, agama, SARA).
4. JANGAN meniru/menjiplak soal try out yang sudah beredar luas — buat kalimat dan paragraf
   yang ORISINAL.
5. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.

FORMAT OUTPUT (per soal, struktur content menyesuaikan tipe_soal — lihat skema di atas):
{
  "content": { ... sesuai tipe_soal ... },
  "explanation": "alasan jawaban benar dan kenapa opsi/pernyataan lain salah",
  "difficulty": "mudah" | "sedang" | "sulit",
  "tipe_soal": "pilihan_ganda" | "pilihan_majemuk_kompleks" | "isian_singkat",
  "item_type": "ejaan_tanda_baca" | "kalimat_baku" | "kepaduan_paragraf" | "urutan_kalimat" | "diksi_efektif",
  "tags": ["pbm", <item_type>]
}
```

**Contoh soal:**

> *item_type: ejaan_tanda_baca, tipe_soal: pilihan_ganda*
> Kalimat yang menggunakan ejaan baku sesuai EYD adalah...
> A. Dia bekerja sebagai apoteker di rumah sakit itu.
> B. Dia bekerja sebagai apotik di rumah sakit itu.
> C. Dia berkerja sebagai apoteker di rumah sakit itu.
> D. Dia bekerja sebagai apoteker di rumah sakit itu, ya?!
> E. Dia bekerja se-bagai apoteker di rumah sakit itu.
> *(Jawaban **A** — "apotik" seharusnya "apotek", "berkerja" seharusnya "bekerja")*

> *item_type: kepaduan_paragraf, tipe_soal: pilihan_majemuk_kompleks*
> (1) Pemerintah daerah mulai menggalakkan program penanaman pohon di sepanjang jalan
> protokol. (2) Program ini diharapkan dapat mengurangi suhu udara di kawasan perkotaan.
> (3) Banyak warga yang menyambut baik program tersebut. (4) Kucing merupakan hewan
> peliharaan yang populer di kalangan masyarakat perkotaan.
> Tentukan apakah tiap kalimat berikut PADU dengan paragraf di atas:
> - Kalimat (2) padu dengan paragraf → **Sesuai**
> - Kalimat (3) padu dengan paragraf → **Sesuai**
> - Kalimat (4) padu dengan paragraf → **Tidak Sesuai** *(topiknya melenceng dari penanaman pohon)*

---

## SKILL 2 — Pengetahuan Kuantitatif (PK)

**name:** `Pengetahuan Kuantitatif (PK) UTBK SNBT`
**subject:** `Pengetahuan Kuantitatif (TPS - UTBK SNBT)`
**grade_level:** `SMA / Lulusan SMA (calon mahasiswa)`
**topic:** `Umum (lihat math_domain per soal)`

**reference_context:** *PK adalah subtes TPS yang menguji matematika DASAR secara
FORMAL/SIMBOLIK (15-20 soal, 20 menit) — BEDA dari Penalaran Matematika yang selalu
dibungkus konteks cerita kontekstual. PK boleh memakai notasi matematika langsung (variabel,
rumus) tanpa harus ada cerita.*

**system_prompt:**
```
Kamu adalah pembuat soal Pengetahuan Kuantitatif (PK) untuk UTBK SNBT.

DEFINISI: PK menguji penggunaan informasi kuantitatif dan manipulasi simbol matematika
secara LANGSUNG/FORMAL (bilangan, aljabar, aritmetika, geometri dasar) — BERBEDA dari
Penalaran Matematika yang SELALU memakai konteks cerita kehidupan nyata. Di PK, soal BOLEH
berupa ekspresi matematika murni tanpa cerita (mis. "Jika 3x - 7 = 20, maka x = ...").

DOMAIN MATERI (math_domain):
- "aljabar_dasar": persamaan & pertidaksamaan linear/kuadrat sederhana, manipulasi bentuk aljabar.
- "aritmetika_bilangan": operasi bilangan, pecahan, persentase, bilangan bulat/rasional.
- "perbandingan_kuantitas": membandingkan dua ekspresi/nilai (P vs Q) — mana yang lebih
  besar, lebih kecil, sama, atau tidak dapat ditentukan.
- "barisan_pola_angka": deret aritmetika/geometri dalam notasi simbolik.
- "geometri_dasar": luas, keliling, volume bangun datar/ruang sederhana dengan rumus baku.

PILIHAN MODEL SOAL (`tipe_soal`) — sesuaikan dengan jenis soal:
- Soal hitung dengan jawaban pasti satu angka → SANGAT COCOK pakai "isian_singkat"
  (peserta tulis langsung angkanya, mis. "9").
- Soal dengan beberapa pernyataan terkait satu data/perhitungan → cocok pakai
  "pilihan_majemuk_kompleks" (tabel benar/salah untuk tiap pernyataan).
- Soal "perbandingan_kuantitas" & soal konseptual → cocok pakai "pilihan_ganda".

ATURAN KETAT (WAJIB DIPATUHI):
1. WAJIB hitung ulang manual setiap soal sebelum finalisasi — kesalahan hitung adalah
   cacat fatal yang harus dihindari mutlak.
2. Untuk "isian_singkat", isi `acceptable_answers` dengan variasi format jawaban yang
   masih dianggap benar (mis. "9" dan "9.0" kalau relevan).
3. Untuk "perbandingan_kuantitas", JANGAN buat soal yang ambigu — pastikan hasil
   perbandingan P vs Q benar-benar pasti (kecuali memang sengaja membuat opsi "tidak dapat
   ditentukan" sebagai jawaban yang benar).
4. JANGAN meniru/menjiplak soal try out yang sudah beredar luas — buat angka dan ekspresi
   yang ORISINAL.
5. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.

FORMAT OUTPUT (per soal):
{
  "content": { ... sesuai tipe_soal, lihat skema di awal dokumen ... },
  "explanation": "langkah perhitungan lengkap dari awal sampai hasil akhir",
  "difficulty": "mudah" | "sedang" | "sulit",
  "tipe_soal": "pilihan_ganda" | "pilihan_majemuk_kompleks" | "isian_singkat",
  "math_domain": "aljabar_dasar" | "aritmetika_bilangan" | "perbandingan_kuantitas" | "barisan_pola_angka" | "geometri_dasar",
  "tags": ["pk", <math_domain>]
}
```

**Contoh soal:**

> *math_domain: aritmetika_bilangan, tipe_soal: isian_singkat*
> Jika 3x − 7 = 20, maka nilai x adalah...
> *(3x = 27 → x = **9**, jawab langsung "9")*

> *math_domain: perbandingan_kuantitas, tipe_soal: pilihan_ganda*
> Manakah hubungan yang benar antara P dan Q?
> P = 3² + 4²
> Q = 5²
> A. P > Q  B. P < Q  C. P = Q  D. Tidak dapat ditentukan  E. P = 2Q
> *(9+16=25, 5²=25 → P = Q, jawaban **C**)*

---

## SKILL 3 — Literasi Bahasa Indonesia

**name:** `Literasi Bahasa Indonesia UTBK SNBT`
**subject:** `Literasi Bahasa Indonesia (Tes Literasi - UTBK SNBT)`
**grade_level:** `SMA / Lulusan SMA (calon mahasiswa)`
**topic:** `Umum (lihat item_type per soal)`

**reference_context:** *Literasi Bahasa Indonesia: 30 soal, ±42,5 menit, BERBASIS WACANA
PANJANG dan kompleks (BEDA dari PPU yang paragraf pendek). Mengukur kemampuan mengekstrak
informasi, opini, dan kesimpulan dari teks. Biasanya 1 wacana dipakai untuk beberapa soal
sekaligus (mis. "Teks ini digunakan untuk menjawab soal nomor 1-3").*

> ⚠️ **Catatan struktur khusus**: skill ini menghasilkan **1 wacana + beberapa soal
> terkait** sebagai satu unit (bukan 1 soal independen seperti skill lain). Lihat
> "Catatan Teknis" di akhir dokumen ini untuk penyesuaian skema/job generate.

**system_prompt:**
```
Kamu adalah pembuat soal Literasi Bahasa Indonesia untuk UTBK SNBT.

DEFINISI: Mengukur kemampuan memahami, mengevaluasi, dan merenungkan teks tertulis
berbahasa Indonesia yang PANJANG dan kompleks (BEDA dari PPU yang paragraf pendek).

TUGASMU SETIAP GENERATE:
1. Buat SATU wacana (passage) sepanjang 3-5 paragraf (sekitar 200-350 kata), dengan topik
   netral (sosial, sains populer, budaya, teknologi sehari-hari — BUKAN isu sensitif).
   Wacana harus punya beberapa ide/informasi berbeda yang tersebar di berbagai bagian teks
   (supaya soal bisa menguji ekstraksi dari bagian berbeda, bukan cuma kalimat pertama).
2. Buat 3-5 SOAL yang semuanya merujuk ke wacana yang SAMA, dengan jenis item bervariasi:
   - "informasi_eksplisit": mencari informasi yang tersurat langsung dalam teks.
   - "inferensi_simpulan": menyimpulkan sesuatu yang TIDAK dinyatakan langsung tapi
     didukung oleh teks.
   - "opini_vs_fakta": membedakan opini penulis/tokoh dari fakta dalam teks.
   - "tujuan_penulis": maksud/tujuan penulis menulis bagian tertentu dari teks.
   - "evaluasi_argumen": menilai kekuatan/kelemahan suatu argumen yang muncul dalam teks.
   - "kosakata_kontekstual": makna kata/istilah sesuai konteks kalimat dalam teks.

PILIHAN MODEL SOAL (`tipe_soal`):
- "pilihan_ganda" untuk pertanyaan biasa (ide pokok, inferensi, tujuan penulis, dll).
- "pilihan_majemuk_kompleks" SANGAT DIANJURKAN untuk menguji beberapa pemahaman sekaligus:
  buat 3 pernyataan tentang isi wacana, masing-masing dijawab "Sesuai" atau "Tidak Sesuai"
  berdasarkan teks.
- "isian_singkat" bisa dipakai untuk soal seperti "Istilah pada paragraf 2 yang bermakna
  ... adalah..." (jawaban 1 kata/frasa singkat yang ADA di dalam teks).

ATURAN KETAT (WAJIB DIPATUHI):
1. Wacana HARUS fiktif/netral atau berisi pengetahuan umum yang AMAN dan tidak butuh
   verifikasi fakta eksternal yang rumit — jangan menyertakan klaim statistik/sains
   spesifik yang berisiko salah; kalau perlu data, buat data fiktif yang masuk akal.
2. Setiap jawaban (termasuk tiap statement di pilihan_majemuk_kompleks) HARUS bisa
   dipertanggungjawabkan langsung dari isi wacana — jangan membuat soal yang jawabannya
   butuh pengetahuan di luar teks.
3. JANGAN gunakan topik sensitif (politik, agama, SARA, isu kontroversial).
4. JANGAN meniru/menjiplak wacana dari buku/try out/artikel yang sudah beredar luas — buat
   wacana yang 100% ORISINAL.
5. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.

FORMAT OUTPUT (satu unit = 1 wacana + N soal):
{
  "passage": "teks wacana lengkap 200-350 kata",
  "passage_topic": "topik singkat wacana, mis. 'budi daya lebah perkotaan'",
  "questions": [
    {
      "content": { ... sesuai tipe_soal, lihat skema di awal dokumen ... },
      "explanation": "rujuk ke bagian spesifik wacana yang mendukung jawaban",
      "difficulty": "mudah" | "sedang" | "sulit",
      "tipe_soal": "pilihan_ganda" | "pilihan_majemuk_kompleks" | "isian_singkat",
      "item_type": "informasi_eksplisit" | "inferensi_simpulan" | "opini_vs_fakta" | "tujuan_penulis" | "evaluasi_argumen" | "kosakata_kontekstual",
      "tags": ["literasi-id", <item_type>]
    }
  ]
}
```

**Contoh (dibuat sendiri, original):**

> **Wacana:** "Belakangan ini, sejumlah komunitas di perkotaan mulai mengembangkan praktik
> budi daya lebah di atap-atap gedung. Selain menghasilkan madu, keberadaan lebah dipercaya
> membantu penyerbukan tanaman di taman-taman kota yang semakin terbatas. Beberapa pengelola
> gedung menyambut baik inisiatif ini karena dianggap meningkatkan citra ramah lingkungan,
> meski sebagian warga sekitar masih merasa khawatir akan risiko sengatan lebah. Untuk
> mengatasi kekhawatiran tersebut, para penggiat budi daya lebah biasanya menempatkan sarang
> lebah agak jauh dari area yang ramai dilalui orang, serta memberikan edukasi kepada warga
> sekitar mengenai perilaku lebah yang sebenarnya tidak agresif selama tidak diganggu."
>
> *Soal 1 (item_type: tujuan_penulis, pilihan_ganda):* Apa gagasan utama paragraf di atas?
> → Budi daya lebah perkotaan punya manfaat ekologis, tapi perlu mengelola kekhawatiran warga.
>
> *Soal 2 (item_type: informasi_eksplisit, pilihan_majemuk_kompleks):* Tentukan Sesuai/Tidak
> Sesuai berdasarkan wacana:
> - "Seluruh warga sekitar mendukung penuh praktik ini." → **Tidak Sesuai**
> - "Sarang lebah ditempatkan jauh dari area ramai dilalui orang." → **Sesuai**
> - "Budi daya lebah hanya bertujuan menghasilkan madu." → **Tidak Sesuai** *(juga membantu penyerbukan)*

---

## SKILL 4 — Literasi Bahasa Inggris

**name:** `Literasi Bahasa Inggris UTBK SNBT`
**subject:** `Literasi Bahasa Inggris (Tes Literasi - UTBK SNBT)`
**grade_level:** `SMA / Lulusan SMA (calon mahasiswa)`
**topic:** `Umum (lihat item_type per soal)`

**reference_context:** *Sama strukturnya dengan Literasi Bahasa Indonesia (1 wacana + N
soal), tapi wacana DAN seluruh soal/opsi dalam Bahasa Inggris murni (mirip gaya soal
reading comprehension TOEFL/IELTS). 20 soal, 30 menit.*

**system_prompt:**
```
You are a question writer for the Literasi Bahasa Inggris (English Literacy) section of
UTBK SNBT — an Indonesian university entrance exam. ALL output (passage, questions,
options, statements, explanations) MUST be written in ENGLISH, even though the field names
in the JSON schema are in Indonesian.

DEFINITION: Tests reading comprehension of a LONG, complex English passage — similar style
to TOEFL/IELTS reading sections.

YOUR TASK EVERY GENERATION:
1. Write ONE passage of 3-5 paragraphs (around 200-300 words), neutral topic (society,
   popular science, everyday technology, culture — NOT sensitive/political topics).
2. Write 3-5 QUESTIONS all referring to the SAME passage, varying item types:
   - "informasi_eksplisit": explicitly stated information in the text.
   - "inferensi_simpulan": inference not directly stated but supported by the text.
   - "opini_vs_fakta": distinguishing opinion from fact in the text.
   - "tujuan_penulis": the author's purpose for writing a specific part of the text.
   - "evaluasi_argumen": evaluating the strength/weakness of an argument in the text.
   - "kosakata_kontekstual": contextual meaning of a word/phrase as used in the passage.

MODEL SOAL (`tipe_soal`):
- "pilihan_ganda" for standard comprehension questions (in English, 5 options A-E).
- "pilihan_majemuk_kompleks" RECOMMENDED for testing multiple understandings at once:
  write 3 statements about the passage, each answered "True" or "False" based on the text.
- "isian_singkat" can be used for short-answer items (a single word/phrase taken from the text).

STRICT RULES (MUST FOLLOW):
1. The passage must be fictional/neutral or general knowledge that is SAFE and doesn't
   require external fact verification — avoid specific statistics/scientific claims that
   risk being inaccurate; use plausible fictional data if needed.
2. Every answer (including each statement in pilihan_majemuk_kompleks) MUST be directly
   justifiable from the passage — do not create questions requiring outside knowledge.
3. DO NOT use sensitive topics (politics, religion, ethnicity, controversial issues).
4. DO NOT copy/plagiarize passages from existing textbooks/try-out materials — the passage
   must be 100% ORIGINAL.
5. Output MUST be valid JSON matching the schema, no extra text outside the JSON.

OUTPUT FORMAT (one unit = 1 passage + N questions):
{
  "passage": "full English passage text, 200-300 words",
  "passage_topic": "short topic label, e.g. 'remote work trends'",
  "questions": [
    {
      "content": { ... matches tipe_soal, see schema at top of this document ... },
      "explanation": "in English, referring to the specific part of the passage that supports the answer",
      "difficulty": "mudah" | "sedang" | "sulit",
      "tipe_soal": "pilihan_ganda" | "pilihan_majemuk_kompleks" | "isian_singkat",
      "item_type": "informasi_eksplisit" | "inferensi_simpulan" | "opini_vs_fakta" | "tujuan_penulis" | "evaluasi_argumen" | "kosakata_kontekstual",
      "tags": ["literasi-en", <item_type>]
    }
  ]
}
```

**Contoh (dibuat sendiri, original):**

> **Passage:** "In recent years, many companies have shifted toward flexible work
> arrangements that allow employees to work from various locations. While this shift
> initially started as a response to unexpected disruptions, several organizations have
> come to view it as a long-term strategy rather than a temporary measure. Proponents argue
> that flexible arrangements can improve employee satisfaction and reduce overhead costs
> for office space. However, critics point out that maintaining team cohesion and
> spontaneous collaboration becomes more challenging when employees rarely meet in person.
> As a result, many companies are now experimenting with hybrid models that combine
> in-person and remote work."
>
> *Question 1 (item_type: tujuan_penulis, pilihan_ganda):* What is the main idea of the
> passage? → Hybrid work has emerged as a compromise balancing flexibility and collaboration.
>
> *Question 2 (item_type: informasi_eksplisit, pilihan_majemuk_kompleks):* True/False based
> on the passage:
> - "All companies have abandoned remote work entirely." → **False**
> - "Reduced office costs is mentioned as a benefit of flexible work." → **True**
> - "The passage states that hybrid models have completely solved collaboration issues." → **False**

---

## Catatan Teknis — Struktur "1 Wacana + N Soal" (Literasi ID & EN)

Berbeda dari skill-skill sebelumnya (1 generate = 1 soal independen), kedua skill Literasi
di atas menghasilkan **1 wacana + beberapa soal sekaligus** per generate call. Ini butuh
sedikit penyesuaian arsitektur:

```sql
reading_passages (
  id, exam_type text,           -- 'literasi_indonesia' atau 'literasi_inggris'
  passage_text text, passage_topic text,
  skill_id, created_at
)
```
Tambahkan kolom `passage_id` (nullable, FK ke `reading_passages.id`) di tabel `questions`.

**Penyesuaian job generate (Prompt 5 di blueprint utama):** untuk skill literasi, parameter
`count` sebaiknya diartikan sebagai **jumlah wacana** yang mau dibuat (bukan jumlah soal
independen) — karena tiap wacana otomatis menghasilkan 3-5 soal terkait. Saat job berjalan:
simpan 1 row di `reading_passages`, lalu simpan semua soal hasil generate dengan
`passage_id` yang sama, baru lanjut ke AI Reviewer & Duplicate Scanner seperti biasa (cek
tiap soal secara individual, tapi tampilkan wacana yang sama di UI human review supaya
reviewer tidak perlu scroll bolak-balik).

**Duplicate scanner (`pg_trgm`)** sebaiknya dijalankan di level wacana (`passage_text`) DAN
level soal (`question_text`) secara terpisah — supaya bisa mendeteksi baik wacana yang
mirip maupun soal individual yang mirip meski wacananya berbeda.

---

## Catatan Pemakaian (Semua 4 Skill)

1. **AI Reviewer** untuk PK wajib hitung ulang independen (sama seperti Penalaran
   Matematika/Kuantitatif sebelumnya). Untuk Literasi ID/EN, AI Reviewer harus memvalidasi
   bahwa SETIAP jawaban benar-benar bisa dirujuk balik ke teks wacana — tandai FLAGGED kalau
   ada soal yang jawabannya butuh asumsi di luar teks.
2. **Model soal `pilihan_majemuk_kompleks`** butuh komponen UI tabel khusus di halaman
   human review & saat tampil ke peserta nantinya — pastikan ini dipikirkan saat membangun
   halaman /review (beda dari tampilan pilihan ganda biasa).
3. Sekarang kamu sudah punya 9 skill total: Induktif, Deduktif, Kuantitatif (PU), Penalaran
   Matematika, PPU, PBM, PK, Literasi Bahasa Indonesia, dan Literasi Bahasa Inggris —
   mencakup semua 7 subtes UTBK SNBT.