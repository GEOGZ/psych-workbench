-- Run this against the Neon database before deploying the audit log feature.
ALTER TYPE project_event_type ADD VALUE IF NOT EXISTS 'project_updated';
ALTER TYPE project_event_type ADD VALUE IF NOT EXISTS 'client_updated';
