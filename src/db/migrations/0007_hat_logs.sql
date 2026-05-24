-- 0007_hat_logs.sql
-- T7: hat_logs table with GiST exclusion constraint to enforce non-overlapping
-- hat intervals per user.
--
-- The half-open [) interval semantics are critical: we use tstzrange(start_at, COALESCE(end_at, 'infinity'), '[)')
-- meaning [start_at, end_at) — start_at is INCLUDED, end_at is EXCLUDED.
--
-- This allows back-to-back hat intervals: if hat A ends at 11:00, hat B can start at 11:00
-- because 11:00 is NOT part of A's range [start, 11:00).
--
-- The EXCLUDE USING gist(...) constraint prevents any two rows for the same user from having
-- overlapping ranges. Combined with the half-open semantics, we allow exactly back-to-back
-- scheduling without false conflicts.

DO $$ BEGIN
  CREATE TYPE hat_type AS ENUM ('🎩', '🧠', '🛠', '📊');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hat_source AS ENUM ('manual', 'backfill');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS hat_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  hat         hat_type    NOT NULL,
  project_id  UUID,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  source      hat_source  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE hat_logs
    ADD CONSTRAINT hat_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE hat_logs
    ADD CONSTRAINT hat_logs_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE hat_logs ADD CONSTRAINT hat_logs_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(start_at, COALESCE(end_at, 'infinity'), '[)') WITH &&
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS hat_logs_user_id_start_at_idx
  ON hat_logs (user_id, start_at DESC);

CREATE INDEX IF NOT EXISTS hat_logs_project_id_idx
  ON hat_logs (project_id)
  WHERE project_id IS NOT NULL;
