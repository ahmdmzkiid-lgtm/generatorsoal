import prisma from "./index";
import { seedDatabase } from "./seed";

export async function initDatabase() {
  // Kita menghapus pemanggilan 'execSync' (child process) di sini untuk menghindari error EAGAIN (limit proses/thread) di Hostinger.
  // Migrasi database (Prisma migrate) harus dijalankan dari komputer lokal Anda yang terhubung ke database cloud Neon.
  
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
    // Menangkap error jika tabel belum dimigrasikan, agar server tidak crash
    console.error("[DB Init] Gagal memeriksa/menjalankan seeding database. Pastikan migrasi database sudah dijalankan secara lokal:", err);
  }
}
