-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "job_id" UUID;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
