/*
  Warnings:

  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ai_review_logs" DROP CONSTRAINT "ai_review_logs_question_id_fkey";

-- DropForeignKey
ALTER TABLE "duplicate_scan_logs" DROP CONSTRAINT "duplicate_scan_logs_question_id_fkey";

-- DropForeignKey
ALTER TABLE "duplicate_scan_logs" DROP CONSTRAINT "duplicate_scan_logs_similar_question_id_fkey";

-- DropForeignKey
ALTER TABLE "human_review_logs" DROP CONSTRAINT "human_review_logs_question_id_fkey";

-- DropIndex
DROP INDEX "questions_question_text_trgm_idx";

-- DropIndex
DROP INDEX "skill_versions_skill_id_idx";

-- AlterTable
ALTER TABLE "ai_review_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "duplicate_scan_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "export_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "question_ids" DROP DEFAULT,
ALTER COLUMN "question_ids" SET DATA TYPE TEXT[];

-- AlterTable
ALTER TABLE "export_templates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "column_mapping" DROP DEFAULT;

-- AlterTable
ALTER TABLE "generation_jobs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "human_review_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "skill_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "question_format" DROP DEFAULT;

-- AlterTable
ALTER TABLE "skills" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "question_format" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "role" SET DEFAULT 'OPERATOR_GENERATE';

-- Set a placeholder hash for any existing rows (will be overwritten by seed)
UPDATE "users" SET "password_hash" = '$2a$12$PLACEHOLDER' WHERE "password_hash" = '';

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_review_logs" ADD CONSTRAINT "ai_review_logs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_scan_logs" ADD CONSTRAINT "duplicate_scan_logs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_scan_logs" ADD CONSTRAINT "duplicate_scan_logs_similar_question_id_fkey" FOREIGN KEY ("similar_question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_review_logs" ADD CONSTRAINT "human_review_logs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
