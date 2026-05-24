-- 0012_event_types.sql
-- v2.0: extend event type enum for checklist and meta events

ALTER TYPE project_event_type ADD VALUE IF NOT EXISTS 'checklist_toggled';
ALTER TYPE project_event_type ADD VALUE IF NOT EXISTS 'stage_meta_updated';
