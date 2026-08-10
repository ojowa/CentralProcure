-- Migration 136: Drop legacy role_has_permission (replaced by user_has_permission)
-- and ensure needs_collection has endorse columns (migration 132 was partially applied)
BEGIN;

-- 1. Drop legacy function (same signature as user_has_permission)
DROP FUNCTION IF EXISTS identity.role_has_permission(varchar, varchar);

-- 2. Ensure endorse columns exist on needs_collection
ALTER TABLE procurement_workflow.needs_collection
ADD COLUMN IF NOT EXISTS endorsed_by character varying,
ADD COLUMN IF NOT EXISTS endorsed_at timestamp without time zone;

COMMENT ON COLUMN procurement_workflow.needs_collection.endorsed_by IS 'User who endorsed the collection (department/formation head)';
COMMENT ON COLUMN procurement_workflow.needs_collection.endorsed_at IS 'Timestamp when the collection was endorsed';

COMMIT;
