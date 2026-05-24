-- 0001_init.sql
-- Initial migration: enable required PostgreSQL extensions for the workbench.
-- btree_gist is required for hat_logs GiST exclusion constraint (T7) which
-- enforces non-overlapping time ranges per user_id while combining with the
-- equality on user_id (a btree-indexable type).

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
