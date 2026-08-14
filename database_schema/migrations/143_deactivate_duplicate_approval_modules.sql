-- Migration 143: Deactivate duplicate approval modules
-- 'approval-rejection' is functionally identical to 'tenders-board-approval' (same component, same mode, same data)
-- 'final-approval' is functionally identical to 'cgis-approval' (same component, same queue)
-- Consolidating reduces module sprawl and clarifies the workflow.

BEGIN;

-- Deactivate approval-rejection (duplicate of tenders-board-approval)
UPDATE identity.internal_modules
SET is_active = false, updated_at = NOW()
WHERE module_id = 'approval-rejection';

-- Deactivate final-approval (duplicate of cgis-approval)
UPDATE identity.internal_modules
SET is_active = false, updated_at = NOW()
WHERE module_id = 'final-approval';

-- Remove module access grants for deactivated modules
DELETE FROM identity.internal_module_grants
WHERE module_id IN ('approval-rejection', 'final-approval');

COMMIT;
