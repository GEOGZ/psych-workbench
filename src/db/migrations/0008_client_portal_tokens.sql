-- 0008_client_portal_tokens.sql
-- T8: read-only magic-link tokens for the client portal.
-- Tokens are 64-char hex (32 bytes via crypto.randomBytes); validation
-- happens in /api/portal/* middleware, independent of NextAuth.

CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL,
  issued_by_user_id UUID NOT NULL,
  token             TEXT NOT NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS client_portal_tokens_token_unique
  ON client_portal_tokens (token);

CREATE INDEX IF NOT EXISTS client_portal_tokens_client_id_idx
  ON client_portal_tokens (client_id);
