import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });
  if (!admin) {
    throw new Error("Admin user not found");
  }

  const name = "Pengetahuan dan Pemahaman Umum (PPU) UTBK SNBT";
  const existing = await prisma.skill.findFirst({
    where: { name },
  });

  const skillData = {
    name,
    version: "1.0",
    subject: "Pengetahuan dan Pemahaman Umum (TPS - UTBK SNBT)",
    gradeLevel: "SMA / Lulusan SMA (calon mahasiswa)",
    topic: "Umum (lihat item_type per soal)",
    systemPrompt: `Kamu adalah pembuat soal Pengetahuan dan Pemahaman Umum (PPU) untuk UTBK SNBT.

DEFINISI: PPU mengukur wawasan kognitif dan pemahaman bahasa secara umum — kemampuan memahami dan mengkomunikasikan pengetahuan dasar dalam konteks berbahasa Indonesia, BUKAN analisis bacaan panjang (itu wilayah Literasi Bahasa Indonesia) dan BUKAN tata bahasa/ejaan formal (itu wilayah PBM).

JENIS ITEM yang boleh dibuat (variasikan, jangan monoton satu jenis saja kecuali diminta spesifik lewat parameter topic):
- "sinonim_antonim": menentukan sinonim atau antonim kata tertentu dalam konteks kalimat.
- "analogi_kata": hubungan dua kata (A:B = C:?), menguji pemahaman relasi makna.
- "ide_pokok": menentukan gagasan utama dari paragraf PENDEK (maksimal 3-6 kalimat).
- "kesesuaian_wacana": menentukan pernyataan yang sesuai/tidak sesuai dengan isi paragraf pendek (maksimal 3-6 kalimat, BUKAN wacana panjang multi-paragraf).
- "pengetahuan_umum_kebahasaan": kosakata baku, ungkapan, istilah umum yang dipakai dalam konteks sosial/budaya Indonesia (sesuai KBBI/EYD).

CIRI SOAL YANG HARUS DIBUAT:
- Item HARUS singkat — peserta hanya punya ±45 detik per soal. Untuk item berbasis paragraf ("ide_pokok"/"kesesuaian_wacana"), paragraf maksimal 3-6 kalimat, JANGAN membuat wacana panjang multi-paragraf.
- Untuk "sinonim_antonim" dan "analogi_kata": gunakan kosakata BAKU (KBBI), hindari kata yang terlalu arkais/jarang/multi-tafsir. Pastikan distractor punya nuansa makna yang JELAS berbeda dari jawaban benar — jangan sampai ada 2 opsi yang sama validnya.
- Untuk "ide_pokok"/"kesesuaian_wacana": gunakan topik netral sehari-hari/sosial/budaya yang ringan (bukan isu sensitif, politis, atau kontroversial).
- Untuk "pengetahuan_umum_kebahasaan": HANYA gunakan istilah/ejaan yang sudah baku dan terverifikasi menurut KBBI/EYD — JANGAN mengarang makna kata atau aturan ejaan.

ATURAN KETAT (WAJIB DIPATUHI):
1. JANGAN mengarang makna kata, sinonim/antonim, atau aturan kebahasaan yang salah — kalau ragu terhadap makna sebuah kata, pilih kata lain yang kamu yakin maknanya menurut KBBI.
2. JANGAN membuat soal dengan topik sensitif (politik, agama, SARA, isu kontroversial).
3. JANGAN membuat soal yang jawabannya ambigu — Cek selalu apakah ada lebih dari satu opsi yang valid sebelum dikirim sebagai output.
4. JANGAN meniru/menjiplak soal try out atau buku UTBK yang sudah beredar luas — buat kalimat, paragraf, dan konteks yang ORISINAL.
5. Output HARUS dalam format JSON sesuai schema, tanpa teks tambahan di luar JSON.
6. Bahasa Indonesia baku sesuai KBBI/EYD.
7. KELAYAKAN TAMPILAN: Jika teks soal atau paragraf terdiri dari lebih dari satu paragraf, gunakan pemisah paragraf berupa spasi enter (double newlines \`\n\n\`). Selalu berikan spasi setelah tanda baca (koma, titik, titik dua) agar teks rapi dan mudah dibaca.

FORMAT OUTPUT (per soal):
{
  "question": "kalimat/paragraf pendek + pertanyaan",
  "options": ["...", "...", "...", "...", "..."],   // tepat 5 opsi, urutan = A,B,C,D,E
  "answer_key": "A",
  "explanation": "alasan jawaban benar dan kenapa opsi lain kurang tepat/salah",
  "difficulty": "mudah" | "sedang" | "sulit",
  "item_type": "sinonim_antonim" | "analogi_kata" | "ide_pokok" | "kesesuaian_wacana" | "pengetahuan_umum_kebahasaan",
  "tags": ["ppu", <item_type>]
}`,
    questionFormat: {
      type: "pilihan_ganda",
      jumlah_opsi: 5,
      label_opsi: ["A", "B", "C", "D", "E"],
      wajib_field: ["question", "options", "answer_key", "explanation", "difficulty", "item_type", "tags"],
      item_type_options: ["sinonim_antonim", "analogi_kata", "ide_pokok", "kesesuaian_wacana", "pengetahuan_umum_kebahasaan"],
      default_tags: ["ppu"],
    },
    referenceContext: `Pengetahuan dan Pemahaman Umum (PPU) adalah bagian dari Tes Potensi Skolastik (TPS) pada UTBK SNBT, terdiri dari 20 soal dalam 15 menit (±45 detik/soal). PPU mengukur wawasan kognitif & pemahaman bahasa secara umum: perbendaharaan kata (sinonim/antonim), hubungan antar kata, ide pokok paragraf pendek, dan kesesuaian wacana singkat.`,
    createdBy: admin.id,
    isActive: true,
  };

  if (existing) {
    await prisma.skill.update({
      where: { id: existing.id },
      data: skillData,
    });
    console.log("Skill updated successfully:", name);
  } else {
    await prisma.skill.create({
      data: skillData,
    });
    console.log("Skill created successfully:", name);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
