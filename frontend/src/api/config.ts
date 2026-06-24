// Diisi saat build production: VITE_API_BASE=https://gen.stubia.id npm run build
// Default kosong (pakai proxy / relative path)
export const API_BASE = import.meta.env.VITE_API_BASE || "";
