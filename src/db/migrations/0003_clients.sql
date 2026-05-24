-- 0003_clients.sql
-- T4: clients table with required crisis contact fields.
-- Crisis contact name and phone are NOT NULL to ensure emergency escalation
-- information is always available in the database.

CREATE TABLE IF NOT EXISTS clients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  contact_name          TEXT        NOT NULL,
  contact_email         TEXT,
  contact_phone         TEXT,
  crisis_contact_name   TEXT        NOT NULL,
  crisis_contact_phone  TEXT        NOT NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (name);
