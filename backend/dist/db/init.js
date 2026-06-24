"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const index_1 = __importDefault(require("./index"));
const seed_1 = require("./seed");
async function initDatabase() {
    console.log("[DB Init] Menjalankan migrasi database otomatis...");
    try {
        // Menjalankan prisma migrate deploy menggunakan path absolut ke file build/index.js prisma
        // dan process.execPath (path ke file binary node yang sedang berjalan).
        // Cara ini menghindari error 'npx: command not found' di Hostinger.
        const prismaCliPath = path_1.default.resolve(process.cwd(), "node_modules/prisma/build/index.js");
        (0, child_process_1.execSync)(`"${process.execPath}" "${prismaCliPath}" migrate deploy`, {
            stdio: "inherit",
            env: { ...process.env, UV_THREADPOOL_SIZE: "1" }
        });
        console.log("[DB Init] Migrasi database berhasil diselesaikan.");
    }
    catch (err) {
        console.error("[DB Init] Gagal menjalankan migrasi database:", err);
        // Kita tetap melanjutkan startup agar aplikasi tidak mati total jika ada masalah koneksi sementara
    }
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
        console.error("[DB Init] Gagal menjalankan seeding database:", err);
    }
}
//# sourceMappingURL=init.js.map