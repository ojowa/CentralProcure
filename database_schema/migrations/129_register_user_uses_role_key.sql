-- Migration 129: register_internal_user matches on role_key and drops the
-- dead SystemAdministrator/ict_admin hardcode.
--
-- Mirrors migration 128: the write path now resolves the role by role_key
-- (the single source of truth) instead of the display role_name, and the
-- system-admin branch is keyed on role_key 'admin' rather than a hardcoded
-- list of legacy display names.
BEGIN;

DROP FUNCTION IF EXISTS identity.register_internal_user(character varying, character varying, character varying, character varying, character varying, character varying, uuid, character varying, character varying);

CREATE OR REPLACE FUNCTION identity.register_internal_user(p_email character varying, p_username character varying, p_first_name character varying, p_middle_name character varying, p_surname character varying, p_service_number character varying, p_unit_id uuid, p_password_hash character varying, p_role_key character varying)
 RETURNS TABLE(internal_user_id uuid, email character varying, role character varying, unit_id uuid, unit_name character varying)
 LANGUAGE plpgsql
 AS $function$
 DECLARE
     v_RoleID UUID;
     v_InternalUserID UUID;
     v_UnitName VARCHAR(150);
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

     IF NOT v_IsSystemAdmin THEN
         SELECT ou.unit_name
         INTO v_UnitName
         FROM identity.organizational_units ou
         WHERE ou.unit_id = p_unit_id
           AND ou.is_active = TRUE
           AND ou.is_assignable = TRUE;

         IF v_UnitName IS NULL THEN
             RAISE EXCEPTION 'Organizational unit not found or not assignable';
         END IF;
     ELSE
         v_UnitName := NULL;
         p_unit_id := NULL;
     END IF;

     INSERT INTO identity.internal_users (
         email,
         username,
         first_name,
         middle_name,
         surname,
         service_number,
         unit_id,
         password_hash,
         role_id,
         status
     )
     VALUES (
         p_email,
         p_username,
         p_first_name,
         NULLIF(p_middle_name, ''),
         p_surname,
         p_service_number,
         p_unit_id,
         p_password_hash,
         v_RoleID,
         'Active'
     )
     RETURNING internal_users.internal_user_id INTO v_InternalUserID;

     RETURN QUERY
     SELECT
         iu.internal_user_id,
         iu.email,
         r.role_key AS role,
         iu.unit_id,
         ou.unit_name
     FROM identity.internal_users iu
     JOIN identity.roles r ON r.role_id = iu.role_id
     LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
     WHERE iu.internal_user_id = v_InternalUserID;
 END;
 $function$;

COMMIT;