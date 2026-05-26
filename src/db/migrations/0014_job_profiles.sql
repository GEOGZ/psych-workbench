-- 0014_job_profiles.sql
CREATE TABLE IF NOT EXISTS job_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  department  TEXT,
  competencies JSONB NOT NULL DEFAULT '[]',
  tools       JSONB NOT NULL DEFAULT '[]',
  notes       TEXT,
  owner_user_id UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS job_profile_id UUID REFERENCES job_profiles(id) ON DELETE SET NULL;
