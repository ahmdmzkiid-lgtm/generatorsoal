-- Create skill_versions table for versioned skill content
CREATE TABLE "skill_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "skill_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "question_format" JSONB NOT NULL DEFAULT '{}',
    "reference_context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_versions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_fkey"
    FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS "skill_versions_skill_id_idx" ON "skill_versions" ("skill_id");
