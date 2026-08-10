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
