-- Migration 065: Internal module access grants (role + user)
CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.internal_module_grants (
    grant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NULL REFERENCES identity.roles(role_id) ON DELETE CASCADE,
    internal_user_id UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    module_id VARCHAR(120) NOT NULL,
    is_enabled BOOLEAN NOT NULL,
    updated_by UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT internal_module_grants_target_chk CHECK (
        (role_id IS NOT NULL AND internal_user_id IS NULL) OR
        (role_id IS NULL AND internal_user_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_module_grants_role
    ON identity.internal_module_grants (role_id, module_id)
    WHERE role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_module_grants_user
    ON identity.internal_module_grants (internal_user_id, module_id)
    WHERE internal_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_internal_module_grants_module
    ON identity.internal_module_grants (module_id);

CREATE OR REPLACE FUNCTION identity.get_role_module_grants()
RETURNS TABLE (
    role_name VARCHAR,
    module_id VARCHAR,
    is_enabled BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
    SELECT r.role_name,
           g.module_id,
           g.is_enabled,
           g.updated_at
    FROM identity.internal_module_grants g
    JOIN identity.roles r ON r.role_id = g.role_id
    ORDER BY r.role_name ASC, g.module_id ASC;
$$;

CREATE OR REPLACE FUNCTION identity.get_user_module_grants()
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR,
    username VARCHAR,
    role_name VARCHAR,
    module_id VARCHAR,
    is_enabled BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
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
    ORDER BY iu.email ASC, g.module_id ASC;
$$;

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
DECLARE
    v_role_id UUID;
BEGIN
    SELECT role_id INTO v_role_id
    FROM identity.roles
    WHERE lower(role_name) = lower(p_role_name)
    LIMIT 1;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found: %', p_role_name;
    END IF;

    INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled, updated_by)
    VALUES (v_role_id, p_module_id, p_is_enabled, p_updated_by)
    ON CONFLICT (role_id, module_id) DO UPDATE
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
BEGIN
    IF NOT EXISTS (SELECT 1 FROM identity.internal_users WHERE internal_user_id = p_internal_user_id) THEN
        RAISE EXCEPTION 'Internal user not found: %', p_internal_user_id;
    END IF;

    INSERT INTO identity.internal_module_grants (internal_user_id, module_id, is_enabled, updated_by)
    VALUES (p_internal_user_id, p_module_id, p_is_enabled, p_updated_by)
    ON CONFLICT (internal_user_id, module_id) DO UPDATE
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
