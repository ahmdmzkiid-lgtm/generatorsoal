"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const index_1 = __importDefault(require("./index"));
const seed_1 = require("./seed");
async function initDatabase() {
    // Kita menghapus pemanggilan 'execSync' (child process) di sini untuk menghindari error EAGAIN (limit proses/thread) di Hostinger.
    // Migrasi database (Prisma migrate) harus dijalankan dari komputer lokal Anda yang terhubung ke database cloud Neon.
    try {
        console.log("[DB Init] Memeriksa apakah database memerlukan seeding...");
        const userCount = await index_1.default.user.count();
        if (userCount === 0) {
            console.log("[DB Init] Database kosong. Menjalankan seeding...");
            await (0, seed_1.seedDatabase)();
            console.log("[DB Init] Seeding database berhasil diselesaikan.");
        }
        else {
            console.log("[DB Init] Database sudah terisi data. Seeding dilewati.");
        }
    }
    catch (err) {
        // Menangkap error jika tabel belum dimigrasikan, agar server tidak crash
        console.error("[DB Init] Gagal memeriksa/menjalankan seeding database. Pastikan migrasi database sudah dijalankan secara lokal:", err);
    }
}
//# sourceMappingURL=init.js.map