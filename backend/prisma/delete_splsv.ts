import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const skillName = "Persamaan Linear Satu Variabel";
  const skill = await prisma.skill.findFirst({
    where: { name: skillName },
  });

  if (!skill) {
    console.log(`Skill "${skillName}" not found in database.`);
    return;
  }

  console.log(`Found skill: "${skill.name}" (ID: ${skill.id}). Deleting...`);

  // Find all questions associated with this skill
  const questions = await prisma.question.findMany({
    where: { skillId: skill.id },
    select: { id: true },
  });
  const questionIds = questions.map((q) => q.id);

  console.log(`Found ${questionIds.length} questions associated with this skill.`);

  await prisma.$transaction([
    // Delete logs
    prisma.aiReviewLog.deleteMany({ where: { questionId: { in: questionIds } } }),
    prisma.humanReviewLog.deleteMany({ where: { questionId: { in: questionIds } } }),
    prisma.duplicateScanLog.deleteMany({
      where: { OR: [{ questionId: { in: questionIds } }, { similarQuestionId: { in: questionIds } }] },
    }),
    // Delete questions
    prisma.question.deleteMany({ where: { id: { in: questionIds } } }),
    // Delete generation jobs
    prisma.generationJob.deleteMany({ where: { skillId: skill.id } }),
    // Delete skill
    prisma.skill.delete({ where: { id: skill.id } }),
  ]);

  console.log(`Successfully deleted skill "${skillName}" and all related data!`);
}

main()
  .catch((e) => {
    console.error("Failed to delete skill:", e);
  })
  .finally(() => prisma.$disconnect());
