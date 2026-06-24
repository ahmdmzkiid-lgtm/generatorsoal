import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import skillRoutes from "./routes/skills";
import generateRoutes from "./routes/generate";
import questionRoutes from "./routes/questions";
import exportRoutes from "./routes/export";
import authRoutes from "./routes/auth";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
