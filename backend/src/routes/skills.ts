import { Router, type Request, type Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { authenticate, authorize } from "../middleware/auth";
import { logAudit } from "../services/auditLog";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Validation schemas ──

const createSkillSchema = z.object({
  name: z.string().min(1, "Nama skill wajib diisi"),
  subject: z.string().min(1, "Subject wajib diisi"),
  gradeLevel: z.string().min(1, "Grade level wajib diisi"),
  topic: z.string().min(1, "Topic wajib diisi"),
  systemPrompt: z
    .string()
    .min(1, "System prompt wajib diisi")
    .default(
      `Anda adalah asisten pembuat soal pendidikan. Tugas Anda adalah membuat soal berdasarkan REFERENCE_CONTEXT yang diberikan.

REFERENCE_CONTEXT:
{reference_context}

INSTRUKSI PENTING:
1. Buat soal HANYA berdasarkan reference_context yang diberikan.
2. Jika informasi dalam reference_context tidak cukup untuk membuat soal yang valid, jangan mengarang fakta — kembalikan status butuh konteks tambahan.
3. Setiap soal harus memiliki kunci jawaban yang jelas dapat diverifikasi dari reference_context.
4. Gunakan bahasa Indonesia yang baik dan benar.
5. Sertakan pembahasan yang merujuk kembali ke reference_context.`,
    ),
  questionFormat: z
    .object({
      type: z.string().default("multiple_choice"),
      optionsCount: z.number().default(4),
      hasExplanation: z.boolean().default(true),
    })
    .default({}),
  referenceContext: z.string().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.string().optional(),
});

const updateSkillSchema = createSkillSchema.partial();

// ── Default system prompt template ──

function buildDefaultPrompt(referenceContext?: string): string {
  return `Anda adalah asisten pembuat soal pendidikan. Tugas Anda adalah membuat soal berdasarkan REFERENCE_CONTEXT yang diberikan.

REFERENCE_CONTEXT:
${referenceContext || "(belum ada konteks)"}

INSTRUKSI PENTING:
1. Buat soal HANYA berdasarkan reference_context yang diberikan.
2. Jika informasi dalam reference_context tidak cukup untuk membuat soal yang valid, jangan mengarang fakta — kembalikan status butuh konteks tambahan.
3. Setiap soal harus memiliki kunci jawaban yang jelas dapat diverifikasi dari reference_context.
4. Gunakan bahasa Indonesia yang baik dan benar.
5. Sertakan pembahasan yang merujuk kembali ke reference_context.`;
}

// ── Routes ──

// GET /api/skills
router.get("/", async (_req, res: Response) => {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { versions: true, questions: true } } },
    });
    res.json(skills);
  } catch (err) {
    console.error("Error fetching skills:", err);
    res.status(500).json({ error: "Gagal mengambil data skills" });
  }
});

// GET /api/skills/:id
router.get("/:id", async (req, res: Response) => {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: req.params.id as string },
      include: { versions: { orderBy: { createdAt: "desc" } } },
    });
    if (!skill) {
      res.status(404).json({ error: "Skill tidak ditemukan" });
      return;
    }
    res.json(skill);
  } catch (err) {
    console.error("Error fetching skill:", err);
    res.status(500).json({ error: "Gagal mengambil data skill" });
  }
});

// POST /api/skills
router.post(
  "/",
  authorize("ADMIN", "OPERATOR_GENERATE"),
  async (req, res: Response) => {
    try {
      const body = createSkillSchema.parse(req.body);

      const systemPrompt = body.systemPrompt.includes("{reference_context}")
        ? body.systemPrompt.replace(
            "{reference_context}",
            body.referenceContext || "",
          )
        : body.systemPrompt;

      const skill = await prisma.skill.create({
        data: {
          name: body.name,
          subject: body.subject,
          gradeLevel: body.gradeLevel,
          topic: body.topic,
          systemPrompt,
          questionFormat: body.questionFormat as object,
          referenceContext: body.referenceContext || null,
          isActive: body.isActive,
          createdBy: req.user!.userId,
          versions: {
            create: {
              version: "1.0",
              systemPrompt,
              questionFormat: body.questionFormat as object,
              referenceContext: body.referenceContext || null,
            },
          },
        },
      });

      logAudit({
        actorId: req.user!.userId,
        action: "CREATE_SKILL",
        targetId: skill.id,
        metadata: { name: skill.name },
      }).catch(() => {});

      res.status(201).json(skill);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Validasi gagal", details: err.errors });
        return;
      }
      console.error("Error creating skill:", err);
      res.status(500).json({ error: "Gagal membuat skill" });
    }
  },
);

// PUT /api/skills/:id
router.put(
  "/:id",
  authorize("ADMIN", "OPERATOR_GENERATE"),
  async (req, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.skill.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Skill tidak ditemukan" });
        return;
      }

      const body = updateSkillSchema.parse(req.body);

      type VersionedKeys =
        | "systemPrompt"
        | "questionFormat"
        | "referenceContext";
      const versionedKeys: VersionedKeys[] = [
        "systemPrompt",
        "questionFormat",
        "referenceContext",
      ];

      const hasVersionedChange = versionedKeys.some(
        (key) =>
          body[key] !== undefined &&
          JSON.stringify(body[key]) !== JSON.stringify(existing[key]),
      );

      const newVersion = hasVersionedChange
        ? String(Number(existing.version) + 1)
        : existing.version;

      const systemPrompt =
        body.systemPrompt !== undefined
          ? body.systemPrompt.includes("{reference_context}")
            ? body.systemPrompt.replace(
                "{reference_context}",
                body.referenceContext ?? existing.referenceContext ?? "",
              )
            : body.systemPrompt
          : existing.systemPrompt;

      const skill = await prisma.skill.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.subject !== undefined && { subject: body.subject }),
          ...(body.gradeLevel !== undefined && { gradeLevel: body.gradeLevel }),
          ...(body.topic !== undefined && { topic: body.topic }),
          ...(body.systemPrompt !== undefined && { systemPrompt }),
          ...(body.questionFormat !== undefined && {
            questionFormat: body.questionFormat as object,
          }),
          ...(body.referenceContext !== undefined && {
            referenceContext: body.referenceContext,
          }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          version: newVersion,
          versions: hasVersionedChange
            ? {
                create: {
                  version: newVersion,
                  systemPrompt,
                  questionFormat: (body.questionFormat ??
                    existing.questionFormat) as object,
                  referenceContext:
                    body.referenceContext ?? existing.referenceContext,
                },
              }
            : undefined,
        },
      });

      logAudit({
        actorId: req.user!.userId,
        action: "UPDATE_SKILL",
        targetId: skill.id,
        metadata: { name: skill.name, version: newVersion },
      }).catch(() => {});

      res.json(skill);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Validasi gagal", details: err.errors });
        return;
      }
      console.error("Error updating skill:", err);
      res.status(500).json({ error: "Gagal mengupdate skill" });
    }
  },
);

// DELETE /api/skills/:id
router.delete(
  "/:id",
  authorize("ADMIN", "OPERATOR_GENERATE"),
  async (req, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.skill.findUnique({
        where: { id },
        include: { _count: { select: { questions: true } } },
      });
      if (!existing) {
        res.status(404).json({ error: "Skill tidak ditemukan" });
        return;
      }

      // Hapus semua relasi dalam satu transaksi karena tidak ada cascade di schema
      await prisma.$transaction(async (tx) => {
        // Ambil semua question ID milik skill ini
        const questions = await tx.question.findMany({
          where: { skillId: id },
          select: { id: true },
        });
        const qIds = questions.map((q) => q.id);

        if (qIds.length > 0) {
          // Hapus log-log yang mereference questions
          await tx.aiReviewLog.deleteMany({
            where: { questionId: { in: qIds } },
          });
          await tx.duplicateScanLog.deleteMany({
            where: {
              OR: [
                { questionId: { in: qIds } },
                { similarQuestionId: { in: qIds } },
              ],
            },
          });
          await tx.humanReviewLog.deleteMany({
            where: { questionId: { in: qIds } },
          });
          await tx.question.deleteMany({ where: { skillId: id } });
        }

        // Hapus generation jobs
        await tx.generationJob.deleteMany({ where: { skillId: id } });

        // Hapus skill (SkillVersion sudah cascade otomatis)
        await tx.skill.delete({ where: { id } });
      });

      logAudit({
        actorId: req.user!.userId,
        action: "DELETE_SKILL",
        targetId: id,
        metadata: {
          name: existing.name,
          questionCount: existing._count.questions,
        },
      }).catch(() => {});

      res.json({ message: "Skill berhasil dihapus" });
    } catch (err) {
      console.error("Error deleting skill:", err);
      res.status(500).json({ error: "Gagal menghapus skill" });
    }
  },
);

// PATCH /api/skills/:id/toggle
router.patch(
  "/:id/toggle",
  authorize("ADMIN", "OPERATOR_GENERATE"),
  async (req, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.skill.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Skill tidak ditemukan" });
        return;
      }

      const skill = await prisma.skill.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      logAudit({
        actorId: req.user!.userId,
        action: "UPDATE_SKILL",
        targetId: skill.id,
        metadata: { toggle: skill.isActive },
      }).catch(() => {});

      res.json(skill);
    } catch (err) {
      console.error("Error toggling skill:", err);
      res.status(500).json({ error: "Gagal mengubah status skill" });
    }
  },
);

export default router;
