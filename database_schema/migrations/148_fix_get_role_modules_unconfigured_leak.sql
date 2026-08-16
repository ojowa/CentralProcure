-- Migration 148: Fix get_role_modules - unconfigured modules leaked access
--
-- Migration 147 introduced a regression: modules with NO grant row at all
-- passed the visibility check unconditionally, so a role with only a few
-- configured grants (e.g. Department Officer) still saw every active module.
--
-- Correct rule:
--   A module is visible for a role iff:
--     1. it is not explicitly blocked (no disabled grant), AND
--     2. (a) it has an enabled grant, OR
--        (b) no grant row exists AND the module is permission-gated AND the
--            role holds that permission.
--
-- Non-permission-gated modules therefore require an explicit enabled grant,
-- while permission-gated modules are granted through role_permissions unless
-- an explicit block (disabled grant) exists.

BEGIN;

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
      -- 1. Not explicitly blocked
      AND NOT EXISTS (
          SELECT 1
          FROM identity.internal_module_grants mg
          JOIN identity.roles r ON r.role_id = mg.role_id
          WHERE r.role_key = p_role_key
            AND r.is_active = TRUE
            AND mg.module_id = m.module_id
            AND mg.is_enabled = FALSE
      )
      -- 2. Enabled grant OR (no grant AND permission-gated AND permission held)
      AND (
          EXISTS (
              SELECT 1
              FROM identity.internal_module_grants mg
              JOIN identity.roles r ON r.role_id = mg.role_id
              WHERE r.role_key = p_role_key
                AND r.is_active = TRUE
                AND mg.module_id = m.module_id
                AND mg.is_enabled = TRUE
          )
          OR (
              NOT EXISTS (
                  SELECT 1
                  FROM identity.internal_module_grants mg
                  JOIN identity.roles r ON r.role_id = mg.role_id
                  WHERE r.role_key = p_role_key
                    AND r.is_active = TRUE
                    AND mg.module_id = m.module_id
              )
              AND m.required_permission IS NOT NULL
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
      )
    ORDER BY m.title;
END;
$$;

COMMIT;