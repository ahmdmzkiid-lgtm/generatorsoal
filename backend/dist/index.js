"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.UV_THREADPOOL_SIZE = "1";
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const skills_1 = __importDefault(require("./routes/skills"));
const generate_1 = __importDefault(require("./routes/generate"));
const questions_1 = __importDefault(require("./routes/questions"));
const export_1 = __importDefault(require("./routes/export"));
const auth_1 = __importDefault(require("./routes/auth"));
const init_1 = require("./db/init");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({
    origin: ["https://generator.stubia.id", "https://gen.stubia.id", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json({ limit: "10mb" }));
// Serve exported files
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/api/auth", auth_1.default);
app.use("/api/skills", skills_1.default);
app.use("/api/generate", generate_1.default);
app.use("/api/questions", questions_1.default);
app.use("/api/export", export_1.default);
// Initialize database then start server
(0, init_1.initDatabase)()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error("Critical error during database initialization:", err);
    // Start listening anyway so the process doesn't hang/crash Hostinger's proxy
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT} (Setup failed)`);
    });
});
//# sourceMappingURL=index.js.map