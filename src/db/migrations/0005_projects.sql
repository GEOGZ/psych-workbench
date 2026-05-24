-- 0005_projects.sql
-- T5: projects table + project_state enum.
-- FK constraints to users(id) and clients(id) intentionally deferred until
-- T3 (users) and T4 (clients) land; will be added in a follow-up migration
-- so this file remains independently runnable once those tables exist.

DO $$ BEGIN
  CREATE TYPE project_state AS ENUM (
    'lead',
    'qualifying',
    'discovery',
    'contract',
    'execution',
    'reporting',
    'closing',
    'done'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  title         TEXT NOT NULL,
  state         project_state NOT NULL DEFAULT 'lead',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_owner_user_id_idx ON projects (owner_user_id);
CREATE INDEX IF NOT EXISTS projects_client_id_idx     ON projects (client_id);
CREATE INDEX IF NOT EXISTS projects_state_idx         ON projects (state);
