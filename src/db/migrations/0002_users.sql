-- 0002_users.sql
-- T3: users table + user_role enum + single-owner partial unique index.
-- The partial unique index on a constant expression `(1)` filtered by
-- `role = 'owner'` enforces "at most one row with role = 'owner'" at the
-- DB level. To transfer ownership, the application MUST first demote the
-- current owner (UPDATE role TO 'admin') before inserting/promoting a new
-- owner — otherwise the unique index will reject the second 'owner' row.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'contractor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT        NOT NULL UNIQUE,
  email_verified      TIMESTAMPTZ,
  name                TEXT,
  image               TEXT,
  role                user_role   NOT NULL,
  invited_by_user_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_invited_by_user_id_fkey
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner
  ON users ((1))
  WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
