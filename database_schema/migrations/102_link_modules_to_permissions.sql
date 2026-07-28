-- Migration 102: Link modules to permissions, single source of truth
-- Drops internal_module_allowed_roles, derives module access from role_permissions
BEGIN;

-- 1. Add required_permission column to internal_modules
ALTER TABLE identity.internal_modules
    ADD COLUMN IF NOT EXISTS required_permission VARCHAR(150) NULL;

-- 2. Populate required_permission from the first action in actions array
UPDATE identity.internal_modules
SET required_permission = actions[1]
WHERE required_permission IS NULL AND array_length(actions, 1) > 0;

-- 3. Add FK constraint to permissions table
ALTER TABLE identity.internal_modules
    ADD CONSTRAINT fk_modules_permission
    FOREIGN KEY (required_permission)
    REFERENCES identity.permissions(permission_key)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modules_permission ON identity.internal_modules(required_permission);

-- 4. Create function: get modules a role can access (derived from permissions)
CREATE OR REPLACE FUNCTION identity.get_role_modules(p_role_name VARCHAR)
RETURNS TABLE (
    module_id VARCHAR(120),
    title VARCHAR(200),
    section VARCHAR(150),
    description TEXT,
    microservice VARCHAR(150),
    control_purpose TEXT,
    actions TEXT[],
    required_permission VARCHAR(150)
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.module_id, m.title, m.section, m.description, m.microservice, m.control_purpose, m.actions, m.required_permission
    FROM identity.internal_modules m
    WHERE m.is_active = TRUE
      AND (
          -- Module has no required permission (always visible)
          m.required_permission IS NULL
          -- OR role has at least one of the module's actions as a permission
          OR EXISTS (
              SELECT 1
              FROM identity.role_permissions rp
              JOIN identity.roles r ON r.role_id = rp.role_id
              JOIN identity.permissions p ON p.permission_id = rp.permission_id
              WHERE r.role_name = p_role_name
                AND r.is_active = TRUE
                AND p.is_active = TRUE
                AND rp.is_enabled = TRUE
                AND p.permission_key = m.required_permission
          )
      )
    ORDER BY m.title;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Create function: check if a user's role has a specific permission
CREATE OR REPLACE FUNCTION identity.user_has_permission(p_role_name VARCHAR, p_permission_key VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM identity.role_permissions rp
        JOIN identity.roles r ON r.role_id = rp.role_id
        JOIN identity.permissions p ON p.permission_id = rp.permission_id
        WHERE r.role_name = p_role_name
          AND p.permission_key = p_permission_key
          AND r.is_active = TRUE
          AND p.is_active = TRUE
          AND rp.is_enabled = TRUE
    ) INTO v_exists;
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Drop the old role-based module access table (now derived from permissions)
DROP TABLE IF EXISTS identity.internal_module_allowed_roles;

COMMIT;
