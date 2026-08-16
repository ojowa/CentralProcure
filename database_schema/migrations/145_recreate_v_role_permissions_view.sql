-- Migration 145: Recreate v_role_permissions view
-- The view was dropped by migration 135 (which consolidated roles and
-- re-seeded role_permissions) but is still queried by the role-permissions
-- admin endpoints and the Permissions tab. Recreate it here.
CREATE OR REPLACE VIEW identity.v_role_permissions AS
SELECT
    r.role_name,
    r.description AS role_description,
    p.permission_key,
    p.module,
    p.action,
    p.description AS permission_description,
    rp.is_enabled,
    rp.created_at AS granted_at
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
JOIN identity.permissions p ON p.permission_id = rp.permission_id
WHERE r.is_active = TRUE AND p.is_active = TRUE
ORDER BY r.role_name, p.module, p.action;