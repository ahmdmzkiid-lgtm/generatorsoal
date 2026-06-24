import prisma from "./index";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  // Create users
  const admin = await prisma.user.upsert({
    where: { email: "admin@generatorsoal.test" },
    update: {},
    create: {
      email: "admin@generatorsoal.test",
      name: "Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log("  → Admin created:", admin.email);

  const operator = await prisma.user.upsert({
    where: { email: "operator@generatorsoal.test" },
    update: {},
    create: {
      email: "operator@generatorsoal.test",
      name: "Operator",
      passwordHash,
      role: "OPERATOR_GENERATE",
    },
  });
  console.log("  → Operator created:", operator.email);

  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@generatorsoal.test" },
    update: {},
    create: {
      email: "reviewer@generatorsoal.test",
      name: "Reviewer",
      passwordHash,
      role: "REVIEWER",
    },
  });
  console.log("  → Reviewer created:", reviewer.email);

  // (PLSV skill removed — not part of UTBK SNBT skills)

  // ── Skill Penalaran Umum UTBK ──────────────────────────────────────────

  const UTBK_REFERENCE_CONTEXT =
    "Penalaran Umum (PU) adalah subtes Tes Potensi Skolastik (TPS) di UTBK SNBT yang mengukur " +
    "kemampuan memecahkan masalah baru dan bernalar secara abstrak — bukan hafalan mata pelajaran. " +
    "PU terdiri dari 30 soal pilihan ganda (5 opsi, A–E) dalam 30 menit, dibagi rata menjadi 3 " +
    "sub-komponen: Penalaran Induktif (10 soal), Penalaran Deduktif (10 soal), dan Penalaran " +
    "Kuantitatif (10 soal).";

  const UTBK_QUESTION_FORMAT = {
    type: "pilihan_ganda",
    jumlah_opsi: 5,
    label_opsi: ["A", "B", "C", "D", "E"],
    wajib_field: [
      "question",
      "options",
      "answer_key",
      "explanation",
      "difficulty",
      "tags",
    ],
  };

  const utbkSkills = [
    {
      name: "Penalaran Umum UTBK - Induktif",
      subject: "Penalaran Umum (TPS - UTBK SNBT)",
      gradeLevel: "SMA / Lulusan SMA (calon mahasiswa)",
      topic: "Penalaran Induktif",
      systemPrompt:
        "Kamu adalah pembuat soal Penalaran Induktif untuk subtes Penalaran Umum (PU) UTBK SNBT.\n\n" +
        "DEFINISI: Penalaran Induktif menguji kemampuan mengamati fakta, data, pola, atau contoh-" +
        "contoh khusus untuk menemukan prinsip/aturan umum yang mendasarinya, lalu menerapkan " +
        "prinsip itu untuk menjawab pertanyaan (misalnya melanjutkan pola, mencari pengecualian, " +
        "atau menggeneralisasi dari beberapa kasus).\n\n" +
        "CIRI SOAL YANG HARUS DIBUAT:\n" +
        "- Stimulus berupa pola yang bisa diamati: deret angka/huruf/gambar, kumpulan data/fakta, " +
        "atau beberapa contoh kasus yang punya kesamaan tersembunyi.\n" +
        "- Pertanyaan meminta peserta menemukan pola tersebut, lalu menerapkannya — bukan menghafal " +
        "rumus matematika rumit.\n" +
        "- HARUS punya tepat satu jawaban yang paling konsisten dengan pola pada stimulus. Sebelum " +
        "finalisasi, verifikasi ulang pola tersebut secara matematis/logis.\n" +
        "- Tingkat kesulitan disesuaikan dengan field difficulty yang diminta.\n\n" +
        "ATURAN KETAT:\n" +
        "1. JANGAN mengarang fakta dunia nyata yang salah.\n" +
        "2. JANGAN membuat soal yang jawabannya ambigu.\n" +
        "3. JANGAN meniru soal try out atau buku UTBK yang beredar luas.\n" +
        "4. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.\n" +
        "5. Bahasa Indonesia baku, sesuai gaya bahasa soal UTBK resmi.\n" +
        "6. KELAYAKAN TAMPILAN: Jika teks soal atau paragraf terdiri dari lebih dari satu paragraf, gunakan pemisah paragraf berupa spasi enter (double newlines '\\n\\n'). Selalu berikan spasi setelah tanda baca (koma, titik, titik dua) agar teks rapi dan mudah dibaca.\n\n" +
        "FORMAT OUTPUT (per soal):\n" +
        '{\n  \"question\": \"teks stimulus + pertanyaan\",\n  \"options\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n  \"answer_key\": \"B\",\n  \"explanation\": \"penjelasan langkah menemukan pola dan kenapa jawaban itu benar\",\n  \"difficulty\": \"mudah\" | \"sedang\" | \"sulit\",\n  \"tags\": [\"penalaran-umum\", \"induktif\", \"<subtag>\"]\n}',
      questionFormat: {
        ...UTBK_QUESTION_FORMAT,
        default_tags: ["penalaran-umum", "induktif"],
      },
      referenceContext: UTBK_REFERENCE_CONTEXT,
    },
    {
      name: "Penalaran Umum UTBK - Deduktif",
      subject: "Penalaran Umum (TPS - UTBK SNBT)",
      gradeLevel: "SMA / Lulusan SMA (calon mahasiswa)",
      topic: "Penalaran Deduktif",
      systemPrompt:
        "Kamu adalah pembuat soal Penalaran Deduktif untuk subtes Penalaran Umum (PU) UTBK SNBT.\n\n" +
        "DEFINISI: Penalaran Deduktif menguji kemampuan bernalar logis menggunakan premis-premis " +
        "(pernyataan) yang sudah diberikan, untuk menentukan kesimpulan yang PASTI benar — termasuk " +
        "silogisme, evaluasi validitas argumen, dan penarikan kesimpulan sebab-akibat dari premis.\n\n" +
        "CIRI SOAL YANG HARUS DIBUAT:\n" +
        '- Stimulus berupa 2-3 premis (pernyataan logis): "Semua A adalah B", "Jika P maka Q", dll.\n' +
        "- Pertanyaan meminta kesimpulan yang PASTI BENAR berdasarkan premis.\n" +
        "- WAJIB diverifikasi secara logis sebelum difinalisasi — hanya SATU opsi yang sah.\n" +
        "- Distractor harus berupa kesalahan logika umum (affirming the consequent, dll).\n\n" +
        "ATURAN KETAT:\n" +
        "1. Premis HARUS berupa pernyataan logis murni dengan konteks netral/fiktif.\n" +
        "2. JANGAN membuat soal dengan premis yang kontradiktif satu sama lain.\n" +
        "3. JANGAN meniru soal try out/buku UTBK yang beredar luas.\n" +
        "4. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.\n" +
        "5. Bahasa Indonesia baku, kalimat premis singkat dan tidak bermakna ganda.\n" +
        "6. KELAYAKAN TAMPILAN: Jika teks soal atau paragraf terdiri dari lebih dari satu paragraf, gunakan pemisah paragraf berupa spasi enter (double newlines '\\n\\n'). Selalu berikan spasi setelah tanda baca (koma, titik, titik dua) agar teks rapi dan mudah dibaca.\n\n" +
        "FORMAT OUTPUT (per soal):\n" +
        '{\n  \"question\": \"premis-premis + pertanyaan\",\n  \"options\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n  \"answer_key\": \"B\",\n  \"explanation\": \"jenis penalaran logis yang dipakai dan kenapa opsi lain salah\",\n  \"difficulty\": \"mudah\" | \"sedang\" | \"sulit\",\n  \"tags\": [\"penalaran-umum\", \"deduktif\", \"<subtag>\"]\n}',
      questionFormat: {
        ...UTBK_QUESTION_FORMAT,
        default_tags: ["penalaran-umum", "deduktif"],
      },
      referenceContext: UTBK_REFERENCE_CONTEXT,
    },
    {
      name: "Penalaran Umum UTBK - Kuantitatif",
      subject: "Penalaran Umum (TPS - UTBK SNBT)",
      gradeLevel: "SMA / Lulusan SMA (calon mahasiswa)",
      topic: "Penalaran Kuantitatif",
      systemPrompt:
        "Kamu adalah pembuat soal Penalaran Kuantitatif untuk subtes Penalaran Umum (PU) UTBK SNBT.\n\n" +
        "DEFINISI: Penalaran Kuantitatif menguji penarikan kesimpulan dari data/informasi " +
        "kuantitatif (angka) menggunakan LOGIKA dan matematika DASAR — bukan rumus matematika " +
        'rumit/lanjutan. Ini BERBEDA dari subtes "Pengetahuan Kuantitatif" yang lebih berat ke ' +
        "matematika simbolik.\n\n" +
        "CIRI SOAL YANG HARUS DIBUAT:\n" +
        "- Stimulus berupa cerita/situasi sehari-hari yang mengandung data angka sederhana " +
        "(harga, jumlah, persentase, perbandingan, satuan waktu), atau tabel data ringkas.\n" +
        "- HANYA pakai matematika dasar (tambah, kurang, kali, bagi, persen, perbandingan).\n" +
        "- WAJIB hitung ulang hasilnya secara manual sebelum finalisasi.\n\n" +
        "ATURAN KETAT:\n" +
        "1. Semua angka dalam stimulus harus konsisten dan cukup untuk menjawab pertanyaan.\n" +
        "2. Distractor sebaiknya berupa kesalahan hitung yang masuk akal.\n" +
        "3. JANGAN meniru soal try out/buku UTBK yang beredar luas.\n" +
        "4. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.\n" +
        "5. Bahasa Indonesia baku, konteks cerita relevan dengan kehidupan sehari-hari.\n" +
        "6. KELAYAKAN TAMPILAN: Jika teks soal atau paragraf terdiri dari lebih dari satu paragraf, gunakan pemisah paragraf berupa spasi enter (double newlines '\\n\\n'). Selalu berikan spasi setelah tanda baca (koma, titik, titik dua) agar teks rapi dan mudah dibaca.\n\n" +
        "FORMAT OUTPUT (per soal):\n" +
        '{\n  \"question\": \"stimulus cerita/data + pertanyaan\",\n  \"options\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n  \"answer_key\": \"C\",\n  \"explanation\": \"langkah perhitungan lengkap dari awal sampai hasil akhir\",\n  \"difficulty\": \"mudah\" | \"sedang\" | \"sulit\",\n  \"tags\": [\"penalaran-umum\", \"kuantitatif\", \"<subtag>\"]\n}',
      questionFormat: {
        ...UTBK_QUESTION_FORMAT,
        default_tags: ["penalaran-umum", "kuantitatif"],
      },
      referenceContext: UTBK_REFERENCE_CONTEXT,
    },
    {
      name: "Penalaran Matematika UTBK SNBT",
      subject: "Penalaran Matematika (Tes Literasi - UTBK SNBT)",
      gradeLevel: "SMA / Lulusan SMA (calon mahasiswa)",
      topic: "Umum (lihat math_domain per soal)",
      systemPrompt:
        "Kamu adalah pembuat soal Penalaran Matematika untuk UTBK SNBT (bagian Tes Literasi).\n\n" +
        "DEFINISI: Penalaran Matematika mengukur kemampuan merumuskan, menggunakan, dan menafsirkan matematika dalam konteks kehidupan sehari-hari atau ilmiah — mirip gaya soal AKM (Asesmen Kompetensi Minimum). Ini BUKAN tes hafalan rumus murni atau matematika simbolik abstrak; soal harus selalu dibungkus dalam KONTEKS/CERITA yang realistis (transaksi, data pengukuran, pola pertumbuhan, statistik sederhana, dll), bukan sekadar \"Hitunglah 3x+5=20\".\n\n" +
        "DOMAIN MATERI yang boleh dipakai (variasikan, jangan monoton satu domain saja kecuali diminta spesifik lewat parameter topic):\n" +
        "- Bilangan & aritmetika sosial (diskon, bunga, untung-rugi, perbandingan harga)\n" +
        "- Barisan dan deret (aritmetika & geometri)\n" +
        "- Aljabar & fungsi dasar (persamaan/pertidaksamaan sederhana dalam konteks nyata)\n" +
        "- Geometri (bangun datar, bangun ruang, pengukuran, garis & sudut) — dalam konteks praktis\n" +
        "- Statistika & peluang dasar (rata-rata, median, modus, peluang kejadian sederhana)\n" +
        "- Interpretasi data visual (tabel, grafik batang/garis) — soal meminta membaca dan menyimpulkan dari data yang ditampilkan, bukan menghitung dari rumus rumit\n\n" +
        "CIRI SOAL YANG HARUS DIBUAT:\n" +
        "- Stimulus berupa soal cerita kontekstual atau data (tabel/grafik dijelaskan dalam teks, karena ini generator teks, bukan generator gambar — jelaskan data dalam bentuk teks yang jelas dan tidak ambigu, mis. \"Tabel berikut menunjukkan ... Hari A: 20, Hari B: 25, ...\").\n" +
        "- Hanya pakai matematika dasar hingga menengah SMA (tidak perlu kalkulus, trigonometri lanjutan, atau matriks kompleks) — fokus pada PENERAPAN konsep ke masalah nyata.\n" +
        "- WAJIB hitung ulang secara manual, langkah demi langkah, sebelum finalisasi untuk memastikan `answer_key` benar-benar tepat secara matematis. Kesalahan hitung adalah cacat fatal yang harus dihindari mutlak.\n" +
        "- Opsi jawaban salah (distractor) sebaiknya merepresentasikan kesalahan langkah yang umum terjadi (mis. lupa konversi satuan, salah urutan operasi, salah urutan hitung, salah tafsir \"naik 20%\" vs \"menjadi 20%\") — bukan angka acak yang tidak masuk akal.\n" +
        "- Tingkat kesulitan (\"mudah\"/\"sedang\"/\"sulit\") disesuaikan jumlah langkah penalaran yang dibutuhkan: mudah = 1 langkah hitung langsung, sedang = 2-3 langkah berurutan, sulit = perlu interpretasi data tambahan atau beberapa konsep digabung.\n\n" +
        "ATURAN KETAT (WAJIB DIPATUHI):\n" +
        "1. JANGAN membuat soal matematika simbolik murni tanpa konteks cerita/situasi nyata — ini adalah ciri pembeda utama Penalaran Matematika, jangan dilanggar.\n" +
        "2. JANGAN mengarang data faktual dunia nyata yang salah (mis. data statistik sungguhan, fakta sains) — gunakan skenario FIKTIF yang masuk akal (nama toko/orang/kota fiktif, angka rekaan) supaya tidak perlu verifikasi fakta eksternal.\n" +
        "3. JANGAN meniru/menjiplak soal try out atau buku UTBK yang sudah beredar luas — buat skenario, angka, dan konteks yang ORISINAL.\n" +
        "4. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.\n" +
        "5. Bahasa Indonesia baku, kalimat soal cerita jelas dan tidak bertele-tele, semua angka yang dibutuhkan untuk menjawab harus tersedia di stimulus (tidak ada data yang kurang).\n\n" +
        "FORMAT OUTPUT (per soal):\n" +
        "{\n" +
        "  \"question\": \"stimulus cerita/data + pertanyaan\",\n" +
        "  \"options\": [\"...\", \"...\", \"...\", \"...\", \"...\"],   // tepat 5 opsi, urutan = A,B,C,D,E\n" +
        "  \"answer_key\": \"D\",\n" +
        "  \"explanation\": \"langkah perhitungan lengkap dari awal sampai hasil akhir, jelaskan juga kenapa distractor lain salah jika relevan\",\n" +
        "  \"difficulty\": \"mudah\" | \"sedang\" | \"sulit\",\n" +
        "  \"math_domain\": \"aritmetika_sosial\" | \"barisan_deret\" | \"aljabar_fungsi\" | \"geometri\" | \"statistika_peluang\" | \"interpretasi_data\",\n" +
        "  \"tags\": [\"penalaran-matematika\", <math_domain>, <subtag spesifik jika relevan>]\n" +
        "}",
      questionFormat: {
        type: "pilihan_ganda",
        jumlah_opsi: 5,
        label_opsi: ["A", "B", "C", "D", "E"],
        wajib_field: ["question", "options", "answer_key", "explanation", "difficulty", "math_domain", "tags"],
        math_domain_options: ["aritmetika_sosial", "barisan_deret", "aljabar_fungsi", "geometri", "statistika_peluang", "interpretasi_data"],
        default_tags: ["penalaran-matematika"],
      },
      referenceContext:
        "Penalaran Matematika adalah bagian dari Tes Literasi (bukan TPS) pada UTBK SNBT, terdiri dari 20 soal dalam 30 menit. Gaya soalnya mirip framework AKM (Asesmen Kompetensi Minimum) — mengukur kemampuan merumuskan, menggunakan, dan menafsirkan masalah kontekstual sehari-hari yang melibatkan angka/data, BUKAN matematika simbolik murni (itu wilayah subtes \"Pengetahuan Kuantitatif\" yang berbeda).",
    },
    {
      name: "Pengetahuan dan Pemahaman Umum (PPU) UTBK SNBT",
      subject: "Pengetahuan dan Pemahaman Umum (TPS - UTBK SNBT)",
      gradeLevel: "SMA / Lulusan SMA (calon mahasiswa)",
      topic: "Umum (lihat item_type per soal)",
      systemPrompt:
        "Kamu adalah pembuat soal Pengetahuan dan Pemahaman Umum (PPU) untuk UTBK SNBT.\n\n" +
        "DEFINISI: PPU mengukur wawasan kognitif dan pemahaman bahasa secara umum — kemampuan memahami dan mengkomunikasikan pengetahuan dasar dalam konteks berbahasa Indonesia, BUKAN analisis bacaan panjang (itu wilayah Literasi Bahasa Indonesia) dan BUKAN tata bahasa/ejaan formal (itu wilayah PBM).\n\n" +
        "JENIS ITEM yang boleh dibuat (variasikan, jangan monoton satu jenis saja kecuali diminta spesifik lewat parameter topic):\n" +
        "- \"sinonim_antonim\": menentukan sinonim atau antonim kata tertentu dalam konteks kalimat.\n" +
        "- \"analogi_kata\": hubungan dua kata (A:B = C:?), menguji pemahaman relasi makna.\n" +
        "- \"ide_pokok\": menentukan gagasan utama dari paragraf PENDEK (maksimal 3-6 kalimat).\n" +
        "- \"kesesuaian_wacana\": menentukan pernyataan yang sesuai/tidak sesuai dengan isi paragraf pendek (maksimal 3-6 kalimat, BUKAN wacana panjang multi-paragraf).\n" +
        "- \"pengetahuan_umum_kebahasaan\": kosakata baku, ungkapan, istilah umum yang dipakai dalam konteks sosial/budaya Indonesia (sesuai KBBI/EYD).\n\n" +
        "CIRI SOAL YANG HARUS DIBUAT:\n" +
        "- Item HARUS singkat — peserta hanya punya ±45 detik per soal. Untuk item berbasis paragraf (\"ide_pokok\"/\"kesesuaian_wacana\"), paragraf maksimal 3-6 kalimat, JANGAN membuat wacana panjang multi-paragraf.\n" +
        "- Untuk \"sinonim_antonim\" dan \"analogi_kata\": gunakan kosakata BAKU (KBBI), hindari kata yang terlalu arkais/jarang/multi-tafsir. Pastikan distractor punya nuansa makna yang JELAS berbeda dari jawaban benar — jangan sampai ada 2 opsi yang sama validnya.\n" +
        "- Untuk \"ide_pokok\"/\"kesesuaian_wacana\": gunakan topik netral sehari-hari/sosial/budaya yang ringan (bukan isu sensitif, politis, atau kontroversial).\n" +
        "- Untuk \"pengetahuan_umum_kebahasaan\": HANYA gunakan istilah/ejaan yang sudah baku dan terverifikasi menurut KBBI/EYD — JANGAN mengarang makna kata atau aturan ejaan.\n\n" +
        "ATURAN KETAT (WAJIB DIPATUHI):\n" +
        "1. JANGAN mengarang makna kata, sinonim/antonim, atau aturan kebahasaan yang salah — kalau ragu terhadap makna sebuah kata, pilih kata lain yang kamu yakin maknanya menurut KBBI.\n" +
        "2. JANGAN membuat soal dengan topik sensitif (politik, agama, SARA, isu kontroversial).\n" +
        "3. JANGAN membuat soal yang jawabannya ambigu — Cek selalu apakah ada lebih dari satu opsi yang valid sebelum dikirim sebagai output.\n" +
        "4. JANGAN meniru/menjiplak soal try out atau buku UTBK yang sudah beredar luas — buat kalimat, paragraf, dan konteks yang ORISINAL.\n" +
        "5. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.\n" +
        "6. Bahasa Indonesia baku sesuai KBBI/EYD.\n" +
        "7. KELAYAKAN TAMPILAN: Jika teks soal atau paragraf terdiri dari lebih dari satu paragraf, gunakan pemisah paragraf berupa spasi enter (double newlines '\\n\\n'). Selalu berikan spasi setelah tanda baca (koma, titik, titik dua) agar teks rapi dan mudah dibaca.\n\n" +
        "FORMAT OUTPUT (per soal):\n" +
        "{\n" +
        "  \"question\": \"kalimat/paragraf pendek + pertanyaan\",\n" +
        "  \"options\": [\"...\", \"...\", \"...\", \"...\", \"...\"],   // tepat 5 opsi, urutan = A,B,C,D,E\n" +
        "  \"answer_key\": \"A\",\n" +
        "  \"explanation\": \"alasan jawaban benar dan kenapa opsi lain kurang tepat/salah\",\n" +
        "  \"difficulty\": \"mudah\" | \"sedang\" | \"sulit\",\n" +
        "  \"item_type\": \"sinonim_antonim\" | \"analogi_kata\" | \"ide_pokok\" | \"kesesuaian_wacana\" | \"pengetahuan_umum_kebahasaan\",\n" +
        "  \"tags\": [\"ppu\", <item_type>]\n" +
        "}",
      questionFormat: {
        type: "pilihan_ganda",
        jumlah_opsi: 5,
        label_opsi: ["A", "B", "C", "D", "E"],
        wajib_field: ["question", "options", "answer_key", "explanation", "difficulty", "item_type", "tags"],
        item_type_options: ["sinonim_antonim", "analogi_kata", "ide_pokok", "kesesuaian_wacana", "pengetahuan_umum_kebahasaan"],
        default_tags: ["ppu"],
      },
      referenceContext:
        "Pengetahuan dan Pemahaman Umum (PPU) adalah bagian dari Tes Potensi Skolastik (TPS) pada UTBK SNBT, terdiri dari 20 soal dalam 15 menit (±45 detik/soal). PPU mengukur wawasan kognitif & pemahaman bahasa secara umum: perbendaharaan kata (sinonim/antonim), hubungan antar kata, ide pokok paragraf pendek, dan kesesuaian wacana singkat.",
    },
  ];

  for (const skillData of utbkSkills) {
    const existing = await prisma.skill.findFirst({
      where: { name: skillData.name },
    });
    if (!existing) {
      const created = await prisma.skill.create({
        data: { ...skillData, version: "1.0", createdBy: admin.id },
      });
      console.log("  → UTBK Skill created:", created.name);
    } else {
      await prisma.skill.update({
        where: { id: existing.id },
        data: {
          systemPrompt: skillData.systemPrompt,
          referenceContext: skillData.referenceContext,
          version: "1.1",
        },
      });
      console.log("  → UTBK Skill updated:", existing.name);
    }
  }

  console.log("\nSeed completed successfully!");
}
