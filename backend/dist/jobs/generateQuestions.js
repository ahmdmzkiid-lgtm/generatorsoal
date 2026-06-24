"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGenerationJob = processGenerationJob;
const db_1 = __importDefault(require("../db"));
const factory_1 = require("../ai/factory");
const aiReviewer_1 = require("../services/aiReviewer");
async function processGenerationJob(jobId, customPrompt, images) {
    const generator = (0, factory_1.createGeneratorProvider)();
    try {
        // 1. Update status to PROCESSING
        await db_1.default.generationJob.update({
            where: { id: jobId },
            data: { status: "PROCESSING" },
        });
        // 2. Fetch job + skill
        const job = await db_1.default.generationJob.findUnique({
            where: { id: jobId },
            include: { skill: true },
        });
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        const skill = job.skill;
        // 3. Build prompt
        const prompt = buildPrompt(skill, customPrompt);
        const count = job.requestedCount;
        // 4. Generate questions — batch call
        const generated = await generator.generateQuestions(prompt, {}, count, images, {
            systemPrompt: skill.systemPrompt,
            referenceContext: skill.referenceContext,
            customPrompt: customPrompt,
        });
        // 5. Process each question
        let flaggedByAi = 0;
        let passedCount = 0;
        for (let i = 0; i < generated.length; i++) {
            const q = generated[i];
            // 5a. Save question first (DRAFT), get the ID
            const question = await db_1.default.question.create({
                data: {
                    skillId: skill.id,
                    jobId: jobId,
                    content: q,
                    questionText: q.question,
                    difficulty: q.difficulty,
                    tags: q.tags,
                    status: "DRAFT",
                    generatedByModel: process.env.AI_GENERATOR_PROVIDER || "gemini",
                },
            });
            try {
                // 5b. Run AI review via dedicated service
                const review = await (0, aiReviewer_1.reviewQuestion)(question.id);
                if (review.newStatus === "FLAGGED_BY_AI")
                    flaggedByAi++;
                else
                    passedCount++;
            }
            catch {
                // If review fails, leave as DRAFT
                passedCount++;
            }
            // 5c. Update progress
            await db_1.default.generationJob.update({
                where: { id: jobId },
                data: { completedCount: i + 1 },
            });
        }
        // 6. Mark job COMPLETED
        await db_1.default.generationJob.update({
            where: { id: jobId },
            data: { status: "COMPLETED" },
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Job ${jobId} failed:`, err);
        await db_1.default.generationJob.update({
            where: { id: jobId },
            data: {
                status: "FAILED",
                errorMessage: message,
            },
        });
    }
}
function buildPrompt(skill, customPrompt) {
    const context = skill.referenceContext
        ? `\n\nREFERENCE_CONTEXT:\n${skill.referenceContext}`
        : "";
    const customInstruction = customPrompt
        ? `\n\nINSTRUKSI TAMBAHAN DARI PENGGUNA:\n${customPrompt}\n(Harap prioritaskan instruksi tambahan ini dalam pembuatan soal jika tidak bertentangan dengan reference_context).`
        : "";
    return `${skill.systemPrompt}${context}${customInstruction}

INSTRUKSI FORMAT OUTPUT:
Buat soal dalam format JSON array. Setiap item harus memiliki field:
- question (string): teks soal
- options (array of {key: string, value: string}): opsi jawaban (A/B/C/D/E), selalu 5 opsi
- answerKey (string): huruf kunci jawaban
- explanation (string): pembahasan singkat
- difficulty (string): "easy", "medium", atau "hard"
- tags (array of string): tag/topik soal

Output HANYA berupa JSON array valid, tanpa teks lain.`;
}
//# sourceMappingURL=generateQuestions.js.map