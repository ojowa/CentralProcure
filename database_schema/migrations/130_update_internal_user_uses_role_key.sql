-- Migration 130: update_internal_user uses role_key for the system-admin
-- branch; drop the legacy update_internal_user_status overload that targets
-- the non-existent identity."InternalUsers" table.
BEGIN;

DROP FUNCTION IF EXISTS identity.update_internal_user_status(uuid, boolean, character varying, text);

DROP FUNCTION IF EXISTS identity.update_internal_user(uuid, character varying, character varying, character varying, character varying, character varying, character varying, uuid, boolean);

CREATE OR REPLACE FUNCTION identity.update_internal_user(p_internal_user_id uuid, p_email character varying, p_username character varying, p_first_name character varying, p_middle_name character varying, p_surname character varying, p_service_number character varying, p_unit_id uuid, p_is_active boolean)
 RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, role_key character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
 LANGUAGE plpgsql
 AS $function$
 DECLARE
     v_RoleKey VARCHAR(100);
     v_IsSystemAdmin BOOLEAN;
     v_UnitIdToUse UUID := p_unit_id;
 BEGIN
     SELECT r.role_key
     INTO v_RoleKey
     FROM identity.internal_users iu
     JOIN identity.roles r ON r.role_id = iu.role_id
     WHERE iu.internal_user_id = p_internal_user_id;

     v_IsSystemAdmin := v_RoleKey = 'admin';

     IF v_IsSystemAdmin THEN
         v_UnitIdToUse := NULL;
     END IF;

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
     WHERE iu.internal_user_id = p_internal_user_id;
 END;
 $function$;

COMMIT;