-- Migration 106: Enhanced Needs Permissions (8 new permissions)
BEGIN;

-- ============================================================
-- 1. ADD NEW PERMISSIONS
-- ============================================================
INSERT INTO identity.permissions (permission_key, module, action, description) VALUES
    ('needs.delete',        'needs', 'delete',        'Delete draft needs collections'),
    ('needs.submit',        'needs', 'submit',        'Submit needs collections for review'),
    ('needs.analysis',      'needs', 'analysis',      'View needs analysis (category, weighted, thresholds, etc.)'),
    ('needs.carry_forward', 'needs', 'carry_forward', 'Carry forward needs from another year'),
    ('needs.export',        'needs', 'export',        'Export needs analysis or assessment data'),
    ('needs.archive',       'needs', 'archive',       'Archive completed assessments'),
    ('needs.return',        'needs', 'return',        'Return assessment to draft for rework'),
    ('needs.view.all',      'needs', 'view.all',      'View assessments across all units')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- 2. UPDATE ROLE-PERMISSION MAPPINGS
-- ============================================================

-- 2a. Admin — full access to all new permissions
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'Admin' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'needs.delete', 'needs.submit', 'needs.analysis', 'needs.carry_forward',
    'needs.export', 'needs.archive', 'needs.return', 'needs.view.all'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- 2b. SystemAdministrator — full access
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'SystemAdministrator' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'needs.delete', 'needs.submit', 'needs.analysis', 'needs.carry_forward',
    'needs.export', 'needs.archive', 'needs.return', 'needs.view.all'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- 2c. Head of Procurement — full needs access
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'Head of Procurement' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'needs.delete', 'needs.submit', 'needs.analysis', 'needs.carry_forward',
    'needs.export', 'needs.archive', 'needs.return', 'needs.view.all'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- 2d. Department Head — can create, view, endorse, submit, delete, return
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'DepartmentHead' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.endorse',
    'needs.delete', 'needs.submit', 'needs.return'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- 2e. Formation Head — create, view, endorse, consolidate, submit, carry forward, delete, return
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'FormationHead' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'needs.delete', 'needs.submit', 'needs.carry_forward', 'needs.return'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- 2f. Requisitioning Officer — create, view, submit (unit-scoped)
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'RequisitioningOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.submit'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- 2g. Formation Officer — create, view, submit (unit-scoped)
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'FormationOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.submit'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = TRUE;

-- ============================================================
-- 3. UPDATE MODULE CATALOG ENTRY
-- ============================================================
UPDATE identity.internal_modules
SET actions = ARRAY[
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'needs.delete', 'needs.submit', 'needs.analysis', 'needs.carry_forward',
    'needs.export', 'needs.archive', 'needs.return', 'needs.view.all'
]
WHERE module_id = 'needs-collection';

COMMIT;
