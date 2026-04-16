BEGIN;

-- Function for Updating a Role (PostgreSQL) - FIX AMBIGUOUS COLUMN REFERENCE
CREATE OR REPLACE FUNCTION identity.update_role(
    p_role_id UUID,
    p_role_name VARCHAR(100),
    p_description TEXT,
    p_is_active BOOLEAN
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_role_name IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM identity.roles WHERE roles.role_name = p_role_name AND roles.role_id <> p_role_id) THEN
            RAISE EXCEPTION 'Role name already exists';
        END IF;
    END IF;

    UPDATE identity.roles
    SET
        role_name = COALESCE(p_role_name, roles.role_name),
        description = COALESCE(p_description, roles.description),
        is_active = COALESCE(p_is_active, roles.is_active),
        updated_at = NOW()
    WHERE roles.role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;

-- Function for Deactivating a Role (PostgreSQL) - FIX AMBIGUOUS COLUMN REFERENCE
CREATE OR REPLACE FUNCTION identity.deactivate_role(
    p_role_id UUID
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE identity.roles
    SET
        is_active = FALSE,
        updated_at = NOW()
    WHERE roles.role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;

-- Function for Deleting a Role (PostgreSQL) - FIX AMBIGUOUS COLUMN REFERENCE
CREATE OR REPLACE FUNCTION identity.delete_role(
    p_role_id UUID
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.internal_users WHERE internal_users.role_id = p_role_id) THEN
        RAISE EXCEPTION 'Role is in use and cannot be deleted';
    END IF;

    RETURN QUERY
    DELETE FROM identity.roles
    WHERE roles.role_id = p_role_id
    RETURNING roles.role_id, roles.role_name, roles.description, roles.is_active;
END;
$$;

COMMIT;
