-- 0009_contractor_grants.sql
-- T9: per-project access grants for contractor users.
-- One grant per (user, project); revoked_at preserves audit history.
-- expires_at is NOT NULL — no perpetual contractor access.

CREATE TABLE IF NOT EXISTS contractor_grants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  project_id          UUID NOT NULL,
  granted_by_user_id  UUID NOT NULL,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_grants_user_project_unique
  ON contractor_grants (user_id, project_id);

CREATE INDEX IF NOT EXISTS contractor_grants_user_id_idx
  ON contractor_grants (user_id);

CREATE INDEX IF NOT EXISTS contractor_grants_project_id_idx
  ON contractor_grants (project_id);
