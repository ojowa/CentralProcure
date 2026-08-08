-- Migration 125: identity functions now match on role_key instead of role_name.
-- The JWT carries role_key, so user_has_permission / get_role_permissions /
-- get_role_modules resolve permissions by role_key; internal_login and
-- get_internal_users expose role_key alongside the display role_name.
BEGIN;

-- Signature-bearing function changes: drop before recreating.
DROP FUNCTION IF EXISTS identity.internal_login(character varying, character varying);
DROP FUNCTION IF EXISTS identity.user_has_permission(character varying, character varying);
DROP FUNCTION IF EXISTS identity.get_role_permissions(character varying);
DROP FUNCTION IF EXISTS identity.get_role_modules(character varying);
DROP FUNCTION IF EXISTS identity.get_internal_users();
DROP FUNCTION IF EXISTS identity.get_internal_user_profile(uuid);
DROP FUNCTION IF EXISTS identity.update_internal_user_profile(uuid, character varying, character varying, character varying, character varying);

-- internal_login: return role_key as the canonical `role` column.
CREATE OR REPLACE FUNCTION identity.internal_login(p_email character varying, p_password_hash character varying)
 RETURNS TABLE(internal_user_id uuid, email character varying, role_key character varying, role_name character varying, status character varying, error_message text)
 LANGUAGE plpgsql
 AS $function$
 #variable_conflict use_column
 DECLARE
     v_internal_user_id UUID;
     v_current_password_hash VARCHAR(255);
     v_role_key VARCHAR(100);
     v_role_name VARCHAR(100);
     v_status VARCHAR(50);
     v_lockout_until TIMESTAMP WITHOUT TIME ZONE;
     v_failed_attempts INT;
 BEGIN
     SELECT
         iu.internal_user_id,
         iu.password_hash,
         r.role_key,
         r.role_name,
         iu.status,
         uls.lockout_until,
         COALESCE(uls.failed_login_attempts, 0)
     INTO
         v_internal_user_id,
         v_current_password_hash,
         v_role_key,
         v_role_name,
         v_status,
         v_lockout_until,
         v_failed_attempts
     FROM
         identity.internal_users iu
         JOIN identity.roles r ON r.role_id = iu.role_id
         LEFT JOIN identity.user_login_security uls ON uls.internal_user_id = iu.internal_user_id
     WHERE
         iu.email = p_email;

     IF v_internal_user_id IS NULL THEN
         RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
         RETURN;
     END IF;

     IF v_lockout_until IS NOT NULL AND v_lockout_until > NOW() THEN
         RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account is temporarily locked. Please try again later.'::TEXT;
         RETURN;
     END IF;

     IF v_current_password_hash = p_password_hash THEN
         IF v_status = 'Active' THEN
             UPDATE identity.user_login_security
             SET failed_login_attempts = 0,
                 lockout_until = NULL,
                 updated_at = NOW()
             WHERE internal_user_id = v_internal_user_id;

             UPDATE identity.internal_users
             SET last_login = NOW(),
                 updated_at = NOW()
             WHERE internal_user_id = v_internal_user_id;

             RETURN QUERY
             SELECT
                 iu.internal_user_id,
                 iu.email,
                 r.role_key,
                 r.role_name,
                 iu.status,
                 NULL::TEXT AS error_message
             FROM
                 identity.internal_users iu
                 JOIN identity.roles r ON r.role_id = iu.role_id
             WHERE
                 iu.internal_user_id = v_internal_user_id;
         ELSE
             RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account not active'::TEXT;
         END IF;
     ELSE
         v_failed_attempts := v_failed_attempts + 1;
         IF v_failed_attempts >= 5 THEN
             v_lockout_until := NOW() + INTERVAL '15 minutes';
         ELSE
             v_lockout_until := NULL;
         END IF;

         INSERT INTO identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at)
         VALUES (v_internal_user_id, v_failed_attempts, v_lockout_until, NOW())
         ON CONFLICT (internal_user_id) DO UPDATE
         SET failed_login_attempts = v_failed_attempts,
             lockout_until = v_lockout_until,
             updated_at = NOW();

         IF v_failed_attempts >= 5 THEN
             RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account locked due to too many failed attempts. Try again in 15 minutes.'::TEXT;
         ELSE
             RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
         END IF;
     END IF;
 END;
 $function$;

-- user_has_permission: match on role_key.
CREATE OR REPLACE FUNCTION identity.user_has_permission(p_role_key character varying, p_permission_key character varying)
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

-- get_role_permissions: resolve on role_key.
CREATE OR REPLACE FUNCTION identity.get_role_permissions(p_role_key character varying)
RETURNS TABLE(permission_key character varying, module character varying, action character varying, description text)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT p.permission_key, p.module, p.action, p.description
    FROM identity.role_permissions rp
    JOIN identity.roles r ON r.role_id = rp.role_id
    JOIN identity.permissions p ON p.permission_id = rp.permission_id
    WHERE r.role_key = p_role_key
      AND r.is_active = TRUE
      AND p.is_active = TRUE
      AND rp.is_enabled = TRUE
    ORDER BY p.module, p.action;
END;
$function$;

-- get_role_modules: resolve on role_key.
CREATE OR REPLACE FUNCTION identity.get_role_modules(p_role_key character varying)
RETURNS TABLE(module_id character varying, title character varying, section character varying, description text, microservice character varying, control_purpose text, actions text[], required_permission character varying)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT m.module_id, m.title, m.section, m.description, m.microservice, m.control_purpose, m.actions, m.required_permission
    FROM identity.internal_modules m
    WHERE m.is_active = TRUE
      AND (
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
    ORDER BY m.title;
END;
$function$;

-- get_internal_users: also expose role_key.
CREATE OR REPLACE FUNCTION identity.get_internal_users()
RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, role_key character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        iu.username,
        iu.first_name,
        iu.middle_name,
        iu.surname,
        iu.service_number,
        iu.unit_id,
        ou.unit_name,
        r.role_name,
        r.role_key,
        iu.status,
        iu.last_login,
        iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    ORDER BY iu.created_at DESC;
END;
$function$;

-- get_internal_user_profile: also expose role_key.
CREATE OR REPLACE FUNCTION identity.get_internal_user_profile(p_internal_user_id uuid)
RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, role_key character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        iu.username,
        iu.first_name,
        iu.middle_name,
        iu.surname,
        iu.service_number,
        iu.unit_id,
        ou.unit_name,
        r.role_name,
        r.role_key,
        iu.status,
        iu.last_login,
        iu.created_at
    FROM
        identity.internal_users iu
        JOIN identity.roles r ON r.role_id = iu.role_id
        LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE
        iu.internal_user_id = p_internal_user_id;
END;
$function$;

-- update_internal_user_profile: return role_key alongside role_name.
CREATE OR REPLACE FUNCTION identity.update_internal_user_profile(p_internal_user_id uuid, p_username character varying, p_first_name character varying, p_middle_name character varying, p_surname character varying)
RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, role_key character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE identity.internal_users
    SET
        username = p_username,
        first_name = p_first_name,
        middle_name = NULLIF(p_middle_name, ''),
        surname = p_surname,
        updated_at = NOW()
    WHERE
        internal_users.internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT * FROM identity.get_internal_user_profile(p_internal_user_id);
END;
$function$;

COMMIT;