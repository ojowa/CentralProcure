-- ============================================================================
-- MIGRATION 152: AUDIT LOGGING
-- Restores audit trail for role changes, adds field-level profile audit.
-- ============================================================================

-- ─────────────────────────────────────────────
-- 1. Restore audit logging in update_internal_user_role
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.update_internal_user_role(
    p_internal_user_id UUID,
    p_role_key VARCHAR,
    p_changed_by UUID DEFAULT NULL,
    p_change_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR,
    role VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_RoleID UUID;
    v_OldRoleID UUID;
    v_IsSystemAdmin BOOLEAN;
BEGIN
    SELECT role_id INTO v_RoleID
    FROM identity.roles
    WHERE role_key = p_role_key AND is_active = TRUE;

    IF v_RoleID IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    -- Capture old role for audit
    SELECT iu.role_id INTO v_OldRoleID
    FROM identity.internal_users iu
    WHERE iu.internal_user_id = p_internal_user_id;

    v_IsSystemAdmin := p_role_key = 'admin';

    UPDATE identity.internal_users AS iu
    SET role_id = v_RoleID,
        unit_id = CASE WHEN v_IsSystemAdmin THEN NULL ELSE iu.unit_id END,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    -- Record audit trail
    INSERT INTO identity.user_role_audit (
        target_internal_user_id,
        previous_role_id,
        new_role_id,
        changed_by_user_id,
        change_reason
    )
    VALUES (
        p_internal_user_id,
        v_OldRoleID,
        v_RoleID,
        p_changed_by,
        p_change_reason
    );

    RETURN QUERY
    SELECT iu.internal_user_id, iu.email, r.role_key AS role
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 2. User profile audit table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity.user_profile_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_internal_user_id UUID NOT NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by_user_id UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_profile_audit_target
    ON identity.user_profile_audit (target_internal_user_id);

CREATE INDEX IF NOT EXISTS ix_user_profile_audit_changed_at
    ON identity.user_profile_audit (changed_at DESC);

-- ─────────────────────────────────────────────
-- 3. Update update_internal_user to audit field changes
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.update_internal_user(
    p_internal_user_id UUID,
    p_email VARCHAR,
    p_username VARCHAR,
    p_first_name VARCHAR,
    p_middle_name VARCHAR,
    p_surname VARCHAR,
    p_service_number VARCHAR,
    p_unit_id UUID,
    p_is_active BOOLEAN,
    p_changed_by UUID DEFAULT NULL
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR,
    username VARCHAR,
    first_name VARCHAR,
    middle_name VARCHAR,
    surname VARCHAR,
    service_number VARCHAR,
    unit_id UUID,
    unit_name VARCHAR,
    role_name VARCHAR,
    role_key VARCHAR,
    status VARCHAR,
    last_login TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_RoleKey VARCHAR(100);
    v_IsSystemAdmin BOOLEAN;
    v_UnitIdToUse UUID := p_unit_id;
    v_OldEmail VARCHAR;
    v_OldUsername VARCHAR;
    v_OldFirstName VARCHAR;
    v_OldMiddleName VARCHAR;
    v_OldSurname VARCHAR;
    v_OldServiceNumber VARCHAR;
    v_OldUnitId UUID;
    v_OldIsActive BOOLEAN;
BEGIN
    SELECT r.role_key INTO v_RoleKey
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;

    v_IsSystemAdmin := v_RoleKey = 'admin';
    IF v_IsSystemAdmin THEN v_UnitIdToUse := NULL; END IF;

    -- Capture old values for audit
    SELECT email, username, first_name, middle_name, surname,
           service_number, unit_id, is_active
    INTO v_OldEmail, v_OldUsername, v_OldFirstName, v_OldMiddleName,
         v_OldSurname, v_OldServiceNumber, v_OldUnitId, v_OldIsActive
    FROM identity.internal_users
    WHERE internal_user_id = p_internal_user_id;

    -- Perform the update
    UPDATE identity.internal_users AS iu
    SET email = p_email,
        username = p_username,
        first_name = p_first_name,
        middle_name = NULLIF(p_middle_name, ''),
        surname = p_surname,
        service_number = p_service_number,
        unit_id = v_UnitIdToUse,
        is_active = p_is_active,
        status = CASE WHEN p_is_active THEN 'Active' ELSE 'Inactive' END,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    -- Audit each changed field
    IF COALESCE(v_OldEmail, '') != COALESCE(p_email, '') THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'email', v_OldEmail, p_email, p_changed_by);
    END IF;
    IF COALESCE(v_OldUsername, '') != COALESCE(p_username, '') THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'username', v_OldUsername, p_username, p_changed_by);
    END IF;
    IF COALESCE(v_OldFirstName, '') != COALESCE(p_first_name, '') THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'first_name', v_OldFirstName, p_first_name, p_changed_by);
    END IF;
    IF COALESCE(v_OldMiddleName, '') != COALESCE(NULLIF(p_middle_name, ''), '') THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'middle_name', v_OldMiddleName, NULLIF(p_middle_name, ''), p_changed_by);
    END IF;
    IF COALESCE(v_OldSurname, '') != COALESCE(p_surname, '') THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'surname', v_OldSurname, p_surname, p_changed_by);
    END IF;
    IF COALESCE(v_OldServiceNumber, '') != COALESCE(p_service_number, '') THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'service_number', v_OldServiceNumber, p_service_number, p_changed_by);
    END IF;
    IF v_OldUnitId IS DISTINCT FROM v_UnitIdToUse THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'unit_id', v_OldUnitId::text, v_UnitIdToUse::text, p_changed_by);
    END IF;
    IF v_OldIsActive IS DISTINCT FROM p_is_active THEN
        INSERT INTO identity.user_profile_audit (target_internal_user_id, field_name, old_value, new_value, changed_by_user_id)
        VALUES (p_internal_user_id, 'is_active', v_OldIsActive::text, p_is_active::text, p_changed_by);
    END IF;

    RETURN QUERY
    SELECT iu.internal_user_id, iu.email, iu.username, iu.first_name,
           iu.middle_name, iu.surname, iu.service_number, iu.unit_id,
           ou.unit_name, r.role_name, r.role_key, iu.status,
           iu.last_login, iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;
