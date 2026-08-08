ALTER TABLE procurement_workflow.needs_collection
ADD COLUMN IF NOT EXISTS endorsed_by character varying,
ADD COLUMN IF NOT EXISTS endorsed_at timestamp without time zone;

COMMENT ON COLUMN procurement_workflow.needs_collection.endorsed_by IS 'User who endorsed the collection (department/formation head)';
COMMENT ON COLUMN procurement_workflow.needs_collection.endorsed_at IS 'Timestamp when the collection was endorsed';
