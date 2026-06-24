-- Enable pg_trgm extension for fuzzy text search (duplicate detection)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE question_status AS ENUM (
  'DRAFT',
  'PASSED_AI_REVIEW',
  'FLAGGED_BY_AI',
  'UNIQUE',
  'DUPLICATE_SUSPECT',
  'PUBLISHED',
  'REJECTED'
);

CREATE TYPE generation_job_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Skills / kisi-kisi generate
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "subject" TEXT NOT NULL,
    "grade_level" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "question_format" JSONB NOT NULL DEFAULT '{}',
    "reference_context" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- Soal
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "skill_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "question_text" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "tags" TEXT[] DEFAULT '{}',
    "status" question_status NOT NULL DEFAULT 'DRAFT',
    "generated_by_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- Job generate soal (pengganti BullMQ)
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "skill_id" UUID NOT NULL,
    "requested_count" INTEGER NOT NULL,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "status" generation_job_status NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- Log review AI
CREATE TABLE "ai_review_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "issues" JSONB,
    "confidence" DECIMAL(5,4),
    "model_used" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_review_logs_pkey" PRIMARY KEY ("id")
);

-- Log duplicate scan
CREATE TABLE "duplicate_scan_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "similar_question_id" UUID NOT NULL,
    "similarity_score" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_scan_logs_pkey" PRIMARY KEY ("id")
);

-- Log review manusia
CREATE TABLE "human_review_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "decision" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_review_logs_pkey" PRIMARY KEY ("id")
);

-- Export templates
CREATE TABLE "export_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "column_mapping" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_templates_pkey" PRIMARY KEY ("id")
);

-- Export logs
CREATE TABLE "export_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "question_ids" UUID[] NOT NULL DEFAULT '{}',
    "file_path" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
);

-- Users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================
ALTER TABLE "questions" ADD CONSTRAINT "questions_skill_id_fkey"
    FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_skill_id_fkey"
    FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_review_logs" ADD CONSTRAINT "ai_review_logs_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "duplicate_scan_logs" ADD CONSTRAINT "duplicate_scan_logs_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "duplicate_scan_logs" ADD CONSTRAINT "duplicate_scan_logs_similar_question_id_fkey"
    FOREIGN KEY ("similar_question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "human_review_logs" ADD CONSTRAINT "human_review_logs_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "human_review_logs" ADD CONSTRAINT "human_review_logs_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "export_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- INDEXES
-- ============================================================

-- GIN trigram index for duplicate detection via pg_trgm
CREATE INDEX IF NOT EXISTS "questions_question_text_trgm_idx"
    ON "questions" USING GIN ("question_text" gin_trgm_ops);
