-- Migration 149: Harmonize module grants with role permissions
--
-- Module access (internal_module_grants) and role permissions
-- (role_permissions) were edited independently, so they could diverge:
-- blocking a permission-gated module did not remove the permission and
-- vice-versa.
--
-- This migration:
--   1. Adds sync_permission_from_module: after a module grant change,
--      updates the linked role_permission row (if the module has a
--      required_permission).
--   2. Adds sync_module_from_permission: after a role permission change,
--      updates the linked module grant row(s) (modules whose
--      required_permission matches).
--   3. Wires sync_permission_from_module into upsert_role_module_grant
--      (module access panel -> permissions stay in sync).

BEGIN;

-- ── 1. Sync role_permissions from a module grant change ──────────────────
CREATE OR REPLACE FUNCTION identity.sync_permission_from_module(
    p_role_name VARCHAR,
    p_module_id VARCHAR,
    p_is_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_id UUID;
    v_permission_key VARCHAR;
BEGIN
    -- Only permission-gated modules have a linked permission to sync
    SELECT m.required_permission INTO v_permission_key
    FROM identity.internal_modules m
    WHERE m.module_id = p_module_id
      AND m.required_permission IS NOT NULL;

    IF v_permission_key IS NULL THEN
        RETURN;
    END IF;

    SELECT r.role_id INTO v_role_id
    FROM identity.roles r
    WHERE lower(r.role_name) = lower(p_role_name)
    LIMIT 1;

    IF v_role_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
    SELECT v_role_id, p.permission_id, p_is_enabled
    FROM identity.permissions p
    WHERE p.permission_key = v_permission_key
      AND p.is_active = TRUE
    ON CONFLICT (role_id, permission_id) DO UPDATE
        SET is_enabled = EXCLUDED.is_enabled;
END;
$$;

-- ── 2. Sync module grants from a role permission change ───────────────────
CREATE OR REPLACE FUNCTION identity.sync_module_from_permission(
    p_role_name VARCHAR,
    p_permission_key VARCHAR,
    p_is_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT r.role_id INTO v_role_id
    FROM identity.roles r
    WHERE lower(r.role_name) = lower(p_role_name)
    LIMIT 1;

    IF v_role_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
    SELECT v_role_id, m.module_id, p_is_enabled
    FROM identity.internal_modules m
    WHERE m.required_permission = p_permission_key
      AND m.is_active = TRUE
    ON CONFLICT (role_id, module_id) WHERE role_id IS NOT NULL DO UPDATE
        SET is_enabled = EXCLUDED.is_enabled,
            updated_at = now();
END;
$$;

-- ── 3. Module grant upsert now keeps the linked permission in sync ────────
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

    -- Keep the linked permission in sync
    PERFORM identity.sync_permission_from_module(p_role_name, p_module_id, p_is_enabled);

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

COMMIT;