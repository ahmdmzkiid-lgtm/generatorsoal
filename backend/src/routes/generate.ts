import { Router, type Request, type Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { processGenerationJob } from "../jobs/generateQuestions";
import { authenticate, authorize } from "../middleware/auth";
import { logAudit } from "../services/auditLog";

const router = Router();

const startJobSchema = z.object({
  skillId: z.string().uuid("skillId harus UUID valid"),
  count: z.number().int().min(1).max(50),
  prompt: z.string().optional(),
  images: z
    .array(
      z.object({
        data: z.string(),
        mimeType: z.string(),
      })
    )
    .optional(),
});

// POST /api/generate
router.post("/", authenticate, authorize("ADMIN", "OPERATOR_GENERATE"), async (req: Request, res: Response) => {
  try {
    const body = startJobSchema.parse(req.body);

    // Verify skill exists and is active
    const skill = await prisma.skill.findUnique({
      where: { id: body.skillId },
    });
    if (!skill) {
      res.status(404).json({ error: "Skill tidak ditemukan" });
      return;
    }
    if (!skill.isActive) {
      res.status(400).json({ error: "Skill tidak aktif" });
      return;
    }

    // Create job record
    const job = await prisma.generationJob.create({
      data: {
        skillId: body.skillId,
        requestedCount: body.count,
        status: "PENDING",
        createdBy: req.user!.userId,
      },
    });

    logAudit({ actorId: req.user!.userId, action: "GENERATE_QUESTIONS", targetId: job.id, metadata: { skillId: body.skillId, count: body.count } }).catch(() => {});

    // Return job ID immediately
    res.status(201).json({ jobId: job.id });

    // Fire-and-forget: process in background (not awaited)
    processGenerationJob(job.id, body.prompt, body.images).catch((err) => {
      console.error(`Unhandled error in job ${job.id}:`, err);
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validasi gagal", details: err.errors });
      return;
    }
    console.error("Error starting generation job:", err);
    res.status(500).json({ error: "Gagal memulai generate" });
  }
});

// GET /api/generate/:jobId/status
router.get("/:jobId/status", async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        questions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!job) {
      res.status(404).json({ error: "Job tidak ditemukan" });
      return;
    }

    res.json(job);
  } catch (err) {
    console.error("Error fetching job status:", err);
    res.status(500).json({ error: "Gagal mengambil status job" });
  }
});

export default router;
