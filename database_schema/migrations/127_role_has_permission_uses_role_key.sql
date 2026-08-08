-- Migration 127: role_has_permission now matches on role_key.
-- The API passes the JWT role (role_key) to this function; the previous
-- definition matched identity.roles.role_name, so permission checks would
-- silently resolve against the wrong role.
BEGIN;

DROP FUNCTION IF EXISTS identity.role_has_permission(character varying, character varying);

CREATE OR REPLACE FUNCTION identity.role_has_permission(p_role_key character varying, p_permission_key character varying)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM identity.role_permissions rp
        JOIN identity.roles r ON r.role_id = rp.role_id
        JOIN identity.permissions p ON p.permission_id = rp.permission_id
        WHERE r.role_key = p_role_key
          AND p.permission_key = p_permission_key
          AND r.is_active = TRUE
          AND p.is_active = TRUE
          AND rp.is_enabled = TRUE
    ) INTO v_exists;
    RETURN v_exists;
END;
$function$;

COMMIT;