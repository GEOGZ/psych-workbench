-- Run this against the Neon database before deploying the audit log feature.
-- Depends on 001_add_audit_event_types.sql running first.
CREATE TABLE IF NOT EXISTS client_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  actor_user_id UUID,
  event_type project_event_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS client_events_client_id_at_idx ON client_events (client_id, at);
