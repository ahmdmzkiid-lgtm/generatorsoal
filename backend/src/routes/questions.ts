import { Router, type Request, type Response } from "express";
import prisma from "../db";
import { authenticate, authorize } from "../middleware/auth";
import { logAudit } from "../services/auditLog";
import { scanDuplicates } from "../services/duplicateScanner";

const router = Router();

// GET /api/questions/published — list PUBLISHED questions with filters & pagination
router.get("/published", async (req: Request, res: Response) => {
  try {
    const subject = req.query.subject as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    const topic = req.query.topic as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const where: Record<string, unknown> = { status: "PUBLISHED" };

    if (difficulty) where.difficulty = difficulty;

    if (subject) {
      where.skill = { subject };
    }

    if (topic) {
      where.tags = { has: topic };
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    if (search) {
      where.questionText = { contains: search, mode: "insensitive" };
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          skill: { select: { id: true, name: true, subject: true, gradeLevel: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.question.count({ where }),
    ]);

    res.json({ questions, total });
  } catch (err) {
    console.error("Error fetching published questions:", err);
    res.status(500).json({ error: "Gagal mengambil data soal" });
  }
});

// GET /api/questions — list questions with optional filters (multi-status, subject, difficulty, date)
router.get("/", async (req: Request, res: Response) => {
  try {
    const skillId = req.query.skillId as string | undefined;
    const status = req.query.status as string | undefined;
    const subject = req.query.subject as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const where: Record<string, unknown> = {};

    if (skillId) where.skillId = skillId;

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (subject) {
      where.skill = { subject };
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          skill: { select: { id: true, name: true, subject: true, gradeLevel: true } },
          aiReviewLogs: { orderBy: { createdAt: "desc" }, take: 1 },
          duplicateScanLogs: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.question.count({ where }),
    ]);

    res.json({ questions, total });
  } catch (err) {
    console.error("Error fetching questions:", err);
    res.status(500).json({ error: "Gagal mengambil data soal" });
  }
});

// GET /api/questions/:id/ai-review — review history for a question
router.get("/:id/ai-review", async (req: Request, res: Response) => {
  try {
    const questionId = req.params.id as string;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        status: true,
        content: true,
        questionText: true,
        difficulty: true,
        createdAt: true,
        aiReviewLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!question) {
      res.status(404).json({ error: "Soal tidak ditemukan" });
      return;
    }

    res.json(question);
  } catch (err) {
    console.error("Error fetching question review:", err);
    res.status(500).json({ error: "Gagal mengambil data review" });
  }
});

// GET /api/questions/:id/duplicates — similar questions with similarity scores
router.get("/:id/duplicates", async (req: Request, res: Response) => {
  try {
    const questionId = req.params.id as string;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, questionText: true, status: true },
    });

    if (!question) {
      res.status(404).json({ error: "Soal tidak ditemukan" });
      return;
    }

    const logs = await prisma.duplicateScanLog.findMany({
      where: { questionId },
      include: { similarQuestion: true },
      orderBy: { createdAt: "desc" },
    });

    const duplicates = logs.map((log) => {
      const sq = log.similarQuestion as {
        id: string;
        questionText: string;
        content: unknown;
        status: string;
        difficulty: string;
        skill?: { id: string; name: string; subject: string };
      };
      return {
        id: sq.id,
        questionText: sq.questionText,
        content: sq.content,
        status: sq.status,
        difficulty: sq.difficulty,
        similarityScore: Number(log.similarityScore),
        scannedAt: log.createdAt,
      };
    });

    res.json({ question, duplicates });
  } catch (err) {
    console.error("Error fetching duplicates:", err);
    res.status(500).json({ error: "Gagal mengambil data duplikat" });
  }
});

// POST /api/questions/:id/review — human review decision (APPROVE|REJECT|EDIT_APPROVE)
router.post("/:id/review", authenticate, authorize("ADMIN", "REVIEWER"), async (req: Request, res: Response) => {
  try {
    const questionId = req.params.id as string;
    const { decision, reason, editedContent } = req.body as {
      decision: "APPROVE" | "REJECT" | "EDIT_APPROVE";
      reason?: string;
      editedContent?: {
        questionText?: string;
        content?: Record<string, unknown>;
        difficulty?: string;
        tags?: string[];
      };
    };

    if (!["APPROVE", "REJECT", "EDIT_APPROVE"].includes(decision)) {
      res.status(400).json({ error: "Decision must be APPROVE, REJECT, or EDIT_APPROVE" });
      return;
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      res.status(404).json({ error: "Soal tidak ditemukan" });
      return;
    }



    let targetStatus: "PASSED_AI_REVIEW" | "UNPUBLISHED" | "REJECTED";

    if (decision === "APPROVE" || decision === "EDIT_APPROVE") {
      if (question.status === "FLAGGED_BY_AI") {
        targetStatus = "PASSED_AI_REVIEW";
      } else {
        targetStatus = "UNPUBLISHED";
      }
      if (decision === "EDIT_APPROVE" && editedContent) {
        const updateData: Record<string, unknown> = {};
        if (editedContent.questionText !== undefined) updateData.questionText = editedContent.questionText;
        if (editedContent.content !== undefined) updateData.content = editedContent.content as object;
        if (editedContent.difficulty !== undefined) updateData.difficulty = editedContent.difficulty;
        if (editedContent.tags !== undefined) updateData.tags = editedContent.tags;
        await prisma.question.update({
          where: { id: questionId },
          data: updateData as never,
        });
      }
    } else {
      targetStatus = "REJECTED";
    }

    const [updated] = await Promise.all([
      prisma.question.update({
        where: { id: questionId },
        data: { status: targetStatus },
      }),
      prisma.humanReviewLog.create({
        data: {
          questionId,
          reviewerId: req.user!.userId,
          decision,
          reason: reason || null,
        },
      }),
    ]);

    if (targetStatus === "PASSED_AI_REVIEW") {
      try {
        await scanDuplicates(questionId);
      } catch (scanErr) {
        console.error(`Duplicate scan failed for question ${questionId}:`, scanErr);
      }
    }

    logAudit({ actorId: req.user!.userId, action: "HUMAN_REVIEW", targetId: questionId, metadata: { decision, reason: reason || null } }).catch(() => {});

    res.json(updated);
  } catch (err) {
    console.error("Error reviewing question:", err);
    res.status(500).json({ error: "Gagal menyimpan review" });
  }
});

// POST /api/questions/batch-review — batch human review decision (APPROVE | REJECT)
router.post("/batch-review", authenticate, authorize("ADMIN", "REVIEWER"), async (req: Request, res: Response) => {
  try {
    const { ids, decision, reason } = req.body as {
      ids: string[];
      decision: "APPROVE" | "REJECT" | "EDIT_APPROVE";
      reason?: string;
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }

    if (!["APPROVE", "REJECT"].includes(decision)) {
      res.status(400).json({ error: "Batch review only supports APPROVE or REJECT decision" });
      return;
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
    });

    const foundIds = new Set(questions.map((q) => q.id));
    const notFound = ids.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) {
      res.status(404).json({ error: `Soal tidak ditemukan: ${notFound.join(", ")}` });
      return;
    }

    await prisma.$transaction(
      questions.map((q) => {
        let tStatus: "PASSED_AI_REVIEW" | "UNPUBLISHED" | "REJECTED";
        if (decision === "APPROVE") {
          tStatus = q.status === "FLAGGED_BY_AI" ? "PASSED_AI_REVIEW" : "UNPUBLISHED";
        } else {
          tStatus = "REJECTED";
        }
        return prisma.question.update({
          where: { id: q.id },
          data: { status: tStatus },
        });
      }),
    );

    await prisma.humanReviewLog.createMany({
      data: questions.map((q) => ({
        questionId: q.id,
        reviewerId: req.user!.userId,
        decision,
        reason: reason || null,
      })),
    });

    for (const q of questions) {
      if (decision === "APPROVE" && q.status === "FLAGGED_BY_AI") {
        scanDuplicates(q.id).catch((err) => {
          console.error(`Duplicate scan failed in batch-review for question ${q.id}:`, err);
        });
      }
      logAudit({ actorId: req.user!.userId, action: "HUMAN_REVIEW", targetId: q.id, metadata: { decision, reason: reason || null } }).catch(() => {});
    }

    res.json({ success: true, count: questions.length });
  } catch (err) {
    console.error("Error batch reviewing questions:", err);
    res.status(500).json({ error: "Gagal menyimpan review batch" });
  }
});

// GET /api/questions/unpublished — list UNPUBLISHED questions with filters & pagination
router.get("/unpublished", async (req: Request, res: Response) => {
  try {
    const subject = req.query.subject as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    const topic = req.query.topic as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const where: Record<string, unknown> = { status: "UNPUBLISHED" };

    if (difficulty) where.difficulty = difficulty;

    if (subject) {
      where.skill = { subject };
    }

    if (topic) {
      where.tags = { has: topic };
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    if (search) {
      where.questionText = { contains: search, mode: "insensitive" };
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          skill: { select: { id: true, name: true, subject: true, gradeLevel: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.question.count({ where }),
    ]);

    res.json({ questions, total });
  } catch (err) {
    console.error("Error fetching unpublished questions:", err);
    res.status(500).json({ error: "Gagal mengambil data soal" });
  }
});

// POST /api/questions/batch-publish — move UNPUBLISHED questions to PUBLISHED
router.post("/batch-publish", authenticate, authorize("ADMIN", "REVIEWER"), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: ids }, status: "UNPUBLISHED" },
    });

    if (questions.length === 0) {
      res.status(404).json({ error: "Tidak ada soal UNPUBLISHED yang ditemukan" });
      return;
    }

    await prisma.$transaction(
      questions.map((q) =>
        prisma.question.update({
          where: { id: q.id },
          data: { status: "PUBLISHED" },
        }),
      ),
    );

    for (const q of questions) {
      logAudit({ actorId: req.user!.userId, action: "PUBLISH_QUESTION", targetId: q.id, metadata: {} }).catch(() => {});
    }

    res.json({ success: true, count: questions.length });
  } catch (err) {
    console.error("Error batch publishing questions:", err);
    res.status(500).json({ error: "Gagal mempublish soal" });
  }
});

// POST /api/questions/batch-delete — permanently delete multiple questions
router.post("/batch-delete", authenticate, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
    });

    if (questions.length === 0) {
      res.status(404).json({ error: "Tidak ada soal yang ditemukan untuk dihapus" });
      return;
    }

    // Delete related records first (foreign key constraints)
    await prisma.$transaction([
      prisma.aiReviewLog.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.humanReviewLog.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.duplicateScanLog.deleteMany({
        where: { OR: [{ questionId: { in: ids } }, { similarQuestionId: { in: ids } }] },
      }),
      prisma.question.deleteMany({ where: { id: { in: ids } } }),
    ]);

    for (const id of ids) {
      logAudit({ actorId: req.user!.userId, action: "DELETE_QUESTION", targetId: id, metadata: {} }).catch(() => {});
    }

    res.json({ success: true, count: questions.length });
  } catch (err) {
    console.error("Error batch deleting questions:", err);
    res.status(500).json({ error: "Gagal menghapus soal" });
  }
});

// DELETE /api/questions/:id - permanently delete a question
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const questionId = req.params.id as string;

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      res.status(404).json({ error: "Soal tidak ditemukan" });
      return;
    }

    // Delete related records first (foreign key constraints)
    await prisma.$transaction([
      prisma.aiReviewLog.deleteMany({ where: { questionId } }),
      prisma.humanReviewLog.deleteMany({ where: { questionId } }),
      prisma.duplicateScanLog.deleteMany({
        where: { OR: [{ questionId }, { similarQuestionId: questionId }] },
      }),
      prisma.question.delete({ where: { id: questionId } }),
    ]);

    logAudit({ actorId: req.user!.userId, action: "DELETE_QUESTION", targetId: questionId, metadata: {} }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting question:", err);
    res.status(500).json({ error: "Gagal menghapus soal" });
  }
});

export default router;

