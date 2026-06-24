"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = __importDefault(require("../db"));
const generateQuestions_1 = require("../jobs/generateQuestions");
const auth_1 = require("../middleware/auth");
const auditLog_1 = require("../services/auditLog");
const router = (0, express_1.Router)();
const startJobSchema = zod_1.z.object({
    skillId: zod_1.z.string().uuid("skillId harus UUID valid"),
    count: zod_1.z.number().int().min(1).max(50),
    prompt: zod_1.z.string().optional(),
    images: zod_1.z
        .array(zod_1.z.object({
        data: zod_1.z.string(),
        mimeType: zod_1.z.string(),
    }))
        .optional(),
});
// POST /api/generate
router.post("/", auth_1.authenticate, (0, auth_1.authorize)("ADMIN", "OPERATOR_GENERATE"), async (req, res) => {
    try {
        const body = startJobSchema.parse(req.body);
        // Verify skill exists and is active
        const skill = await db_1.default.skill.findUnique({
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
        const job = await db_1.default.generationJob.create({
            data: {
                skillId: body.skillId,
                requestedCount: body.count,
                status: "PENDING",
                createdBy: req.user.userId,
            },
        });
        (0, auditLog_1.logAudit)({ actorId: req.user.userId, action: "GENERATE_QUESTIONS", targetId: job.id, metadata: { skillId: body.skillId, count: body.count } }).catch(() => { });
        // Return job ID immediately
        res.status(201).json({ jobId: job.id });
        // Fire-and-forget: process in background (not awaited)
        (0, generateQuestions_1.processGenerationJob)(job.id, body.prompt, body.images).catch((err) => {
            console.error(`Unhandled error in job ${job.id}:`, err);
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Validasi gagal", details: err.errors });
            return;
        }
        console.error("Error starting generation job:", err);
        res.status(500).json({ error: "Gagal memulai generate" });
    }
});
// GET /api/generate/:jobId/status
router.get("/:jobId/status", async (req, res) => {
    try {
        const jobId = req.params.jobId;
        const job = await db_1.default.generationJob.findUnique({
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
    }
    catch (err) {
        console.error("Error fetching job status:", err);
        res.status(500).json({ error: "Gagal mengambil status job" });
    }
});
exports.default = router;
//# sourceMappingURL=generate.js.map