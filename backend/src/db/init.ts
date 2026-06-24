import { execSync } from "child_process";
import prisma from "./index";
import { seedDatabase } from "./seed";

export async function initDatabase() {
  console.log("[DB Init] Menjalankan migrasi database otomatis...");
  try {
    // Menjalankan 'npx prisma migrate deploy'
    // Menggunakan npx agar kompatibel baik di Windows (pengembangan lokal) maupun Linux (Hostinger)
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("[DB Init] Migrasi database berhasil diselesaikan.");
  } catch (err) {
    console.error("[DB Init] Gagal menjalankan migrasi database:", err);
    // Kita tetap melanjutkan startup agar aplikasi tidak mati total jika ada masalah koneksi sementara
  }

  try {
    console.log("[DB Init] Memeriksa apakah database memerlukan seeding...");
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("[DB Init] Database kosong. Menjalankan seeding...");
      await seedDatabase();
      console.log("[DB Init] Seeding database berhasil diselesaikan.");
    } else {
      console.log("[DB Init] Database sudah terisi data. Seeding dilewati.");
    }
  } catch (err) {
    console.error("[DB Init] Gagal menjalankan seeding database:", err);
  }
}
