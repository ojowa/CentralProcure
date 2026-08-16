-- Migration 147: Fix module grant upsert functions + get_role_modules blocking
--
-- 1. upsert_role_module_grant / upsert_user_module_grant raised
--    "column reference is ambiguous" because RETURNS TABLE OUT params
--    (role_name / internal_user_id) collide with table column names in
--    the lookup queries. Every Block/Allow edit failed as a result.
-- 2. get_role_modules only consulted internal_module_grants for modules
--    WITHOUT a required_permission, so blocking a permission-gated module
--    had no effect on visible modules. An explicit disabled grant now
--    overrides the permission-based access.

BEGIN;

-- ── 1. Fix role grant upsert ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.upsert_role_module_grant(
    p_role_name VARCHAR,
    p_module_id VARCHAR,
    p_is_enabled BOOLEAN,
    p_updated_by UUID
)
RETURNS TABLE (
    role_name VARCHAR,
    module_id VARCHAR,
    is_enabled BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_role_id UUID;
BEGIN
    SELECT r.role_id INTO v_role_id
    FROM identity.roles r
    WHERE lower(r.role_name) = lower(p_role_name)
    LIMIT 1;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found: %', p_role_name;
    END IF;

    INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled, updated_by)
    VALUES (v_role_id, p_module_id, p_is_enabled, p_updated_by)
    ON CONFLICT (role_id, module_id) WHERE role_id IS NOT NULL DO UPDATE
        SET is_enabled = EXCLUDED.is_enabled,
            updated_by = EXCLUDED.updated_by,
            updated_at = now();

    RETURN QUERY
    SELECT r.role_name,
           g.module_id,
           g.is_enabled,
           g.updated_at
    FROM identity.internal_module_grants g
    JOIN identity.roles r ON r.role_id = g.role_id
    WHERE g.role_id = v_role_id AND g.module_id = p_module_id;
END;
$$;

-- ── 2. Fix user grant upsert ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.upsert_user_module_grant(
    p_internal_user_id UUID,
    p_module_id VARCHAR,
    p_is_enabled BOOLEAN,
    p_updated_by UUID
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR,
    username VARCHAR,
    role_name VARCHAR,
    module_id VARCHAR,
    is_enabled BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM identity.internal_users iu
        WHERE iu.internal_user_id = p_internal_user_id
    ) THEN
        RAISE EXCEPTION 'Internal user not found: %', p_internal_user_id;
    END IF;

    INSERT INTO identity.internal_module_grants (internal_user_id, module_id, is_enabled, updated_by)
    VALUES (p_internal_user_id, p_module_id, p_is_enabled, p_updated_by)
    ON CONFLICT (internal_user_id, module_id) WHERE internal_user_id IS NOT NULL DO UPDATE
        SET is_enabled = EXCLUDED.is_enabled,
            updated_by = EXCLUDED.updated_by,
            updated_at = now();

    RETURN QUERY
    SELECT iu.internal_user_id,
           iu.email,
           iu.username,
           r.role_name,
           g.module_id,
           g.is_enabled,
           g.updated_at
    FROM identity.internal_module_grants g
    JOIN identity.internal_users iu ON iu.internal_user_id = g.internal_user_id
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE g.internal_user_id = p_internal_user_id AND g.module_id = p_module_id;
END;
$$;

-- ── 3. get_role_modules: explicit blocked grant overrides permissions ───
-- Module is visible when:
--   * no explicit grant for the role/module AND (permission granted OR no
--     permission required), OR
--   * explicit grant exists AND is_enabled = TRUE
-- An explicit grant with is_enabled = FALSE always blocks the module.
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
          NOT EXISTS (
              -- Explicit grant exists for this role+module
              SELECT 1
              FROM identity.internal_module_grants mg
              JOIN identity.roles r ON r.role_id = mg.role_id
              WHERE r.role_key = p_role_key
                AND r.is_active = TRUE
                AND mg.module_id = m.module_id
          )
          OR EXISTS (
              SELECT 1
              FROM identity.internal_module_grants mg
              JOIN identity.roles r ON r.role_id = mg.role_id
              WHERE r.role_key = p_role_key
                AND r.is_active = TRUE
                AND mg.module_id = m.module_id
                AND mg.is_enabled = TRUE
          )
      )
      AND (
          -- No explicit grant OR explicit grant enabled: then apply permission check
          NOT EXISTS (
              SELECT 1
              FROM identity.internal_module_grants mg
              JOIN identity.roles r ON r.role_id = mg.role_id
              WHERE r.role_key = p_role_key
                AND r.is_active = TRUE
                AND mg.module_id = m.module_id
          )
          OR (
              m.required_permission IS NULL
              OR EXISTS (
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
