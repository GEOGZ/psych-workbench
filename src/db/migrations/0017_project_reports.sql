-- project_reports: stores uploaded report files per project
CREATE TABLE IF NOT EXISTS project_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  file_type       TEXT NOT NULL CHECK (file_type IN ('pdf', 'word', 'other')),
  file_key        TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INTEGER,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visible_to_portal BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS project_reports_project_id_idx ON project_reports(project_id);

-- report_access_logs: audit log for every view/download of a report
CREATE TABLE IF NOT EXISTS report_access_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        UUID NOT NULL REFERENCES project_reports(id) ON DELETE CASCADE,
  accessed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type       TEXT NOT NULL CHECK (actor_type IN ('user', 'portal')),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  portal_token_id  UUID REFERENCES client_portal_tokens(id) ON DELETE SET NULL,
  action           TEXT NOT NULL CHECK (action IN ('view', 'download')),
  ip_address       TEXT
);

CREATE INDEX IF NOT EXISTS report_access_logs_report_id_idx ON report_access_logs(report_id);

-- Add report_uploaded to the project_event_type enum
ALTER TYPE project_event_type ADD VALUE IF NOT EXISTS 'report_uploaded';
