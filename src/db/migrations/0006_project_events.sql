-- 0006_project_events.sql
-- T6: project_events append-only audit log.
-- Append-only is enforced at the application layer (no UPDATE/DELETE paths
-- in the codebase). DB-level revoke can be added later via REVOKE on the
-- table for the application role if needed.

DO $$ BEGIN
  CREATE TYPE project_event_type AS ENUM (
    'state_advanced',
    'note_added',
    'hat_switched',
    'contractor_granted',
    'contractor_revoked',
    'portal_token_issued',
    'portal_token_revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS project_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL,
  actor_user_id  UUID,
  event_type     project_event_type NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_events_project_id_at_idx
  ON project_events (project_id, at DESC);
