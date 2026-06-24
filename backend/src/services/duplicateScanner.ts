import prisma from "../db";

const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

function getThreshold(): number {
  const env = process.env.DUPLICATE_SIMILARITY_THRESHOLD;
  if (env) {
    const n = Number(env);
    if (!isNaN(n) && n >= 0 && n <= 1) return n;
  }
  return DEFAULT_SIMILARITY_THRESHOLD;
}

export interface DuplicateMatch {
  questionId: string;
  questionText: string;
  content: unknown;
  similarity: number;
}

export async function scanDuplicates(questionId: string): Promise<{
  isDuplicate: boolean;
  matches: DuplicateMatch[];
}> {
  const threshold = getThreshold();

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const raw: Array<{
    id: string;
    question_text: string;
    content: unknown;
    similarity: number;
  }> = await prisma.$queryRawUnsafe(
    `SELECT q.id, q.question_text, q.content, similarity(q.question_text, $1) AS similarity
     FROM questions q
     WHERE q.id != $2::uuid
       AND q.status IN ('PUBLISHED', 'UNPUBLISHED', 'PASSED_AI_REVIEW', 'UNIQUE', 'DUPLICATE_SUSPECT')
       AND similarity(q.question_text, $1) >= $3
     ORDER BY similarity DESC
     LIMIT 5`,
    question.questionText,
    question.id,
    threshold
  );

  const matches: DuplicateMatch[] = raw.map((r) => ({
    questionId: r.id,
    questionText: r.question_text,
    content: r.content,
    similarity: Number(r.similarity),
  }));

  if (matches.length > 0) {
    await prisma.duplicateScanLog.createMany({
      data: matches.map((m) => ({
        questionId: question.id,
        similarQuestionId: m.questionId,
        similarityScore: m.similarity,
      })),
    });
  }

  // Only update status if AI review already passed — don't overwrite FLAGGED_BY_AI
  if (question.status === "PASSED_AI_REVIEW") {
    await prisma.question.update({
      where: { id: question.id },
      data: {
        status: matches.length > 0 ? "DUPLICATE_SUSPECT" : "UNIQUE",
      },
    });
  }

  return {
    isDuplicate: matches.length > 0,
    matches,
  };
}
