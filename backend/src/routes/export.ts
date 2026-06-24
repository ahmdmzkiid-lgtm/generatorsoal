import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import prisma from "../db";
import { generateXlsx, type ColumnMapping } from "../services/exportService";
import { verifyToken } from "../services/auth";
import { authenticate, authorize } from "../middleware/auth";
import { logAudit } from "../services/auditLog";

const router = Router();

const EXPORTS_DIR = path.join(__dirname, "../../uploads/exports");

// All export routes require admin
router.use(authenticate);
router.use(authorize("ADMIN"));

// POST /api/export/templates — create template
router.post("/templates", async (req: Request, res: Response) => {
  try {
    const { name, columnMapping } = req.body as {
      name: string;
      columnMapping: ColumnMapping[];
    };

    if (!name || !Array.isArray(columnMapping) || columnMapping.length === 0) {
      res.status(400).json({ error: "name dan columnMapping (array) diperlukan" });
      return;
    }

    const template = await prisma.exportTemplate.create({
      data: { name, columnMapping: columnMapping as object, createdBy: req.user!.userId },
    });

    logAudit({ actorId: req.user!.userId, action: "CREATE_TEMPLATE", targetId: template.id, metadata: { name } }).catch(() => {});

    res.json(template);
  } catch (err) {
    console.error("Error creating template:", err);
    res.status(500).json({ error: "Gagal membuat template" });
  }
});

// GET /api/export/templates — list templates
router.get("/templates", async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.exportTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(templates);
  } catch (err) {
    console.error("Error fetching templates:", err);
    res.status(500).json({ error: "Gagal mengambil template" });
  }
});

// PUT /api/export/templates/:id — update template
router.put("/templates/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, columnMapping } = req.body as {
      name?: string;
      columnMapping?: ColumnMapping[];
    };

    const existing = await prisma.exportTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template tidak ditemukan" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (columnMapping !== undefined) data.columnMapping = columnMapping as object;

    const updated = await prisma.exportTemplate.update({
      where: { id },
      data: data as never,
    });

    res.json(updated);
  } catch (err) {
    console.error("Error updating template:", err);
    res.status(500).json({ error: "Gagal mengupdate template" });
  }
});

// DELETE /api/export/templates/:id — delete template
router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.exportTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template tidak ditemukan" });
      return;
    }

    await prisma.exportTemplate.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting template:", err);
    res.status(500).json({ error: "Gagal menghapus template" });
  }
});

// POST /api/export — start export job (async)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { templateId, questionIds } = req.body as {
      templateId: string;
      questionIds: string[];
    };

    if (!templateId || !Array.isArray(questionIds) || questionIds.length === 0) {
      res.status(400).json({ error: "templateId dan questionIds diperlukan" });
      return;
    }

    const template = await prisma.exportTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      res.status(404).json({ error: "Template tidak ditemukan" });
      return;
    }

    const log = await prisma.exportLog.create({
      data: {
        templateId,
        questionIds,
        filePath: "__PROCESSING__",
        createdBy: req.user!.userId,
      },
    });

    logAudit({ actorId: req.user!.userId, action: "EXPORT_QUESTIONS", targetId: log.id, metadata: { templateId, questionCount: questionIds.length } }).catch(() => {});

    processExport(log.id, template.columnMapping as unknown as ColumnMapping[], questionIds).catch((err) => {
      console.error(`Export ${log.id} failed:`, err);
    });

    res.json({ logId: log.id, status: "PROCESSING" });
  } catch (err) {
    console.error("Error starting export:", err);
    res.status(500).json({ error: "Gagal memulai export" });
  }
});

// GET /api/export/exported-ids — all question IDs that have ever been exported
router.get("/exported-ids", async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.exportLog.findMany({
      select: { questionIds: true },
      where: { filePath: { not: "__PROCESSING__" } },
    });
    const allIds = [...new Set(logs.flatMap((l) => l.questionIds))];
    res.json({ exportedIds: allIds });
  } catch (err) {
    console.error("Error fetching exported IDs:", err);
    res.status(500).json({ error: "Gagal mengambil data export" });
  }
});

// GET /api/export/:logId/status — poll export status
router.get("/:logId/status", async (req: Request, res: Response) => {
  try {
    const log = await prisma.exportLog.findUnique({
      where: { id: req.params.logId as string },
    });

    if (!log) {
      res.status(404).json({ error: "Export tidak ditemukan" });
      return;
    }

    if (log.filePath === "__PROCESSING__") {
      res.json({ status: "PROCESSING" });
      return;
    }

    if (log.filePath?.startsWith("ERROR:")) {
      res.json({ status: "FAILED", error: log.filePath.slice(6) });
      return;
    }

    res.json({
      status: "COMPLETED",
      downloadUrl: `/api/export/download/${log.id}`,
    });
  } catch (err) {
    console.error("Error checking export status:", err);
    res.status(500).json({ error: "Gagal mengecek status" });
  }
});

// GET /api/export/download/:logId — download xlsx file
// Auth via Bearer header OR query param `token` (for direct links / <a> tags)
router.get("/download/:logId", async (req: Request, res: Response) => {
  try {
    // Check for token in query param as fallback
    const queryToken = req.query.token as string | undefined;
    if (queryToken) {
      try {
        const payload = verifyToken(queryToken);
        req.user = payload;
      } catch {
        res.status(401).json({ error: "Unauthorized: invalid token" });
        return;
      }
    } else {
      // Fall back to standard Bearer header auth
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: no token provided" });
        return;
      }
      try {
        const payload = verifyToken(header.slice(7));
        req.user = payload;
      } catch {
        res.status(401).json({ error: "Unauthorized: invalid token" });
        return;
      }
    }

    const log = await prisma.exportLog.findUnique({
      where: { id: req.params.logId as string },
    });

    if (!log) {
      res.status(404).json({ error: "Export tidak ditemukan" });
      return;
    }

    if (log.filePath === "__PROCESSING__") {
      res.status(400).json({ error: "Export masih diproses" });
      return;
    }

    if (log.filePath?.startsWith("ERROR:")) {
      res.status(400).json({ error: "Export gagal" });
      return;
    }

    const fullPath = log.filePath;
    if (!fullPath || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: "File tidak ditemukan" });
      return;
    }

    res.download(fullPath, `soal_${Date.now()}.xlsx`);
  } catch (err) {
    console.error("Error downloading export:", err);
    res.status(500).json({ error: "Gagal mengunduh file" });
  }
});

async function processExport(
  logId: string,
  mappings: ColumnMapping[],
  questionIds: string[]
): Promise<void> {
  try {
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: {
        skill: { select: { name: true, subject: true, gradeLevel: true } },
      },
    });

    const rows = questions.map((q) => ({
      questionText: q.questionText,
      content: q.content as Record<string, unknown>,
      difficulty: q.difficulty,
      tags: q.tags,
      skill: q.skill,
    }));

    const filename = `exports_${logId.slice(0, 8)}_${Date.now()}.xlsx`;
    const outputPath = path.join(EXPORTS_DIR, filename);

    await generateXlsx(rows, mappings, outputPath);

    await prisma.exportLog.update({
      where: { id: logId },
      data: { filePath: outputPath },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.exportLog.update({
      where: { id: logId },
      data: { filePath: `ERROR:${message}` },
    });
  }
}

export default router;
