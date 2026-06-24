process.env.UV_THREADPOOL_SIZE = "1";
import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import skillRoutes from "./routes/skills";
import generateRoutes from "./routes/generate";
import questionRoutes from "./routes/questions";
import exportRoutes from "./routes/export";
import authRoutes from "./routes/auth";
import { initDatabase } from "./db/init";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ["https://generator.stubia.id", "https://gen.stubia.id", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));

// Serve exported files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/export", exportRoutes);

// Initialize database then start server
initDatabase()
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
