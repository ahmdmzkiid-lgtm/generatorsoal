import prisma from "../db";
import { createGeneratorProvider } from "../ai/factory";
import { reviewQuestion } from "../services/aiReviewer";

export async function processGenerationJob(
  jobId: string,
  customPrompt?: string,
  images?: { data: string; mimeType: string }[]
): Promise<void> {
  const generator = createGeneratorProvider();

  try {
    // 1. Update status to PROCESSING
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING" },
    });

    // 2. Fetch job + skill
    const job = await prisma.generationJob.findUnique({
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
      const question = await prisma.question.create({
        data: {
          skillId: skill.id,
          jobId: jobId,
          content: q as object,
          questionText: q.question,
          difficulty: q.difficulty,
          tags: q.tags,
          status: "DRAFT",
          generatedByModel: process.env.AI_GENERATOR_PROVIDER || "gemini",
        },
      });

      try {
        // 5b. Run AI review via dedicated service
        const review = await reviewQuestion(question.id);
        if (review.newStatus === "FLAGGED_BY_AI") flaggedByAi++;
        else passedCount++;
      } catch {
        // If review fails, leave as DRAFT
        passedCount++;
      }

      // 5c. Update progress
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { completedCount: i + 1 },
      });
    }

    // 6. Mark job COMPLETED
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Job ${jobId} failed:`, err);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
  }
}

function buildPrompt(
  skill: {
    systemPrompt: string;
    referenceContext: string | null;
  },
  customPrompt?: string
): string {
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
