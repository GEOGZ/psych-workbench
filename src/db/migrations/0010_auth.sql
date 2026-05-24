-- 0010_auth.sql
-- T10: NextAuth v4 tables for magic-link authentication with Drizzle adapter.
-- Idempotent DDL using DO blocks for FK constraints.

CREATE TABLE IF NOT EXISTS accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL,
  type                  TEXT        NOT NULL,
  provider              TEXT        NOT NULL,
  provider_account_id   TEXT        NOT NULL,
  refresh_token         TEXT,
  access_token          TEXT,
  expires_at            INTEGER,
  token_type            TEXT,
  scope                 TEXT,
  id_token              TEXT,
  session_state         TEXT
);

DO $$ BEGIN
  ALTER TABLE accounts
    ADD CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_id_idx
  ON accounts (provider, provider_account_id);

CREATE TABLE IF NOT EXISTS sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token   TEXT        NOT NULL UNIQUE,
  user_id         UUID        NOT NULL,
  expires         TIMESTAMPTZ NOT NULL
);

DO $$ BEGIN
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier  TEXT        NOT NULL,
  token       TEXT        NOT NULL,
  expires     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
