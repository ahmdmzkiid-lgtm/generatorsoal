"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewQuestion = reviewQuestion;
const db_1 = __importDefault(require("../db"));
const factory_1 = require("../ai/factory");
const duplicateScanner_1 = require("./duplicateScanner");
const REVIEW_CRITERIA = `Anda adalah EVALUATOR soal pendidikan yang ketat. Tugas Anda adalah MEMERIKSA (bukan membuat) soal berdasarkan kriteria berikut:

1. **KONSISTENSI KUNCI JAWABAN**: Apakah kunci jawaban (answerKey) benar-benar cocok dengan soal dan opsi yang diberikan? Pastikan tidak ada jawaban ganda atau kunci yang salah.

2. **KUALITAS OPSI**: Apakah opsi jawaban tidak ambigu? Apakah tidak ada opsi yang tumpang tindih (dua opsi dengan makna sama)? Apakah semua opsi masuk akal sebagai pengecoh?

3. **KESESUAIAN TOPIK & KESULITAN**: Apakah soal sesuai dengan topik yang diminta? Apakah tingkat kesulitan (difficulty: easy/medium/hard) sesuai dengan kompleksitas soal?

4. **BAHASA & KEBIJAKAN**: Apakah menggunakan bahasa Indonesia baku? Apakah tidak ada typo fatal? Apakah tidak ada konten bias, diskriminatif, atau menyinggung?

5. **DUKUNGAN REFERENCE_CONTEXT (jika ada)**: Apakah soal benar-benar didukung oleh reference_context yang diberikan? Pastikan AI tidak mengarang fakta di luar konteks.

REFERENCE_CONTEXT:
{reference_context}

Output HANYA JSON dengan format:
{
  "valid": boolean,
  "issues": ["string deskripsi masalah 1", "string deskripsi masalah 2"],
  "confidence": 0.0-1.0
}

- valid: true jika soal lulus semua kriteria, false jika ada masalah
- issues: array kosong jika valid=true, atau daftar masalah spesifik jika valid=false
- confidence: seberapa yakin Anda dengan penilaian ini (0.0 = tidak yakin, 1.0 = sangat yakin)`;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
function getThreshold() {
    const env = process.env.AI_REVIEW_CONFIDENCE_THRESHOLD;
    if (env) {
        const n = Number(env);
        if (!isNaN(n) && n >= 0 && n <= 1)
            return n;
    }
    return DEFAULT_CONFIDENCE_THRESHOLD;
}
async function reviewQuestion(questionId) {
    const reviewer = (0, factory_1.createReviewerProvider)();
    // Fetch question + skill
    const question = await db_1.default.question.findUnique({
        where: { id: questionId },
        include: { skill: true },
    });
    if (!question) {
        throw new Error(`Question ${questionId} not found`);
    }
    if (question.status !== "DRAFT") {
        throw new Error(`Question ${questionId} status is ${question.status}, expected DRAFT`);
    }
    // Build the GeneratedQuestion object for the AI provider
    const content = question.content;
    const generatedQuestion = {
        question: question.questionText,
        options: content.options ?? [],
        answerKey: content.answerKey ?? "",
        explanation: content.explanation ?? "",
        difficulty: question.difficulty,
        tags: question.tags,
    };
    // Build criteria with reference context
    const referenceContext = question.skill.referenceContext ?? "(tidak ada reference context)";
    const criteria = REVIEW_CRITERIA.replace("{reference_context}", referenceContext);
    // Call AI reviewer
    const result = await reviewer.reviewQuestion(generatedQuestion, criteria);
    const issues = Array.isArray(result.issues) ? result.issues : [];
    const threshold = getThreshold();
    const passed = result.valid && result.confidence >= threshold;
    const newStatus = passed ? "PASSED_AI_REVIEW" : "FLAGGED_BY_AI";
    // Save to ai_review_logs
    await db_1.default.aiReviewLog.create({
        data: {
            questionId: question.id,
            valid: passed,
            issues: issues,
            confidence: result.confidence,
            modelUsed: process.env.AI_REVIEWER_PROVIDER || "groq",
        },
    });
    // Update question status
    await db_1.default.question.update({
        where: { id: question.id },
        data: { status: newStatus },
    });
    // Trigger duplicate scan (fire-and-forget)
    triggerDuplicateScan(question.id).catch((err) => {
        console.error(`Duplicate scan failed for question ${question.id}:`, err);
    });
    return {
        questionId: question.id,
        valid: passed,
        issues,
        confidence: result.confidence,
        newStatus,
    };
}
async function triggerDuplicateScan(questionId) {
    try {
        const result = await (0, duplicateScanner_1.scanDuplicates)(questionId);
        console.log(`[DUPLICATE_SCAN] Question ${questionId}: ${result.isDuplicate ? "DUPLICATE_SUSPECT" : "UNIQUE"} (${result.matches.length} match(es))`);
    }
    catch (err) {
        console.error(`[DUPLICATE_SCAN] Failed for question ${questionId}:`, err);
    }
}
//# sourceMappingURL=aiReviewer.js.map