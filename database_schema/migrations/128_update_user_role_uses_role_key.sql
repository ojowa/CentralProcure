-- Migration 128: update_internal_user_role matches on role_key and drops the
-- dead SystemAdministrator/ict_admin hardcode.
--
-- The API signs role_key into the JWT but this write-path still matched the
-- display role_name and cleared the unit for any of
-- ('Admin', 'SystemAdministrator', 'ict_admin'). SystemAdministrator and
-- ict_admin no longer exist (unified into Admin), so the list is dropped and
-- the function now resolves the role by role_key (the single source of truth).
BEGIN;

DROP FUNCTION IF EXISTS identity.update_internal_user_role(uuid, character varying);

CREATE OR REPLACE FUNCTION identity.update_internal_user_role(p_internal_user_id uuid, p_role_key character varying)
 RETURNS TABLE(internal_user_id uuid, email character varying, role character varying)
 LANGUAGE plpgsql
 AS $function$
 DECLARE
     v_RoleID UUID;
     v_IsSystemAdmin BOOLEAN;
 BEGIN
     SELECT role_id
     INTO v_RoleID
     FROM identity.roles
     WHERE role_key = p_role_key
       AND is_active = TRUE;

     IF v_RoleID IS NULL THEN
         RAISE EXCEPTION 'Role not found or inactive';
     END IF;

     v_IsSystemAdmin := p_role_key = 'admin';

     UPDATE identity.internal_users
     SET role_id = v_RoleID,
         unit_id = CASE WHEN v_IsSystemAdmin THEN NULL ELSE unit_id END,
         updated_at = NOW()
     WHERE internal_user_id = p_internal_user_id;

     RETURN QUERY
     SELECT
         iu.internal_user_id,
         iu.email,
         r.role_key AS role
     FROM identity.internal_users iu
     JOIN identity.roles r ON r.role_id = iu.role_id
     WHERE iu.internal_user_id = p_internal_user_id;
 END;
 $function$;

-- Drop the legacy overload that references the non-existent
-- identity."InternalUsers" / identity."InternalUserRoleAudit" tables.
DROP FUNCTION IF EXISTS identity.update_internal_user_role(uuid, character varying, character varying, text);

COMMIT;