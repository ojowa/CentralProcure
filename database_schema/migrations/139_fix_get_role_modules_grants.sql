-- Migration 139: Fix get_role_modules to respect internal_module_grants
-- Previously, modules with required_permission IS NULL were shown to ALL roles
-- regardless of internal_module_grants. Now modules without a required_permission
-- require an explicit grant to be visible.

CREATE OR REPLACE FUNCTION identity.get_role_modules(p_role_key character varying)
RETURNS TABLE(
  module_id character varying,
  title character varying,
  section character varying,
  description text,
  microservice character varying,
  control_purpose text,
  actions text[],
  required_permission character varying
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT m.module_id, m.title, m.section, m.description, m.microservice, m.control_purpose, m.actions, m.required_permission
    FROM identity.internal_modules m
    WHERE m.is_active = TRUE
      AND (
          -- Module has a required permission and role has it
          (
              m.required_permission IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM identity.role_permissions rp
                  JOIN identity.roles r ON r.role_id = rp.role_id
                  JOIN identity.permissions p ON p.permission_id = rp.permission_id
                  WHERE r.role_key = p_role_key
                    AND r.is_active = TRUE
                    AND p.is_active = TRUE
                    AND rp.is_enabled = TRUE
                    AND p.permission_key = m.required_permission
              )
          )
          OR
          -- Module has no required permission but role has an explicit grant
          (
              m.required_permission IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM identity.internal_module_grants mg
                  JOIN identity.roles r ON r.role_id = mg.role_id
                  WHERE r.role_key = p_role_key
                    AND r.is_active = TRUE
                    AND mg.module_id = m.module_id
                    AND mg.is_enabled = TRUE
              )
          )
      )
    ORDER BY m.title;
END;
$$;

-- Backfill module grants for all roles based on permissions
INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
SELECT DISTINCT r.role_id, m.module_id, true
FROM identity.roles r
JOIN identity.role_permissions rp ON rp.role_id = r.role_id AND rp.is_enabled = true
JOIN identity.permissions p ON p.permission_id = rp.permission_id AND p.is_active = true
JOIN identity.internal_modules m ON m.required_permission = p.permission_key AND m.is_active = true
WHERE r.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM identity.internal_module_grants mg
    WHERE mg.role_id = r.role_id AND mg.module_id = m.module_id
  );

-- Grant admin all modules
INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
SELECT r.role_id, m.module_id, true
FROM identity.roles r
CROSS JOIN identity.internal_modules m
WHERE r.role_key = 'admin' AND m.is_active = true
  AND NOT EXISTS (SELECT 1 FROM identity.internal_module_grants mg WHERE mg.role_id = r.role_id AND mg.module_id = m.module_id);

-- user-profile for all active roles
INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
SELECT r.role_id, 'user-profile', true
FROM identity.roles r
WHERE r.is_active = true
  AND NOT EXISTS (SELECT 1 FROM identity.internal_module_grants mg WHERE mg.role_id = r.role_id AND mg.module_id = 'user-profile');
