-- 0015_assessment_tools.sql
CREATE TABLE IF NOT EXISTS assessment_tools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  source      TEXT,
  owner_user_id UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
