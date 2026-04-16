BEGIN;

INSERT INTO identity.internal_modules (
    module_id,
    title,
    section,
    description,
    microservice,
    control_purpose,
    is_active
)
VALUES (
    'organization-management',
    'Organization Management',
    'System Administration',
    'Manage organizational units, formations, and departments including hierarchies and metadata.',
    'IdentityService',
    'Ensure structural integrity of organizational units for RBAC and workflow routing.',
    TRUE
)
ON CONFLICT (module_id) DO UPDATE
SET
    title = EXCLUDED.title,
    section = EXCLUDED.section,
    description = EXCLUDED.description,
    microservice = EXCLUDED.microservice,
    control_purpose = EXCLUDED.control_purpose,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO identity.internal_module_grants (
    role_id,
    module_id,
    is_enabled,
    updated_by
)
SELECT 
    r.role_id,
    'organization-management',
    TRUE,
    '00000000-0000-0000-0000-000000000000'::UUID -- System/Seed
FROM identity.roles r
WHERE r.role_name IN ('Admin', 'SystemAdministrator', 'ict_admin')
ON CONFLICT (role_id, module_id) DO UPDATE
SET
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

COMMIT;
