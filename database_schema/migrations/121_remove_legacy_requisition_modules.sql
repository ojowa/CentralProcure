-- Migration 121: Remove legacy requisition modules that are no longer used
BEGIN;

DELETE FROM identity.internal_module_grants
WHERE module_id IN (
    'workflow-blueprint',
    'create-requisition',
    'requisition-history',
    'requisition-tracking',
    'requisition-management'
);

DELETE FROM identity.internal_modules
WHERE module_id IN (
    'workflow-blueprint',
    'create-requisition',
    'requisition-history',
    'requisition-tracking',
    'requisition-management'
);

COMMIT;
