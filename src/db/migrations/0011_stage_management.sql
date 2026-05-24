-- 0011_stage_management.sql
-- v1.5: per-stage metadata field + checklist items table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS stage_meta JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS project_checklist_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage              TEXT NOT NULL,
  key                TEXT NOT NULL,
  checked            BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at         TIMESTAMPTZ,
  checked_by_user_id UUID REFERENCES users(id),
  UNIQUE (project_id, stage, key)
);

CREATE INDEX IF NOT EXISTS checklist_items_project_id_idx
  ON project_checklist_items (project_id);
