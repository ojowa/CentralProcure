--
-- PostgreSQL database dump
--

\restrict vINDmwy9D46dp7MnOXGoUm7Qjb7G9k3rN3W4bkzZYH1glRICjwbrHGZdbDdZt3S

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: governance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA governance;


--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA identity;


--
-- Name: post_award; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA post_award;


--
-- Name: procurement_workflow; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA procurement_workflow;


--
-- Name: vendor_sourcing; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vendor_sourcing;


--
-- Name: approve_vendor_registration(uuid, character varying, character varying, text); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.approve_vendor_registration(p_vendor_id uuid, p_vendor_status character varying, p_updated_by character varying, p_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE identity.vendors
    SET
        vendor_status = p_vendor_status,
        is_active = CASE WHEN p_vendor_status = 'Active' THEN TRUE ELSE FALSE END,
        updated_by = COALESCE(NULLIF(BTRIM(p_updated_by), ''), CURRENT_USER),
        updated_at = NOW()
    WHERE vendor_id = p_vendor_id;

    -- Review notes are accepted for API compatibility and future audit persistence.
    PERFORM p_notes;
END;
$$;


--
-- Name: create_internal_user(character varying, character varying, character varying, character varying, text); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.create_internal_user(p_email character varying, p_fullname character varying, p_role character varying, p_actedbyemail character varying, p_reason text) RETURNS TABLE("Id" uuid, "Email" character varying, "FullName" character varying, "Role" character varying, "IsActive" boolean, "UpdatedAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id UUID := gen_random_uuid();
    v_email VARCHAR(255) := LOWER(TRIM(p_email));
BEGIN
    IF v_email IS NULL OR v_email = '' OR RIGHT(v_email, 11) <> '@nis.gov.ng' THEN
        RAISE EXCEPTION 'Only official @nis.gov.ng accounts are allowed.';
    END IF;

    INSERT INTO identity."InternalUsers" ("Id", "Email", "FullName", "Role", "IsActive", "UpdatedAt")
    VALUES (v_id, v_email, TRIM(p_fullname), TRIM(p_role), TRUE, CURRENT_TIMESTAMP);

    INSERT INTO identity."InternalUserRoleAudit" (
        "Id", "ActedByEmail", "Action", "TargetUserEmail", "PreviousRole", "NewRole", "Reason", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        LOWER(TRIM(p_actedbyemail)),
        'CREATE_USER',
        v_email,
        NULL,
        TRIM(p_role),
        NULLIF(TRIM(p_reason), ''),
        CURRENT_TIMESTAMP
    );

    RETURN QUERY
    SELECT
        iu."Id",
        iu."Email",
        iu."FullName",
        iu."Role",
        iu."IsActive",
        iu."UpdatedAt"
    FROM identity."InternalUsers" iu
    WHERE iu."Id" = v_id;
END;
$$;


--
-- Name: create_internal_user(uuid, character varying, character varying, character varying, character varying, character varying, text); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.create_internal_user(p_userid uuid, p_servicenumber character varying, p_email character varying, p_fullname character varying, p_role character varying, p_actedbyemail character varying, p_reason text) RETURNS TABLE("Id" uuid, "Email" character varying, "FullName" character varying, "Role" character varying, "ServiceNumber" character varying, "IsActive" boolean, "UpdatedAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id UUID := COALESCE(p_userid, gen_random_uuid());
    v_email VARCHAR(255) := LOWER(TRIM(p_email));
BEGIN
    IF v_email IS NULL OR v_email = '' OR RIGHT(v_email, 11) <> '@nis.gov.ng' THEN
        RAISE EXCEPTION 'Only official @nis.gov.ng accounts are allowed.';
    END IF;

    INSERT INTO identity."InternalUsers" ("Id", "Email", "FullName", "Role", "ServiceNumber", "IsActive", "UpdatedAt")
    VALUES (v_id, v_email, TRIM(p_fullname), TRIM(p_role), NULLIF(TRIM(p_servicenumber), ''), TRUE, CURRENT_TIMESTAMP);

    INSERT INTO identity."InternalUserRoleAudit" (
        "Id", "ActedByEmail", "Action", "TargetUserEmail", "PreviousRole", "NewRole", "Reason", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        LOWER(TRIM(p_actedbyemail)),
        'CREATE_USER',
        v_email,
        NULL,
        TRIM(p_role),
        NULLIF(TRIM(p_reason), ''),
        CURRENT_TIMESTAMP
    );

    RETURN QUERY
    SELECT
        iu."Id",
        iu."Email",
        iu."FullName",
        iu."Role",
        iu."ServiceNumber",
        iu."IsActive",
        iu."UpdatedAt"
    FROM identity."InternalUsers" iu
    WHERE iu."Id" = v_id;
END;
$$;


--
-- Name: create_internal_user_proc(character varying, character varying, character varying, character varying, text); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.create_internal_user_proc(IN p_email character varying, IN p_fullname character varying, IN p_role character varying, IN p_actedbyemail character varying, IN p_reason text)
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."CreateInternalUser"(p_email, p_fullname, p_role, p_actedbyemail, p_reason);
$$;


--
-- Name: create_internal_user_proc(uuid, character varying, character varying, character varying, character varying, character varying, text); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.create_internal_user_proc(IN p_userid uuid, IN p_servicenumber character varying, IN p_email character varying, IN p_fullname character varying, IN p_role character varying, IN p_actedbyemail character varying, IN p_reason text)
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."CreateInternalUser"(p_userid, p_servicenumber, p_email, p_fullname, p_role, p_actedbyemail, p_reason);
$$;


--
-- Name: create_role(character varying, text); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.create_role(p_role_name character varying, p_description text) RETURNS TABLE(role_id uuid, role_name character varying, description text, is_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    INSERT INTO identity.roles (role_name, description)
    VALUES (p_role_name, p_description)
    RETURNING roles.role_id, roles.role_name, roles.description, roles.is_active;
END;
$$;


--
-- Name: create_role_sp(character varying, text); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.create_role_sp(IN p_role_name character varying, IN p_description text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.create_role(p_role_name, p_description);
END;
$$;


--
-- Name: deactivate_role(uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.deactivate_role(p_role_id uuid) RETURNS TABLE(role_id uuid, role_name character varying, description text, is_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE identity.roles
    SET
        is_active = FALSE,
        updated_at = NOW()
    WHERE role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;


--
-- Name: deactivate_role_sp(uuid); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.deactivate_role_sp(IN p_role_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.deactivate_role(p_role_id);
END;
$$;


--
-- Name: delete_role(uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.delete_role(p_role_id uuid) RETURNS TABLE(role_id uuid, role_name character varying, description text, is_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.internal_users WHERE role_id = p_role_id) THEN
        RAISE EXCEPTION 'Role is in use and cannot be deleted';
    END IF;

    RETURN QUERY
    DELETE FROM identity.roles
    WHERE role_id = p_role_id
    RETURNING roles.role_id, roles.role_name, roles.description, roles.is_active;
END;
$$;


--
-- Name: delete_role_sp(uuid); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.delete_role_sp(IN p_role_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.delete_role(p_role_id);
END;
$$;


--
-- Name: ensure_internal_user_seed(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.ensure_internal_user_seed() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO identity."InternalUsers" ("Id", "Email", "FullName", "Role", "IsActive", "UpdatedAt")
    VALUES
        ('11111111-1111-1111-1111-111111111111', 'ict-admin@nis.gov.ng', 'Platform Administrator', 'ict_admin', TRUE, CURRENT_TIMESTAMP),
        ('22222222-2222-2222-2222-222222222222', 'staff@nis.gov.ng', 'Department Staff', 'department_user', TRUE, CURRENT_TIMESTAMP),
        ('33333333-3333-3333-3333-333333333333', 'procurement.officer@nis.gov.ng', 'Procurement Officer', 'procurement_officer', TRUE, CURRENT_TIMESTAMP),
        ('44444444-4444-4444-4444-444444444444', 'evaluation.committee@nis.gov.ng', 'Evaluation Committee Officer', 'evaluation_committee', TRUE, CURRENT_TIMESTAMP),
        ('55555555-5555-5555-5555-555555555555', 'tenders.board@nis.gov.ng', 'Tenders Board Officer', 'tenders_board', TRUE, CURRENT_TIMESTAMP),
        ('66666666-6666-6666-6666-666666666666', 'accounting.officer@nis.gov.ng', 'Accounting Officer', 'accounting_officer', TRUE, CURRENT_TIMESTAMP),
        ('77777777-7777-7777-7777-777777777777', 'audit.oversight@nis.gov.ng', 'Audit Oversight Officer', 'audit_oversight', TRUE, CURRENT_TIMESTAMP)
    ON CONFLICT ("Email") DO NOTHING;
END;
$$;


--
-- Name: ensure_internal_user_seed_proc(); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.ensure_internal_user_seed_proc()
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM identity."EnsureInternalUserSeed"();
END;
$$;


--
-- Name: get_internal_user_by_email(character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_internal_user_by_email(p_email character varying) RETURNS TABLE("Id" uuid, "Email" character varying, "FullName" character varying, "Role" character varying, "ServiceNumber" character varying, "IsActive" boolean, "UpdatedAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        iu."Id",
        iu."Email",
        iu."FullName",
        iu."Role",
        iu."ServiceNumber",
        iu."IsActive",
        iu."UpdatedAt"
    FROM identity."InternalUsers" iu
    WHERE iu."Email" = LOWER(TRIM(p_email))
    LIMIT 1;
END;
$$;


--
-- Name: get_internal_user_by_email_proc(character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_internal_user_by_email_proc(IN p_email character varying)
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."GetInternalUserByEmail"(p_email);
$$;


--
-- Name: get_internal_user_profile(uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_internal_user_profile(p_internal_user_id uuid) RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: get_internal_user_profile_sp(uuid); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_internal_user_profile_sp(IN p_internal_user_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_internal_user_profile(p_internal_user_id);
END;
$$;


--
-- Name: get_internal_users(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_internal_users() RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
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
        iu.status,
        iu.last_login,
        iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    ORDER BY iu.created_at DESC;
END;
$$;


--
-- Name: get_internal_users_sp(); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_internal_users_sp(OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_internal_users();
END;
$$;


--
-- Name: get_role_module_grants(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_role_module_grants() RETURNS TABLE(role_name character varying, module_id character varying, is_enabled boolean, updated_at timestamp with time zone)
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


--
-- Name: get_roles(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_roles() RETURNS TABLE(role_id uuid, role_name character varying, description text, is_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.role_id,
        r.role_name,
        r.description,
        r.is_active
    FROM
        identity.roles r
    ORDER BY
        r.role_name ASC;
END;
$$;


--
-- Name: get_roles_sp(); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_roles_sp(OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_roles();
END;
$$;


--
-- Name: get_user_module_grants(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_user_module_grants() RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, role_name character varying, module_id character varying, is_enabled boolean, updated_at timestamp with time zone)
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


--
-- Name: get_vendor_by_email(character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_vendor_by_email(p_email character varying) RETURNS TABLE("VendorID" uuid, "CompanyName" character varying, "Email" character varying, "VendorStatus" character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        v."VendorID",
        v."CompanyName",
        v."Email",
        v."VendorStatus"
    FROM identity."Vendors" v
    WHERE lower(v."Email") = lower(p_Email)
    LIMIT 1;
END;
$$;


--
-- Name: get_vendor_by_email_proc(character varying, uuid, character varying, character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_vendor_by_email_proc(IN p_email character varying, INOUT p_vendorid uuid DEFAULT NULL::uuid, INOUT p_companyname character varying DEFAULT NULL::character varying, INOUT p_email_out character varying DEFAULT NULL::character varying, INOUT p_vendorstatus character varying DEFAULT NULL::character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT
        gv."VendorID",
        gv."CompanyName",
        gv."Email",
        gv."VendorStatus"
    INTO
        p_vendorid,
        p_companyname,
        p_email_out,
        p_vendorstatus
    FROM identity."GetVendorByEmail"(p_email) gv;
END;
$$;


--
-- Name: get_vendor_compliance_document_history(uuid, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_vendor_compliance_document_history(p_vendor_id uuid, p_document_type character varying) RETURNS TABLE(history_id uuid, document_id uuid, document_type character varying, document_url text, expiry_date date, verification_status character varying, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.history_id,
        h.document_id,
        h.document_type,
        h.document_url,
        h.expiry_date,
        h.verification_status,
        h.created_at
    FROM identity.compliance_document_history h
    WHERE h.vendor_id = p_vendor_id
      AND h.document_type = p_document_type
    ORDER BY h.created_at DESC;
END;
$$;


--
-- Name: get_vendor_compliance_document_history_sp(uuid, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_vendor_compliance_document_history_sp(IN p_vendor_id uuid, IN p_document_type character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_compliance_document_history(p_vendor_id, p_document_type);
END;
$$;


--
-- Name: get_vendor_compliance_documents(uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_vendor_compliance_documents(p_vendor_id uuid) RETURNS TABLE(document_id uuid, vendor_id uuid, document_type character varying, document_url text, expiry_date date, verification_status character varying, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.document_id,
        cd.vendor_id,
        cd.document_type,
        cd.document_url,
        cd.expiry_date,
        cd.verification_status,
        cd.created_at
    FROM identity.compliance_documents cd
    WHERE cd.vendor_id = p_vendor_id
    ORDER BY cd.created_at DESC;
END;
$$;


--
-- Name: get_vendor_compliance_documents_sp(uuid); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_vendor_compliance_documents_sp(IN p_vendor_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_compliance_documents(p_vendor_id);
END;
$$;


--
-- Name: get_vendor_profile(uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.get_vendor_profile(p_vendor_id uuid) RETURNS TABLE(vendor_id uuid, company_name character varying, registration_number character varying, tax_id character varying, company_address text, contact_person character varying, phone_number character varying, email character varying, registration_date timestamp without time zone, last_login timestamp without time zone, vendor_status character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.vendor_id,
        v.company_name,
        v.registration_number,
        v.tax_id,
        v.company_address,
        v.contact_person,
        v.phone_number,
        v.email,
        v.registration_date,
        v.last_login,
        v.vendor_status
    FROM identity.vendors v
    WHERE v.vendor_id = p_vendor_id;
END;
$$;


--
-- Name: get_vendor_profile_sp(uuid); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.get_vendor_profile_sp(IN p_vendor_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_profile(p_vendor_id);
END;
$$;


--
-- Name: internal_login(character varying, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.internal_login(p_email character varying, p_password_hash character varying) RETURNS TABLE(internal_user_id uuid, email character varying, role character varying, status character varying, error_message text)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
DECLARE
    v_internal_user_id UUID;
    v_current_password_hash VARCHAR(255);
    v_role_name VARCHAR(100);
    v_status VARCHAR(50);
    v_lockout_until TIMESTAMP WITHOUT TIME ZONE;
    v_failed_attempts INT;
BEGIN
    -- Get user and security info
    SELECT
        iu.internal_user_id,
        iu.password_hash,
        r.role_name,
        iu.status,
        uls.lockout_until,
        COALESCE(uls.failed_login_attempts, 0)
    INTO
        v_internal_user_id,
        v_current_password_hash,
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

    -- Check if user exists
    IF v_internal_user_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        RETURN;
    END IF;

    -- Check for lockout
    IF v_lockout_until IS NOT NULL AND v_lockout_until > NOW() THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account is temporarily locked. Please try again later.'::TEXT;
        RETURN;
    END IF;

    IF v_current_password_hash = p_password_hash THEN
        IF v_status = 'Active' THEN
            -- Success: Reset security table
            INSERT INTO identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at)
            VALUES (v_internal_user_id, 0, NULL, NOW())
            ON CONFLICT (internal_user_id) DO UPDATE
            SET failed_login_attempts = 0,
                lockout_until = NULL,
                updated_at = NOW();

            -- Update last_login
            UPDATE identity.internal_users
            SET last_login = NOW(),
                updated_at = NOW()
            WHERE internal_user_id = v_internal_user_id;

            RETURN QUERY
            SELECT
                iu.internal_user_id,
                iu.email,
                r.role_name AS role,
                iu.status,
                NULL::TEXT AS error_message
            FROM
                identity.internal_users iu
                JOIN identity.roles r ON r.role_id = iu.role_id
            WHERE
                iu.internal_user_id = v_internal_user_id;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account not active'::TEXT;
        END IF;
    ELSE
        -- Failure: Increment attempts and set lockout if threshold reached
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
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account locked due to too many failed attempts. Try again in 15 minutes.'::TEXT;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        END IF;
    END IF;
END;
$$;


--
-- Name: internal_login_sp(character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.internal_login_sp(IN p_email character varying, IN p_password_hash character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.internal_login(
        p_email,
        p_password_hash
    );
END;
$$;


--
-- Name: list_internal_user_role_audit(integer); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.list_internal_user_role_audit(p_limit integer DEFAULT 50) RETURNS TABLE("Id" uuid, "ActedByEmail" character varying, "Action" character varying, "TargetUserEmail" character varying, "PreviousRole" character varying, "NewRole" character varying, "Reason" text, "OccurredAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a."Id",
        a."ActedByEmail",
        a."Action",
        a."TargetUserEmail",
        a."PreviousRole",
        a."NewRole",
        a."Reason",
        a."OccurredAt"
    FROM identity."InternalUserRoleAudit" a
    ORDER BY a."OccurredAt" DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
END;
$$;


--
-- Name: list_internal_user_role_audit_proc(integer); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.list_internal_user_role_audit_proc(IN p_limit integer DEFAULT 50)
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."ListInternalUserRoleAudit"(p_limit);
$$;


--
-- Name: list_internal_users(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.list_internal_users() RETURNS TABLE("Id" uuid, "Email" character varying, "FullName" character varying, "Role" character varying, "ServiceNumber" character varying, "IsActive" boolean, "UpdatedAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        iu."Id",
        iu."Email",
        iu."FullName",
        iu."Role",
        iu."ServiceNumber",
        iu."IsActive",
        iu."UpdatedAt"
    FROM identity."InternalUsers" iu
    ORDER BY iu."FullName" ASC;
END;
$$;


--
-- Name: list_internal_users_proc(); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.list_internal_users_proc()
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."ListInternalUsers"();
$$;


--
-- Name: login_vendor(character varying, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.login_vendor(p_email character varying, p_password_hash character varying) RETURNS TABLE(vendor_id uuid, company_name character varying, email character varying, vendor_status character varying, error_message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_vendor_id UUID;
    v_password_hash VARCHAR(255);
    v_company_name VARCHAR(255);
    v_status VARCHAR(50);
BEGIN
    SELECT
        v.vendor_id,
        v.password_hash,
        v.company_name,
        v.vendor_status
    INTO
        v_vendor_id,
        v_password_hash,
        v_company_name,
        v_status
    FROM identity.vendors v
    WHERE v.email = p_email;

    IF v_vendor_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        RETURN;
    END IF;

    IF v_password_hash <> p_password_hash THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        RETURN;
    END IF;

    IF v_status <> 'Active' THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, v_status, 'Account not active'::TEXT;
        RETURN;
    END IF;

    UPDATE identity.vendors v
    SET last_login = NOW(),
        updated_at = NOW()
    WHERE v.vendor_id = v_vendor_id;

    RETURN QUERY
    SELECT
        v.vendor_id,
        v.company_name,
        v.email,
        v.vendor_status,
        NULL::TEXT AS error_message
    FROM identity.vendors v
    WHERE v.vendor_id = v_vendor_id;
END;
$$;


--
-- Name: login_vendor_proc(character varying, character varying, uuid, character varying, character varying, character varying, text); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.login_vendor_proc(IN p_email character varying, IN p_passwordhash character varying, INOUT p_vendorid uuid DEFAULT NULL::uuid, INOUT p_companyname_out character varying DEFAULT NULL::character varying, INOUT p_email_out character varying DEFAULT NULL::character varying, INOUT p_vendorstatus character varying DEFAULT NULL::character varying, INOUT p_errormessage text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT
        lv."VendorID",
        lv."CompanyName",
        lv."Email",
        lv."VendorStatus",
        lv."ErrorMessage"
    INTO
        p_vendorid,
        p_companyname_out,
        p_email_out,
        p_vendorstatus,
        p_errormessage
    FROM identity."LoginVendor"(p_email, p_passwordhash) lv;
END;
$$;


--
-- Name: login_vendor_sp(character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.login_vendor_sp(IN p_email character varying, IN p_password_hash character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.login_vendor(
        p_email,
        p_password_hash
    );
END;
$$;


--
-- Name: register_internal_user(character varying, character varying, character varying, character varying, character varying, character varying, uuid, character varying, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.register_internal_user(p_email character varying, p_username character varying, p_first_name character varying, p_middle_name character varying, p_surname character varying, p_service_number character varying, p_unit_id uuid, p_password_hash character varying, p_role_name character varying) RETURNS TABLE(internal_user_id uuid, email character varying, role character varying, unit_id uuid, unit_name character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_RoleID UUID;
    v_InternalUserID UUID;
    v_UnitName VARCHAR(150);
BEGIN
    SELECT role_id
    INTO v_RoleID
    FROM identity.roles
    WHERE role_name = p_role_name
      AND is_active = TRUE;

    IF v_RoleID IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    SELECT ou.unit_name
    INTO v_UnitName
    FROM identity.organizational_units ou
    WHERE ou.unit_id = p_unit_id
      AND ou.is_active = TRUE
      AND ou.is_assignable = TRUE;

    IF v_UnitName IS NULL THEN
        RAISE EXCEPTION 'Organizational unit not found or not assignable';
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
        r.role_name AS role,
        iu.unit_id,
        ou.unit_name
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE iu.internal_user_id = v_InternalUserID;
END;
$$;


--
-- Name: register_internal_user_sp(character varying, character varying, character varying, character varying, character varying, character varying, uuid, character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.register_internal_user_sp(IN p_email character varying, IN p_username character varying, IN p_first_name character varying, IN p_middle_name character varying, IN p_surname character varying, IN p_service_number character varying, IN p_unit_id uuid, IN p_password_hash character varying, IN p_role_name character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.register_internal_user(
        p_email,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname,
        p_service_number,
        p_unit_id,
        p_password_hash,
        p_role_name
    );
END;
$$;


--
-- Name: register_vendor(character varying, character varying, character varying, text, character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.register_vendor(p_company_name character varying, p_registration_number character varying, p_tax_id character varying, p_company_address text, p_contact_person character varying, p_phone_number character varying, p_email character varying, p_password_hash character varying) RETURNS TABLE(vendor_id uuid, company_name character varying, email character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    INSERT INTO identity.vendors (
        company_name,
        registration_number,
        tax_id,
        company_address,
        contact_person,
        phone_number,
        email,
        password_hash,
        vendor_status
    )
    VALUES (
        p_company_name,
        p_registration_number,
        p_tax_id,
        p_company_address,
        p_contact_person,
        NULLIF(p_phone_number, ''),
        p_email,
        p_password_hash,
        'Pending Approval'
    )
    RETURNING vendors.vendor_id, vendors.company_name, vendors.email;
END;
$$;


--
-- Name: register_vendor_proc(character varying, character varying, character varying, text, character varying, character varying, character varying, uuid, character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.register_vendor_proc(IN p_companyname character varying, IN p_registrationnumber character varying, IN p_taxid character varying, IN p_companyaddress text, IN p_contactperson character varying, IN p_email character varying, IN p_passwordhash character varying, INOUT p_vendorid uuid DEFAULT NULL::uuid, INOUT p_companyname_out character varying DEFAULT NULL::character varying, INOUT p_email_out character varying DEFAULT NULL::character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT
        rv."VendorID",
        rv."CompanyName",
        rv."Email"
    INTO
        p_vendorid,
        p_companyname_out,
        p_email_out
    FROM identity."RegisterVendor"(
        p_companyname,
        p_registrationnumber,
        p_taxid,
        p_companyaddress,
        p_contactperson,
        p_email,
        p_passwordhash
    ) rv;
END;
$$;


--
-- Name: register_vendor_sp(character varying, character varying, character varying, text, character varying, character varying, character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.register_vendor_sp(IN p_company_name character varying, IN p_registration_number character varying, IN p_tax_id character varying, IN p_company_address text, IN p_contact_person character varying, IN p_phone_number character varying, IN p_email character varying, IN p_password_hash character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.register_vendor(
        p_company_name,
        p_registration_number,
        p_tax_id,
        p_company_address,
        p_contact_person,
        p_phone_number,
        p_email,
        p_password_hash
    );
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := NOW();
    -- keep updated_by defaulting; allow app to override if it sets it explicitly
    IF NEW.updated_by IS NULL THEN
        NEW.updated_by := CURRENT_USER;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_internal_user(uuid, character varying, character varying, character varying, character varying, character varying, character varying, uuid, boolean); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_internal_user(p_internal_user_id uuid, p_email character varying, p_username character varying, p_first_name character varying, p_middle_name character varying, p_surname character varying, p_service_number character varying, p_unit_id uuid, p_is_active boolean) RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE identity.internal_users AS iu
    SET email = p_email,
        username = p_username,
        first_name = p_first_name,
        middle_name = NULLIF(p_middle_name, ''),
        surname = p_surname,
        service_number = p_service_number,
        unit_id = p_unit_id,
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
        iu.status,
        iu.last_login,
        iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;


--
-- Name: update_internal_user_profile(uuid, character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_internal_user_profile(p_internal_user_id uuid, p_username character varying, p_first_name character varying, p_middle_name character varying, p_surname character varying) RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, first_name character varying, middle_name character varying, surname character varying, service_number character varying, unit_id uuid, unit_name character varying, role_name character varying, status character varying, last_login timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_internal_user_profile_sp(uuid, character varying, character varying, character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_internal_user_profile_sp(IN p_internal_user_id uuid, IN p_username character varying, IN p_first_name character varying, IN p_middle_name character varying, IN p_surname character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_profile(
        p_internal_user_id,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname
    );
END;
$$;


--
-- Name: update_internal_user_role(uuid, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_internal_user_role(p_internal_user_id uuid, p_role_name character varying) RETURNS TABLE(internal_user_id uuid, email character varying, role character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT r.role_id
    INTO v_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    UPDATE identity.internal_users AS iu
    SET role_id = v_role_id,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users AS iu
    JOIN identity.roles AS r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;


--
-- Name: update_internal_user_role(uuid, character varying, character varying, text); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_internal_user_role(p_userid uuid, p_newrole character varying, p_actedbyemail character varying, p_reason text) RETURNS TABLE("Id" uuid, "Email" character varying, "FullName" character varying, "Role" character varying, "ServiceNumber" character varying, "IsActive" boolean, "UpdatedAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_prev_role VARCHAR(500);
    v_email VARCHAR(255);
BEGIN
    SELECT iu."Role", iu."Email"
    INTO v_prev_role, v_email
    FROM identity."InternalUsers" iu
    WHERE iu."Id" = p_userid;

    IF v_prev_role IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF LOWER(TRIM(v_prev_role)) = LOWER(TRIM(p_newrole)) THEN
        RAISE EXCEPTION 'User already has this role.';
    END IF;

    IF ((LOWER(TRIM(v_prev_role)) = 'audit_oversight' AND LOWER(TRIM(p_newrole)) IN ('procurement_officer','evaluation_committee','tenders_board','accounting_officer'))
        OR (LOWER(TRIM(v_prev_role)) IN ('procurement_officer','evaluation_committee','tenders_board','accounting_officer') AND LOWER(TRIM(p_newrole)) = 'audit_oversight')) THEN
        RAISE EXCEPTION 'Role change violates separation-of-duties between audit oversight and procurement decision roles.';
    END IF;

    UPDATE identity."InternalUsers"
    SET "Role" = TRIM(p_newrole),
        "UpdatedAt" = CURRENT_TIMESTAMP
    WHERE "Id" = p_userid;

    INSERT INTO identity."InternalUserRoleAudit" (
        "Id", "ActedByEmail", "Action", "TargetUserEmail", "PreviousRole", "NewRole", "Reason", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        LOWER(TRIM(p_actedbyemail)),
        'UPDATE_ROLE',
        v_email,
        v_prev_role,
        TRIM(p_newrole),
        NULLIF(TRIM(p_reason), ''),
        CURRENT_TIMESTAMP
    );

    RETURN QUERY
    SELECT
        iu."Id",
        iu."Email",
        iu."FullName",
        iu."Role",
        iu."ServiceNumber",
        iu."IsActive",
        iu."UpdatedAt"
    FROM identity."InternalUsers" iu
    WHERE iu."Id" = p_userid;
END;
$$;


--
-- Name: update_internal_user_role_proc(uuid, character varying, character varying, text); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_internal_user_role_proc(IN p_userid uuid, IN p_newrole character varying, IN p_actedbyemail character varying, IN p_reason text)
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."UpdateInternalUserRole"(p_userid, p_newrole, p_actedbyemail, p_reason);
$$;


--
-- Name: update_internal_user_role_sp(uuid, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_internal_user_role_sp(IN p_internal_user_id uuid, IN p_role_name character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_role(p_internal_user_id, p_role_name);
END;
$$;


--
-- Name: update_internal_user_sp(uuid, character varying, character varying, character varying, character varying, character varying, character varying, uuid, boolean); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_internal_user_sp(IN p_internal_user_id uuid, IN p_email character varying, IN p_username character varying, IN p_first_name character varying, IN p_middle_name character varying, IN p_surname character varying, IN p_service_number character varying, IN p_unit_id uuid, IN p_is_active boolean, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user(
        p_internal_user_id,
        p_email,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname,
        p_service_number,
        p_unit_id,
        p_is_active
    );
END;
$$;


--
-- Name: update_internal_user_status(uuid, boolean, character varying, text); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_internal_user_status(p_userid uuid, p_isactive boolean, p_actedbyemail character varying, p_reason text) RETURNS TABLE("Id" uuid, "Email" character varying, "FullName" character varying, "Role" character varying, "ServiceNumber" character varying, "IsActive" boolean, "UpdatedAt" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_role VARCHAR(500);
    v_email VARCHAR(255);
    v_current_active BOOLEAN;
    v_active_ict_admins INT;
BEGIN
    SELECT iu."Role", iu."Email", iu."IsActive"
    INTO v_role, v_email, v_current_active
    FROM identity."InternalUsers" iu
    WHERE iu."Id" = p_userid;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF v_current_active = p_isactive THEN
        RAISE EXCEPTION 'User status is already set to the requested value.';
    END IF;

    SELECT COUNT(*)
    INTO v_active_ict_admins
    FROM identity."InternalUsers"
    WHERE "IsActive" = TRUE
      AND LOWER("Role") = 'ict_admin';

    IF p_isactive = FALSE
       AND LOWER(v_role) = 'ict_admin'
       AND v_active_ict_admins <= 1 THEN
        RAISE EXCEPTION 'At least one active ict_admin must remain for system governance continuity.';
    END IF;

    UPDATE identity."InternalUsers"
    SET "IsActive" = p_isactive,
        "UpdatedAt" = CURRENT_TIMESTAMP
    WHERE "Id" = p_userid;

    INSERT INTO identity."InternalUserRoleAudit" (
        "Id", "ActedByEmail", "Action", "TargetUserEmail", "PreviousRole", "NewRole", "Reason", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        LOWER(TRIM(p_actedbyemail)),
        'UPDATE_STATUS',
        v_email,
        v_role,
        v_role,
        NULLIF(TRIM(p_reason), ''),
        CURRENT_TIMESTAMP
    );

    RETURN QUERY
    SELECT
        iu."Id",
        iu."Email",
        iu."FullName",
        iu."Role",
        iu."ServiceNumber",
        iu."IsActive",
        iu."UpdatedAt"
    FROM identity."InternalUsers" iu
    WHERE iu."Id" = p_userid;
END;
$$;


--
-- Name: update_internal_user_status_proc(uuid, boolean, character varying, text); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_internal_user_status_proc(IN p_userid uuid, IN p_isactive boolean, IN p_actedbyemail character varying, IN p_reason text)
    LANGUAGE sql
    AS $$
    SELECT *
    FROM identity."UpdateInternalUserStatus"(p_userid, p_isactive, p_actedbyemail, p_reason);
$$;


--
-- Name: update_role(uuid, character varying, text, boolean); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_role(p_role_id uuid, p_role_name character varying, p_description text, p_is_active boolean) RETURNS TABLE(role_id uuid, role_name character varying, description text, is_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_role_name IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM identity.roles WHERE role_name = p_role_name AND role_id <> p_role_id) THEN
            RAISE EXCEPTION 'Role name already exists';
        END IF;
    END IF;

    UPDATE identity.roles
    SET
        role_name = COALESCE(p_role_name, role_name),
        description = COALESCE(p_description, description),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;


--
-- Name: update_role_sp(uuid, character varying, text, boolean); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_role_sp(IN p_role_id uuid, IN p_role_name character varying, IN p_description text, IN p_is_active boolean, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_role(p_role_id, p_role_name, p_description, p_is_active);
END;
$$;


--
-- Name: update_vendor_profile(uuid, character varying, text, character varying, character varying, character varying); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.update_vendor_profile(p_vendor_id uuid, p_company_name character varying, p_company_address text, p_contact_person character varying, p_phone_number character varying, p_email character varying) RETURNS TABLE(vendor_id uuid, company_name character varying, registration_number character varying, tax_id character varying, company_address text, contact_person character varying, phone_number character varying, email character varying, registration_date timestamp without time zone, last_login timestamp without time zone, vendor_status character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    UPDATE identity.vendors v
    SET
        company_name = COALESCE(p_company_name, v.company_name),
        company_address = COALESCE(p_company_address, v.company_address),
        contact_person = COALESCE(p_contact_person, v.contact_person),
        phone_number = COALESCE(NULLIF(p_phone_number, ''), v.phone_number),
        email = COALESCE(p_email, v.email),
        updated_at = NOW()
    WHERE v.vendor_id = p_vendor_id
    RETURNING
        v.vendor_id,
        v.company_name,
        v.registration_number,
        v.tax_id,
        v.company_address,
        v.contact_person,
        v.phone_number,
        v.email,
        v.registration_date,
        v.last_login,
        v.vendor_status;
END;
$$;


--
-- Name: update_vendor_profile_sp(uuid, character varying, text, character varying, character varying, character varying); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.update_vendor_profile_sp(IN p_vendor_id uuid, IN p_company_name character varying, IN p_company_address text, IN p_contact_person character varying, IN p_phone_number character varying, IN p_email character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_vendor_profile(
        p_vendor_id,
        p_company_name,
        p_company_address,
        p_contact_person,
        p_phone_number,
        p_email
    );
END;
$$;


--
-- Name: upload_compliance_document(uuid, character varying, text, date); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.upload_compliance_document(p_vendor_id uuid, p_document_type character varying, p_document_url text, p_expiry_date date DEFAULT NULL::date) RETURNS TABLE(document_id uuid, vendor_id uuid, document_type character varying, document_url text, verification_status character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_document_id UUID;
    v_vendor_id UUID;
    v_document_type VARCHAR(100);
    v_document_url TEXT;
    v_status VARCHAR(50);
BEGIN
    IF EXISTS (SELECT 1 FROM identity.compliance_documents WHERE vendor_id = p_vendor_id AND document_type = p_document_type) THEN
        UPDATE identity.compliance_documents
        SET
            document_url = p_document_url,
            expiry_date = p_expiry_date,
            verification_status = 'Pending', -- Reset status on update
            verified_by = NULL,
            verified_at = NULL,
            updated_at = NOW()
        WHERE
            vendor_id = p_vendor_id AND document_type = p_document_type
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status;
    ELSE
        INSERT INTO identity.compliance_documents (
            vendor_id,
            document_type,
            document_url,
            expiry_date,
            verification_status
        )
        VALUES (
            p_vendor_id,
            p_document_type,
            p_document_url,
            p_expiry_date,
            'Pending'
        )
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status;
    END IF;

    INSERT INTO identity.compliance_document_history (
        document_id,
        vendor_id,
        document_type,
        document_url,
        expiry_date,
        verification_status,
        created_at
    )
    VALUES (
        v_document_id,
        v_vendor_id,
        v_document_type,
        v_document_url,
        p_expiry_date,
        v_status,
        NOW()
    );

    RETURN QUERY SELECT v_document_id, v_vendor_id, v_document_type, v_document_url, v_status;
END;
$$;


--
-- Name: upload_compliance_document_sp(uuid, character varying, text, date); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.upload_compliance_document_sp(IN p_vendor_id uuid, IN p_document_type character varying, IN p_document_url text, IN p_expiry_date date, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.upload_compliance_document(
        p_vendor_id,
        p_document_type,
        p_document_url,
        p_expiry_date
    );
END;
$$;


--
-- Name: upsert_role_module_grant(character varying, character varying, boolean, uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.upsert_role_module_grant(p_role_name character varying, p_module_id character varying, p_is_enabled boolean, p_updated_by uuid) RETURNS TABLE(role_name character varying, module_id character varying, is_enabled boolean, updated_at timestamp with time zone)
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


--
-- Name: upsert_user_module_grant(uuid, character varying, boolean, uuid); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.upsert_user_module_grant(p_internal_user_id uuid, p_module_id character varying, p_is_enabled boolean, p_updated_by uuid) RETURNS TABLE(internal_user_id uuid, email character varying, username character varying, role_name character varying, module_id character varying, is_enabled boolean, updated_at timestamp with time zone)
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


--
-- Name: get_contract_award(character varying); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_contract_award(p_award_code character varying) RETURNS TABLE(award_id uuid, award_code character varying, tender_title character varying, vendor_name character varying, award_value numeric, status character varying, award_date timestamp without time zone, contract_start timestamp without time zone, contract_end timestamp without time zone, funding_source character varying, notes text, published_at timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.award_id,
        a.award_code,
        a.tender_title,
        a.vendor_name,
        a.award_value,
        a.status,
        a.award_date,
        a.contract_start,
        a.contract_end,
        a.funding_source,
        a.notes,
        a.published_at,
        a.created_at,
        a.updated_at
    FROM post_award.contract_awards a
    WHERE a.award_code = p_award_code;
END;
$$;


--
-- Name: get_contract_award_sp(character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_contract_award_sp(IN p_award_code character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_award(p_award_code);
END;
$$;


--
-- Name: get_contract_awards(character varying, text); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_contract_awards(p_status character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text) RETURNS TABLE(award_id uuid, award_code character varying, tender_title character varying, vendor_name character varying, award_value numeric, status character varying, award_date timestamp without time zone, contract_start timestamp without time zone, contract_end timestamp without time zone, funding_source character varying, notes text, published_at timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.award_id,
        a.award_code,
        a.tender_title,
        a.vendor_name,
        a.award_value,
        a.status,
        a.award_date,
        a.contract_start,
        a.contract_end,
        a.funding_source,
        a.notes,
        a.published_at,
        a.created_at,
        a.updated_at
    FROM post_award.contract_awards a
    WHERE
        (p_status IS NULL OR a.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR a.award_code ILIKE '%' || p_query || '%'
            OR a.tender_title ILIKE '%' || p_query || '%'
            OR a.vendor_name ILIKE '%' || p_query || '%'
        )
    ORDER BY a.award_date DESC, a.created_at DESC;
END;
$$;


--
-- Name: get_contract_awards_sp(character varying, text); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_contract_awards_sp(IN p_status character varying, IN p_query text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_awards(p_status, p_query);
END;
$$;


--
-- Name: get_contract_detail(character varying); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_contract_detail(p_contract_code character varying) RETURNS TABLE(contract_id uuid, contract_code character varying, tender_title character varying, vendor_name character varying, contract_value numeric, status character varying, start_date timestamp without time zone, end_date timestamp without time zone, progress integer, contract_manager character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status,
        c.start_date,
        c.end_date,
        c.progress,
        c.contract_manager,
        c.notes,
        c.created_at,
        c.updated_at
    FROM post_award.contracts c
    WHERE c.contract_code = p_contract_code;
END;
$$;


--
-- Name: get_contract_detail_sp(character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_contract_detail_sp(IN p_contract_code character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_detail(p_contract_code);
END;
$$;


--
-- Name: get_contract_milestones(character varying); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_contract_milestones(p_contract_code character varying) RETURNS TABLE(milestone_id uuid, contract_code character varying, milestone_title character varying, status_after character varying, progress_after integer, notes text, contract_manager character varying, recorded_by character varying, recorded_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.milestone_id,
        m.contract_code,
        m.milestone_title,
        m.status_after,
        m.progress_after,
        m.notes,
        m.contract_manager,
        m.recorded_by,
        m.recorded_at
    FROM post_award.contract_milestones m
    WHERE m.contract_code = p_contract_code
    ORDER BY m.recorded_at DESC, m.created_at DESC;
END;
$$;


--
-- Name: get_contract_milestones_sp(character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_contract_milestones_sp(IN p_contract_code character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_milestones(p_contract_code);
END;
$$;


--
-- Name: get_contracts(character varying, text); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_contracts(p_status character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text) RETURNS TABLE(contract_id uuid, contract_code character varying, tender_title character varying, vendor_name character varying, contract_value numeric, status character varying, start_date timestamp without time zone, end_date timestamp without time zone, progress integer, contract_manager character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status,
        c.start_date,
        c.end_date,
        c.progress,
        c.contract_manager,
        c.notes,
        c.created_at,
        c.updated_at
    FROM post_award.contracts c
    WHERE
        (p_status IS NULL OR c.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR c.contract_code ILIKE '%' || p_query || '%'
            OR c.tender_title ILIKE '%' || p_query || '%'
            OR c.vendor_name ILIKE '%' || p_query || '%'
        )
    ORDER BY c.start_date DESC, c.created_at DESC;
END;
$$;


--
-- Name: get_contracts_sp(character varying, text); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_contracts_sp(IN p_status character varying, IN p_query text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contracts(p_status, p_query);
END;
$$;


--
-- Name: get_inspection_detail(character varying); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_inspection_detail(p_inspection_code character varying) RETURNS TABLE(inspection_id uuid, inspection_code character varying, contract_code character varying, tender_title character varying, vendor_name character varying, status character varying, scheduled_date timestamp without time zone, completed_date timestamp without time zone, inspector_name character varying, outcome character varying, location character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.inspection_id,
        i.inspection_code,
        i.contract_code,
        i.tender_title,
        i.vendor_name,
        i.status,
        i.scheduled_date,
        i.completed_date,
        i.inspector_name,
        i.outcome,
        i.location,
        i.notes,
        i.created_at,
        i.updated_at
    FROM post_award.inspections i
    WHERE i.inspection_code = p_inspection_code;
END;
$$;


--
-- Name: get_inspection_detail_sp(character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_inspection_detail_sp(IN p_inspection_code character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_inspection_detail(p_inspection_code);
END;
$$;


--
-- Name: get_inspections(character varying, text); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.get_inspections(p_status character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text) RETURNS TABLE(inspection_id uuid, inspection_code character varying, contract_code character varying, tender_title character varying, vendor_name character varying, status character varying, scheduled_date timestamp without time zone, completed_date timestamp without time zone, inspector_name character varying, outcome character varying, location character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.inspection_id,
        i.inspection_code,
        i.contract_code,
        i.tender_title,
        i.vendor_name,
        i.status,
        i.scheduled_date,
        i.completed_date,
        i.inspector_name,
        i.outcome,
        i.location,
        i.notes,
        i.created_at,
        i.updated_at
    FROM post_award.inspections i
    WHERE
        (p_status IS NULL OR i.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR i.inspection_code ILIKE '%' || p_query || '%'
            OR i.contract_code ILIKE '%' || p_query || '%'
            OR i.vendor_name ILIKE '%' || p_query || '%'
        )
    ORDER BY i.scheduled_date DESC, i.created_at DESC;
END;
$$;


--
-- Name: get_inspections_sp(character varying, text); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.get_inspections_sp(IN p_status character varying, IN p_query text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_inspections(p_status, p_query);
END;
$$;


--
-- Name: log_contract_milestone(character varying, character varying, character varying, integer, text, character varying, character varying); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.log_contract_milestone(p_contract_code character varying, p_milestone_title character varying, p_status character varying, p_progress integer, p_notes text, p_contract_manager character varying, p_recorded_by character varying) RETURNS TABLE(contract_id uuid, contract_code character varying, tender_title character varying, vendor_name character varying, contract_value numeric, status character varying, start_date timestamp without time zone, end_date timestamp without time zone, progress integer, contract_manager character varying, notes text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_contract_manager VARCHAR(150);
    v_recorded_by VARCHAR(255);
BEGIN
    IF p_milestone_title IS NULL OR btrim(p_milestone_title) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MilestoneTitle is required.';
    END IF;

    IF p_notes IS NULL OR btrim(p_notes) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Notes are required.';
    END IF;

    IF p_progress < 0 OR p_progress > 100 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Progress must be between 0 and 100.';
    END IF;

    IF p_status NOT IN ('Active', 'On Hold', 'Completed', 'Terminated') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Status is invalid for contract management.';
    END IF;

    UPDATE post_award.contracts AS c
    SET
        status = p_status,
        progress = p_progress,
        notes = p_notes,
        contract_manager = COALESCE(NULLIF(btrim(p_contract_manager), ''), c.contract_manager),
        updated_by = COALESCE(NULLIF(btrim(p_recorded_by), ''), CURRENT_USER),
        updated_at = NOW()
    WHERE c.contract_code = p_contract_code
    RETURNING c.contract_manager, c.updated_by
    INTO v_contract_manager, v_recorded_by;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO post_award.contract_milestones (
        contract_code,
        milestone_title,
        status_after,
        progress_after,
        notes,
        contract_manager,
        recorded_by
    )
    VALUES (
        p_contract_code,
        p_milestone_title,
        p_status,
        p_progress,
        p_notes,
        v_contract_manager,
        v_recorded_by
    );

    RETURN QUERY
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status,
        c.start_date,
        c.end_date,
        c.progress,
        c.contract_manager,
        c.notes
    FROM post_award.contracts c
    WHERE c.contract_code = p_contract_code;
END;
$$;


--
-- Name: log_contract_milestone_sp(character varying, character varying, character varying, integer, text, character varying, character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.log_contract_milestone_sp(IN p_contract_code character varying, IN p_milestone_title character varying, IN p_status character varying, IN p_progress integer, IN p_notes text, IN p_contract_manager character varying, IN p_recorded_by character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.log_contract_milestone(
        p_contract_code,
        p_milestone_title,
        p_status,
        p_progress,
        p_notes,
        p_contract_manager,
        p_recorded_by
    );
END;
$$;


--
-- Name: publish_contract_award(character varying); Type: FUNCTION; Schema: post_award; Owner: -
--

CREATE FUNCTION post_award.publish_contract_award(p_award_code character varying) RETURNS TABLE(award_id uuid, award_code character varying, tender_title character varying, vendor_name character varying, award_value numeric, status character varying, award_date timestamp without time zone, contract_start timestamp without time zone, contract_end timestamp without time zone, funding_source character varying, notes text, published_at timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE post_award.contract_awards
    SET
        status = 'Published',
        published_at = NOW(),
        updated_at = NOW()
    WHERE award_code = p_award_code
      AND status <> 'Published';

    RETURN QUERY
    SELECT
        a.award_id,
        a.award_code,
        a.tender_title,
        a.vendor_name,
        a.award_value,
        a.status,
        a.award_date,
        a.contract_start,
        a.contract_end,
        a.funding_source,
        a.notes,
        a.published_at,
        a.created_at,
        a.updated_at
    FROM post_award.contract_awards a
    WHERE a.award_code = p_award_code;
END;
$$;


--
-- Name: publish_contract_award_sp(character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.publish_contract_award_sp(IN p_award_code character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.publish_contract_award(p_award_code);
END;
$$;


--
-- Name: record_payment_sp(character varying, numeric, text, character varying); Type: PROCEDURE; Schema: post_award; Owner: -
--

CREATE PROCEDURE post_award.record_payment_sp(IN p_contract_code character varying, IN p_amount numeric, IN p_notes text, IN p_recorded_by character varying, OUT p_payment_id uuid, OUT p_payment_reference character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_inspection_status VARCHAR(50);
    v_inspection_outcome VARCHAR(50);
    v_contract_status VARCHAR(50);
BEGIN
    -- 1. Validate contract status
    SELECT status INTO v_contract_status
    FROM post_award.contracts
    WHERE contract_code = p_contract_code;

    IF v_contract_status IS NULL THEN
        RAISE EXCEPTION 'Contract % not found.', p_contract_code;
    END IF;

    IF v_contract_status <> 'Completed' THEN
        RAISE EXCEPTION 'Contract % must be in Completed status before final payment.', p_contract_code;
    END IF;

    -- 2. Validate inspection outcome
    SELECT status, outcome INTO v_inspection_status, v_inspection_outcome
    FROM post_award.inspections
    WHERE contract_code = p_contract_code
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_inspection_status IS NULL OR v_inspection_status <> 'Accepted' OR v_inspection_outcome <> 'Accepted' THEN
        RAISE EXCEPTION 'Accepted inspection is required for contract % before payment.', p_contract_code;
    END IF;

    -- 3. Check if already paid
    IF EXISTS (SELECT 1 FROM post_award.contracts WHERE contract_code = p_contract_code AND is_paid = TRUE) THEN
        RAISE EXCEPTION 'Payment has already been recorded for contract %.', p_contract_code;
    END IF;

    -- 4. Generate reference
    p_payment_reference := CONCAT('PYMT-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6)));

    -- 5. Insert payment
    INSERT INTO post_award.payments (
        payment_reference,
        contract_code,
        amount,
        status,
        recorded_by,
        notes
    )
    VALUES (
        p_payment_reference,
        p_contract_code,
        p_amount,
        'Paid',
        p_recorded_by,
        p_notes
    )
    RETURNING payment_id INTO p_payment_id;

    -- 6. Update contract
    UPDATE post_award.contracts
    SET
        is_paid = TRUE,
        payment_recorded_at = NOW(),
        updated_at = NOW()
    WHERE contract_code = p_contract_code;

    -- 7. Record budget expenditure
    PERFORM procurement_workflow.record_expenditure_sp(p_contract_code, p_amount, p_notes, p_recorded_by);
END;
$$;


--
-- Name: approval_approve_json(uuid, character varying, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.approval_approve_json(p_task_id uuid, p_actor_email character varying, p_actor_role character varying, p_comment text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_task procurement_workflow."RequisitionApprovalTasks"%ROWTYPE;
    v_req procurement_workflow."InternalRequisitions"%ROWTYPE;
    v_next_task procurement_workflow."RequisitionApprovalTasks"%ROWTYPE;
BEGIN
    SELECT * INTO v_task
    FROM procurement_workflow."RequisitionApprovalTasks"
    WHERE "ApprovalTaskId" = p_task_id;
    IF v_task."ApprovalTaskId" IS NULL THEN
        RAISE EXCEPTION 'Approval task not found.';
    END IF;
    IF LOWER(v_task."Status") <> 'pending' THEN
        RAISE EXCEPTION 'Only pending tasks can be approved.';
    END IF;
    IF LOWER(v_task."RequiredRole") <> LOWER(COALESCE(p_actor_role,'')) AND LOWER(COALESCE(p_actor_role,'')) <> 'ict_admin' THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    SELECT * INTO v_req
    FROM procurement_workflow."InternalRequisitions"
    WHERE "RequisitionId" = v_task."RequisitionId";
    IF v_req."RequisitionId" IS NULL THEN
        RAISE EXCEPTION 'Requisition not found for this task.';
    END IF;
    IF LOWER(v_req."CreatedBy") = LOWER(p_actor_email) THEN
        RAISE EXCEPTION 'Separation of duties: request initiator cannot approve this requisition.';
    END IF;

    UPDATE procurement_workflow."RequisitionApprovalTasks"
    SET "Status" = 'Approved',
        "Decision" = 'Approved',
        "DecisionComment" = NULLIF(TRIM(COALESCE(p_comment,'')), ''),
        "ActionedBy" = LOWER(TRIM(p_actor_email)),
        "ActionedAt" = NOW()
    WHERE "ApprovalTaskId" = p_task_id;

    SELECT * INTO v_next_task
    FROM procurement_workflow."RequisitionApprovalTasks"
    WHERE "RequisitionId" = v_task."RequisitionId"
      AND "Sequence" = v_task."Sequence" + 1;

    IF v_next_task."ApprovalTaskId" IS NULL THEN
        UPDATE procurement_workflow."InternalRequisitions"
        SET "Status" = 'Approved - Ready for Tender'
        WHERE "RequisitionId" = v_task."RequisitionId";
    ELSE
        UPDATE procurement_workflow."RequisitionApprovalTasks"
        SET "Status" = 'Pending',
            "DueAt" = NOW() + (procurement_workflow."ResolveSlaDaysFn"(v_next_task."RequiredRole") || ' days')::INTERVAL
        WHERE "ApprovalTaskId" = v_next_task."ApprovalTaskId";

        UPDATE procurement_workflow."InternalRequisitions"
        SET "Status" = 'Pending ' || v_next_task."StageName"
        WHERE "RequisitionId" = v_task."RequisitionId";
    END IF;

    INSERT INTO procurement_workflow."RequisitionAuditEvents" (
        "Id", "RequisitionId", "EventType", "ActorEmail", "Detail", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        v_task."RequisitionId",
        'ApprovalGranted',
        LOWER(TRIM(p_actor_email)),
        'Stage ''' || v_task."StageName" || ''' approved. ' || COALESCE(p_comment, ''),
        NOW()
    );

    RETURN procurement_workflow."GetRequisitionSummaryJson"(v_task."RequisitionId");
END;
$$;


--
-- Name: approval_clarify_json(uuid, character varying, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.approval_clarify_json(p_task_id uuid, p_actor_email character varying, p_actor_role character varying, p_comment text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_task procurement_workflow."RequisitionApprovalTasks"%ROWTYPE;
BEGIN
    SELECT * INTO v_task
    FROM procurement_workflow."RequisitionApprovalTasks"
    WHERE "ApprovalTaskId" = p_task_id;
    IF v_task."ApprovalTaskId" IS NULL THEN
        RAISE EXCEPTION 'Approval task not found.';
    END IF;
    IF LOWER(v_task."Status") <> 'pending' THEN
        RAISE EXCEPTION 'Only pending tasks can request clarification.';
    END IF;
    IF LOWER(v_task."RequiredRole") <> LOWER(COALESCE(p_actor_role,'')) AND LOWER(COALESCE(p_actor_role,'')) <> 'ict_admin' THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    UPDATE procurement_workflow."RequisitionApprovalTasks"
    SET "Status" = 'ClarificationRequested',
        "Decision" = 'ClarificationRequested',
        "DecisionComment" = p_comment,
        "ActionedBy" = LOWER(TRIM(p_actor_email)),
        "ActionedAt" = NOW()
    WHERE "ApprovalTaskId" = p_task_id;

    UPDATE procurement_workflow."InternalRequisitions"
    SET "Status" = 'Clarification Requested by ' || v_task."StageName"
    WHERE "RequisitionId" = v_task."RequisitionId";

    INSERT INTO procurement_workflow."RequisitionAuditEvents" (
        "Id", "RequisitionId", "EventType", "ActorEmail", "Detail", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        v_task."RequisitionId",
        'ClarificationRequested',
        LOWER(TRIM(p_actor_email)),
        'Stage ''' || v_task."StageName" || ''' requested clarification. Message: ' || p_comment,
        NOW()
    );

    RETURN procurement_workflow."GetRequisitionSummaryJson"(v_task."RequisitionId");
END;
$$;


--
-- Name: approval_reject_json(uuid, character varying, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.approval_reject_json(p_task_id uuid, p_actor_email character varying, p_actor_role character varying, p_comment text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_task procurement_workflow."RequisitionApprovalTasks"%ROWTYPE;
    v_req procurement_workflow."InternalRequisitions"%ROWTYPE;
BEGIN
    SELECT * INTO v_task
    FROM procurement_workflow."RequisitionApprovalTasks"
    WHERE "ApprovalTaskId" = p_task_id;
    IF v_task."ApprovalTaskId" IS NULL THEN
        RAISE EXCEPTION 'Approval task not found.';
    END IF;
    IF LOWER(v_task."Status") <> 'pending' THEN
        RAISE EXCEPTION 'Only pending tasks can be rejected.';
    END IF;
    IF LOWER(v_task."RequiredRole") <> LOWER(COALESCE(p_actor_role,'')) AND LOWER(COALESCE(p_actor_role,'')) <> 'ict_admin' THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    SELECT * INTO v_req
    FROM procurement_workflow."InternalRequisitions"
    WHERE "RequisitionId" = v_task."RequisitionId";
    IF v_req."RequisitionId" IS NULL THEN
        RAISE EXCEPTION 'Requisition not found for this task.';
    END IF;
    IF LOWER(v_req."CreatedBy") = LOWER(p_actor_email) THEN
        RAISE EXCEPTION 'Separation of duties: request initiator cannot reject this requisition.';
    END IF;

    UPDATE procurement_workflow."RequisitionApprovalTasks"
    SET "Status" = 'Rejected',
        "Decision" = 'Rejected',
        "DecisionComment" = p_comment,
        "ActionedBy" = LOWER(TRIM(p_actor_email)),
        "ActionedAt" = NOW()
    WHERE "ApprovalTaskId" = p_task_id;

    UPDATE procurement_workflow."InternalRequisitions"
    SET "Status" = 'Rejected at ' || v_task."StageName"
    WHERE "RequisitionId" = v_task."RequisitionId";

    INSERT INTO procurement_workflow."RequisitionAuditEvents" (
        "Id", "RequisitionId", "EventType", "ActorEmail", "Detail", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        v_task."RequisitionId",
        'ApprovalRejected',
        LOWER(TRIM(p_actor_email)),
        'Stage ''' || v_task."StageName" || ''' rejected request. Reason: ' || p_comment,
        NOW()
    );

    RETURN procurement_workflow."GetRequisitionSummaryJson"(v_task."RequisitionId");
END;
$$;


--
-- Name: approve_procurement_plan_cycle(uuid, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.approve_procurement_plan_cycle(p_plan_cycle_id uuid, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cycle procurement_workflow."ProcurementPlanCycles"%ROWTYPE;
BEGIN
    SELECT * INTO v_cycle
    FROM procurement_workflow."ProcurementPlanCycles"
    WHERE "PlanCycleId" = p_plan_cycle_id;

    IF v_cycle."PlanCycleId" IS NULL THEN
        RAISE EXCEPTION 'APP cycle not found.';
    END IF;

    IF LOWER(v_cycle."Status") <> 'submitted' THEN
        RAISE EXCEPTION 'Only Submitted APP cycles can be approved.';
    END IF;

    UPDATE procurement_workflow."ProcurementPlanItems"
    SET "Status" = 'Approved'
    WHERE "PlanCycleId" = p_plan_cycle_id;

    UPDATE procurement_workflow."ProcurementPlanCycles"
    SET "Status" = 'Approved',
        "ApprovedBy" = p_actor_email,
        "ApprovedAt" = NOW(),
        "RejectionReason" = NULL
    WHERE "PlanCycleId" = p_plan_cycle_id;

    RETURN jsonb_build_object(
        'planCycleId', p_plan_cycle_id,
        'status', 'Approved',
        'approvedBy', p_actor_email,
        'approvedAt', NOW()
    );
END;
$$;


--
-- Name: approve_procurement_plan_cycle_proc(uuid, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.approve_procurement_plan_cycle_proc(IN p_plan_cycle_id uuid, IN p_actor_email character varying, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."ApproveProcurementPlanCycle"(p_plan_cycle_id, p_actor_email);
END;
$$;


--
-- Name: approve_task_proc(uuid, character varying, character varying, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.approve_task_proc(IN p_task_id uuid, IN p_actor_email character varying, IN p_actor_role character varying, IN p_comment text, INOUT p_requisition_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisition_json := procurement_workflow."ApprovalApproveJson"(p_task_id, p_actor_email, p_actor_role, p_comment);
END;
$$;


--
-- Name: clarify_task_proc(uuid, character varying, character varying, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.clarify_task_proc(IN p_task_id uuid, IN p_actor_email character varying, IN p_actor_role character varying, IN p_comment text, INOUT p_requisition_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisition_json := procurement_workflow."ApprovalClarifyJson"(p_task_id, p_actor_email, p_actor_role, p_comment);
END;
$$;


--
-- Name: close_tender(uuid, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.close_tender(p_tender_id uuid, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status VARCHAR(50);
    v_closed_at TIMESTAMP WITHOUT TIME ZONE := NOW();
BEGIN
    SELECT t."Status" INTO v_status
    FROM procurement_workflow."Tenders" t
    WHERE t."TenderID" = p_tender_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Tender not found.';
    END IF;

    IF LOWER(v_status) <> 'closed' THEN
        UPDATE procurement_workflow."Tenders"
        SET "Status" = 'Closed',
            "ClosingDate" = v_closed_at,
            "UpdatedBy" = p_actor_email,
            "UpdatedAt" = NOW()
        WHERE "TenderID" = p_tender_id;
    END IF;

    RETURN jsonb_build_object(
        'id', p_tender_id,
        'status', 'Closed',
        'closingDate', v_closed_at,
        'closedBy', p_actor_email
    );
END;
$$;


--
-- Name: close_tender_proc(uuid, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.close_tender_proc(IN p_tender_id uuid, IN p_actor_email character varying, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."CloseTender"(p_tender_id, p_actor_email);
END;
$$;


--
-- Name: create_procurement_plan(character varying, character varying, integer, character varying, numeric, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_procurement_plan(p_plan_title character varying, p_department character varying, p_fiscal_year integer, p_status character varying, p_total_budget numeric, p_notes text) RETURNS TABLE(plan_id uuid, plan_title character varying, department character varying, fiscal_year integer, status character varying, total_budget numeric, notes text, submitted_at timestamp without time zone, approved_at timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_plan_id UUID;
    v_duplicate_id UUID;
    v_yearly_app_id UUID;
BEGIN
    SELECT p.plan_id
    INTO v_duplicate_id
    FROM procurement_workflow.procurement_plans p
    WHERE lower(trim(p.plan_title)) = lower(trim(p_plan_title))
      AND lower(trim(p.department)) = lower(trim(p_department))
      AND p.fiscal_year = p_fiscal_year
    LIMIT 1;

    IF v_duplicate_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan already exists for this title, department, and fiscal year.';
    END IF;

    v_yearly_app_id := procurement_workflow.ensure_yearly_app(p_fiscal_year);

    INSERT INTO procurement_workflow.procurement_plans (
        yearly_app_id,
        plan_title,
        department,
        fiscal_year,
        status,
        total_budget,
        notes
    )
    VALUES (
        v_yearly_app_id,
        p_plan_title,
        p_department,
        p_fiscal_year,
        COALESCE(p_status, 'Draft'),
        COALESCE(p_total_budget, 0),
        p_notes
    )
    RETURNING procurement_plans.plan_id INTO v_plan_id;

    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.notes,
        p.submitted_at,
        p.approved_at,
        p.created_at,
        p.updated_at
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = v_plan_id;
END;
$$;


--
-- Name: create_procurement_plan_cycle(integer, character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_procurement_plan_cycle(p_fiscal_year integer, p_cycle_code character varying, p_title character varying, p_department character varying, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_record procurement_workflow."ProcurementPlanCycles"%ROWTYPE;
BEGIN
    INSERT INTO procurement_workflow."ProcurementPlanCycles" (
        "PlanCycleId", "FiscalYear", "CycleCode", "Title", "Department", "Status", "CreatedBy", "CreatedAt")
    VALUES (
        gen_random_uuid(), p_fiscal_year, TRIM(p_cycle_code), TRIM(p_title), TRIM(p_department), 'Draft', p_actor_email, NOW())
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
        'planCycleId', v_record."PlanCycleId",
        'fiscalYear', v_record."FiscalYear",
        'cycleCode', v_record."CycleCode",
        'title', v_record."Title",
        'department', v_record."Department",
        'status', v_record."Status",
        'createdBy', v_record."CreatedBy",
        'createdAt', v_record."CreatedAt"
    );
END;
$$;


--
-- Name: create_procurement_plan_cycle_proc(integer, character varying, character varying, character varying, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_procurement_plan_cycle_proc(IN p_fiscal_year integer, IN p_cycle_code character varying, IN p_title character varying, IN p_department character varying, IN p_actor_email character varying, INOUT p_cycle_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_cycle_json := procurement_workflow."CreateProcurementPlanCycle"(
        p_fiscal_year, p_cycle_code, p_title, p_department, p_actor_email);
END;
$$;


--
-- Name: create_procurement_plan_item(uuid, character varying, text, character varying, character varying, numeric, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_procurement_plan_item(p_plan_id uuid, p_item_code character varying, p_description text, p_budget_code character varying, p_procurement_type character varying, p_estimated_amount numeric, p_status character varying, p_notes text) RETURNS TABLE(plan_item_id uuid, plan_id uuid, item_code character varying, description text, budget_code character varying, procurement_type character varying, estimated_amount numeric, status character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_plan_item_id UUID;
    v_plan_title VARCHAR(255);
    v_department VARCHAR(255);
    v_fiscal_year INT;
    v_plan_cycle_id UUID;
    v_cycle_code VARCHAR(100);
    v_app_code VARCHAR(100);
    v_procurement_category VARCHAR(100);
    v_funding_source VARCHAR(255);
    v_procurement_method VARCHAR(255);
    v_duplicate_id UUID;
BEGIN
    SELECT p.plan_title, p.department, p.fiscal_year
    INTO v_plan_title, v_department, v_fiscal_year
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;
    IF v_plan_title IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan not found.'; END IF;
    SELECT c.plan_cycle_id INTO v_plan_cycle_id FROM procurement_workflow.procurement_plan_cycles c
    WHERE c.title = v_plan_title AND c.department = v_department AND c.fiscal_year = v_fiscal_year ORDER BY c.created_at DESC LIMIT 1;
    IF v_plan_cycle_id IS NULL THEN
        v_cycle_code := left(replace(gen_random_uuid()::text, '-', ''), 16);
        INSERT INTO procurement_workflow.procurement_plan_cycles (fiscal_year, cycle_code, title, department, status, created_by)
        VALUES (v_fiscal_year, v_cycle_code, v_plan_title, v_department, 'Draft', CURRENT_USER)
        RETURNING plan_cycle_id INTO v_plan_cycle_id;
    END IF;
    v_app_code := COALESCE(p_item_code, 'APP-' || left(replace(gen_random_uuid()::text, '-', ''), 16));
    v_procurement_category := COALESCE(p_procurement_type, 'Goods');
    v_funding_source := 'Budget';
    v_procurement_method := 'Open Competitive Bidding';
    SELECT i.plan_item_id INTO v_duplicate_id FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p_plan_id AND lower(trim(i.description)) = lower(trim(p_description))
      AND lower(trim(i.budget_code)) = lower(trim(p_budget_code))
      AND lower(trim(COALESCE(i.procurement_type, ''))) = lower(trim(COALESCE(p_procurement_type, ''))) LIMIT 1;
    IF v_duplicate_id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Duplicate APP item: same description, budget code, and procurement type already exists for this plan.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM procurement_workflow.budget_lines bl WHERE bl.budget_code = p_budget_code) THEN
        INSERT INTO procurement_workflow.budget_lines (budget_code, department, funding_source, allocated_amount, is_active)
        VALUES (p_budget_code, v_department, v_funding_source, 0, TRUE);
    END IF;
    INSERT INTO procurement_workflow.procurement_plan_items (
        plan_id, plan_cycle_id, fiscal_year, app_code, title, department, procurement_category, item_code, description,
        budget_code, procurement_type, estimated_amount, funding_source, estimated_cost, procurement_method, status, notes, created_by
    ) VALUES (
        p_plan_id, v_plan_cycle_id, v_fiscal_year, v_app_code, p_description, v_department, v_procurement_category, p_item_code, p_description,
        p_budget_code, p_procurement_type, COALESCE(p_estimated_amount, 0), v_funding_source, COALESCE(p_estimated_amount, 0),
        v_procurement_method, COALESCE(p_status, 'Active'), p_notes, CURRENT_USER
    ) RETURNING procurement_plan_items.plan_item_id INTO v_plan_item_id;
    PERFORM procurement_workflow.sync_procurement_plan_total_budget(p_plan_id);
    RETURN QUERY SELECT i.plan_item_id, i.plan_id, i.item_code, i.description, i.budget_code, i.procurement_type, i.estimated_amount, i.status, i.notes, i.created_at, i.updated_at
    FROM procurement_workflow.procurement_plan_items i WHERE i.plan_item_id = v_plan_item_id;
END;
$$;


--
-- Name: create_procurement_plan_item(uuid, integer, character varying, character varying, character varying, character varying, character varying, character varying, numeric, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_procurement_plan_item(p_plan_cycle_id uuid, p_fiscal_year integer, p_app_code character varying, p_title character varying, p_department character varying, p_procurement_category character varying, p_budget_code character varying, p_funding_source character varying, p_estimated_cost numeric, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cycle procurement_workflow."ProcurementPlanCycles"%ROWTYPE;
    v_item procurement_workflow."ProcurementPlanItems"%ROWTYPE;
    v_method VARCHAR(255);
BEGIN
    SELECT * INTO v_cycle
    FROM procurement_workflow."ProcurementPlanCycles"
    WHERE "PlanCycleId" = p_plan_cycle_id;

    IF v_cycle."PlanCycleId" IS NULL THEN
        RAISE EXCEPTION 'APP cycle does not exist.';
    END IF;

    IF LOWER(v_cycle."Status") <> 'draft' THEN
        RAISE EXCEPTION 'APP items can only be added to a Draft APP cycle.';
    END IF;

    IF v_cycle."FiscalYear" <> p_fiscal_year THEN
        RAISE EXCEPTION 'Fiscal year must match the selected APP cycle.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM procurement_workflow."BudgetLines" b
        WHERE b."BudgetCode" = p_budget_code
          AND b."Department" = p_department
          AND b."IsActive" = TRUE
    ) THEN
        RAISE EXCEPTION 'Budget line does not exist or is not assigned to the selected department.';
    END IF;

    v_method := procurement_workflow."DetermineProcurementMethodFn"(p_estimated_cost);

    INSERT INTO procurement_workflow."ProcurementPlanItems" (
        "PlanItemId", "PlanCycleId", "FiscalYear", "AppCode", "Title", "Department", "ProcurementCategory",
        "BudgetCode", "FundingSource", "EstimatedCost", "ProcurementMethod", "BppNoObjectionRequired",
        "BudgetVerified", "Status", "CreatedBy", "CreatedAt")
    VALUES (
        gen_random_uuid(), p_plan_cycle_id, p_fiscal_year, TRIM(p_app_code), TRIM(p_title), TRIM(p_department), TRIM(p_procurement_category),
        TRIM(p_budget_code), TRIM(p_funding_source), p_estimated_cost, v_method, (p_estimated_cost >= 100000000), FALSE, 'Draft', p_actor_email, NOW())
    RETURNING * INTO v_item;

    RETURN jsonb_build_object(
        'planItemId', v_item."PlanItemId",
        'planCycleId', v_item."PlanCycleId",
        'fiscalYear', v_item."FiscalYear",
        'appCode', v_item."AppCode",
        'title', v_item."Title",
        'department', v_item."Department",
        'procurementCategory', v_item."ProcurementCategory",
        'budgetCode', v_item."BudgetCode",
        'fundingSource', v_item."FundingSource",
        'estimatedCost', v_item."EstimatedCost",
        'procurementMethod', v_item."ProcurementMethod",
        'bppNoObjectionRequired', v_item."BppNoObjectionRequired",
        'budgetVerified', v_item."BudgetVerified",
        'budgetVerifiedBy', v_item."BudgetVerifiedBy",
        'budgetVerifiedAt', v_item."BudgetVerifiedAt",
        'status', v_item."Status",
        'createdBy', v_item."CreatedBy",
        'createdAt', v_item."CreatedAt"
    );
END;
$$;


--
-- Name: create_procurement_plan_item_proc(uuid, integer, character varying, character varying, character varying, character varying, character varying, character varying, numeric, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_procurement_plan_item_proc(IN p_plan_cycle_id uuid, IN p_fiscal_year integer, IN p_app_code character varying, IN p_title character varying, IN p_department character varying, IN p_procurement_category character varying, IN p_budget_code character varying, IN p_funding_source character varying, IN p_estimated_cost numeric, IN p_actor_email character varying, INOUT p_item_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_item_json := procurement_workflow."CreateProcurementPlanItem"(
        p_plan_cycle_id, p_fiscal_year, p_app_code, p_title, p_department,
        p_procurement_category, p_budget_code, p_funding_source, p_estimated_cost, p_actor_email);
END;
$$;


--
-- Name: create_procurement_plan_item_sp(uuid, character varying, text, character varying, character varying, numeric, character varying, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_procurement_plan_item_sp(IN p_plan_id uuid, IN p_item_code character varying, IN p_description text, IN p_budget_code character varying, IN p_procurement_type character varying, IN p_estimated_amount numeric, IN p_status character varying, IN p_notes text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_procurement_plan_item(
        p_plan_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        p_estimated_amount,
        p_status,
        p_notes
    );
END;
$$;


--
-- Name: create_procurement_plan_sp(character varying, character varying, integer, character varying, numeric, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_procurement_plan_sp(IN p_plan_title character varying, IN p_department character varying, IN p_fiscal_year integer, IN p_status character varying, IN p_total_budget numeric, IN p_notes text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_procurement_plan(
        p_plan_title,
        p_department,
        p_fiscal_year,
        p_status,
        p_total_budget,
        p_notes
    );
END;
$$;


--
-- Name: create_requisition(character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying, timestamp without time zone, text, text, text, jsonb); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_requisition(p_title character varying, p_department character varying, p_status character varying, p_priority character varying, p_procurement_type character varying, p_funding_source character varying, p_budget_code character varying, p_project_code character varying, p_required_by timestamp without time zone, p_delivery_location text, p_justification text, p_risk_notes text, p_line_items jsonb) RETURNS TABLE(requisition_id uuid, title character varying, department character varying, status character varying, priority character varying, funding_source character varying, total_estimate numeric, required_by timestamp without time zone, created_at timestamp without time zone, procurement_type character varying, budget_code character varying, project_code character varying, delivery_location text, justification text, risk_notes text, updated_at timestamp without time zone, current_stage character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_requisition_id UUID;
    v_total_estimate DECIMAL(18, 2);
    v_status VARCHAR(50);
    v_fiscal_year INT;
BEGIN
    INSERT INTO procurement_workflow.requisitions (
        title,
        department,
        status,
        priority,
        procurement_type,
        funding_source,
        budget_code,
        project_code,
        required_by,
        delivery_location,
        justification,
        risk_notes,
        current_stage
    )
    VALUES (
        p_title,
        p_department,
        COALESCE(p_status, 'Draft'),
        p_priority,
        p_procurement_type,
        p_funding_source,
        p_budget_code,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        procurement_workflow.resolve_requisition_stage(COALESCE(p_status, 'Draft'))
    )
    RETURNING requisitions.requisition_id INTO v_requisition_id;

    INSERT INTO procurement_workflow.requisition_line_items (
        requisition_id,
        item_code,
        description,
        unit,
        quantity,
        unit_cost
    )
    SELECT
        v_requisition_id,
        NULLIF(item->>'ItemId', ''),
        item->>'Description',
        item->>'Unit',
        (item->>'Quantity')::numeric,
        (item->>'UnitCost')::numeric
    FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;

    UPDATE procurement_workflow.requisitions
    SET
        total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items
            WHERE requisition_id = v_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE requisition_id = v_requisition_id;

    SELECT r.total_estimate, r.status
    INTO v_total_estimate, v_status
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;

    IF v_status IN ('Submitted', 'Under Review', 'Evaluation', 'Board Review', 'Approved') THEN
        v_fiscal_year := COALESCE(EXTRACT(YEAR FROM p_required_by)::int, EXTRACT(YEAR FROM NOW())::int);
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            v_requisition_id,
            p_budget_code,
            p_department,
            v_fiscal_year,
            v_total_estimate
        );
    END IF;

    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;
END;
$$;


--
-- Name: create_requisition(character varying, character varying, uuid, character varying, character varying, character varying, character varying, character varying, uuid, character varying, timestamp without time zone, text, text, text, jsonb); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_requisition(p_title character varying, p_department character varying, p_unit_id uuid, p_status character varying, p_priority character varying, p_procurement_type character varying, p_funding_source character varying, p_budget_code character varying, p_app_item_id uuid, p_project_code character varying, p_required_by timestamp without time zone, p_delivery_location text, p_justification text, p_risk_notes text, p_line_items jsonb) RETURNS TABLE(requisition_id uuid, title character varying, department character varying, unit_id uuid, status character varying, priority character varying, funding_source character varying, total_estimate numeric, required_by timestamp without time zone, created_at timestamp without time zone, procurement_type character varying, budget_code character varying, app_item_id uuid, project_code character varying, delivery_location text, justification text, risk_notes text, updated_at timestamp without time zone, current_stage character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_requisition_id UUID;
    v_total_estimate DECIMAL(18, 2);
    v_status VARCHAR(50);
    v_fiscal_year INT;
    v_budget_code VARCHAR(60);
    v_plan_status VARCHAR(50);
    v_plan_department VARCHAR(150);
    v_item_budget_code VARCHAR(60);
    v_item_status VARCHAR(30);
    v_linked_requisition_id UUID;
    v_department VARCHAR(150);
    v_unit_id UUID;
BEGIN
    v_unit_id := p_unit_id;
    v_budget_code := p_budget_code;

    IF v_unit_id IS NOT NULL THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE ou.unit_id = p_unit_id
          AND ou.is_active = TRUE
          AND ou.is_assignable = TRUE;

        IF v_department IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Organizational unit is invalid or inactive.';
        END IF;
    ELSIF p_department IS NOT NULL AND btrim(p_department) <> '' THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE LOWER(ou.unit_name) = LOWER(btrim(p_department))
          AND ou.is_active = TRUE
          AND ou.is_assignable = TRUE
        LIMIT 1;

        v_department := COALESCE(v_department, btrim(p_department));
    END IF;

    v_department := COALESCE(v_department, NULLIF(btrim(p_department), ''));

    IF v_department IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department or organizational unit is required.';
    END IF;

    IF p_app_item_id IS NOT NULL THEN
        SELECT p.status, p.department, i.budget_code, i.status
        INTO v_plan_status, v_plan_department, v_item_budget_code, v_item_status
        FROM procurement_workflow.procurement_plan_items i
        JOIN procurement_workflow.procurement_plans p ON p.plan_id = i.plan_id
        WHERE i.plan_item_id = p_app_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item not found.';
        END IF;

        IF v_item_status <> 'Active' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item is not active.';
        END IF;

        IF v_plan_status <> 'Under Review' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan must be under review for this APP item.';
        END IF;

        SELECT r.requisition_id
        INTO v_linked_requisition_id
        FROM procurement_workflow.requisitions r
        WHERE r.app_item_id = p_app_item_id
        LIMIT 1;

        IF v_linked_requisition_id IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP item is already linked to another requisition.';
        END IF;

        IF v_plan_department IS NOT NULL AND v_department IS NOT NULL AND v_plan_department <> v_department THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department does not match procurement plan.';
        END IF;

        IF v_budget_code IS NULL OR btrim(v_budget_code) = '' THEN
            v_budget_code := v_item_budget_code;
        ELSIF v_item_budget_code IS NOT NULL AND v_budget_code <> v_item_budget_code THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BudgetCode does not match APP line item.';
        END IF;
    END IF;

    INSERT INTO procurement_workflow.requisitions (
        title,
        department,
        unit_id,
        status,
        priority,
        procurement_type,
        funding_source,
        budget_code,
        app_item_id,
        project_code,
        required_by,
        delivery_location,
        justification,
        risk_notes,
        current_stage
    )
    VALUES (
        p_title,
        v_department,
        v_unit_id,
        COALESCE(p_status, 'Draft'),
        p_priority,
        p_procurement_type,
        p_funding_source,
        v_budget_code,
        p_app_item_id,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        procurement_workflow.resolve_requisition_stage(COALESCE(p_status, 'Draft'))
    )
    RETURNING requisitions.requisition_id INTO v_requisition_id;

    INSERT INTO procurement_workflow.requisition_line_items (
        requisition_id,
        item_code,
        description,
        unit,
        quantity,
        unit_cost
    )
    SELECT
        v_requisition_id,
        NULLIF(item->>'ItemId', ''),
        item->>'Description',
        item->>'Unit',
        (item->>'Quantity')::numeric,
        (item->>'UnitCost')::numeric
    FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;

    UPDATE procurement_workflow.requisitions r
    SET
        total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items li
            WHERE li.requisition_id = v_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE r.requisition_id = v_requisition_id;

    SELECT r.total_estimate, r.status
    INTO v_total_estimate, v_status
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;

    IF v_status IN ('Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved')
       AND v_budget_code IS NOT NULL AND btrim(v_budget_code) <> '' THEN
        v_fiscal_year := COALESCE(EXTRACT(YEAR FROM p_required_by)::int, EXTRACT(YEAR FROM NOW())::int);
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            v_requisition_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_total_estimate
        );
    END IF;

    IF v_status = 'Approved' THEN
        PERFORM procurement_workflow.require_bpp_no_objection(v_requisition_id, p_procurement_type, v_total_estimate);
    END IF;

    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.unit_id,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.app_item_id,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;
END;
$$;


--
-- Name: create_requisition_json(character varying, character varying, character varying, character varying, character varying, numeric, text, text, character varying, timestamp without time zone, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_requisition_json(p_title character varying, p_department character varying, p_procurement_category character varying, p_app_reference character varying, p_budget_code character varying, p_estimated_cost numeric, p_justification text, p_scope_summary text, p_urgency character varying, p_required_by timestamp without time zone, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_item procurement_workflow."ProcurementPlanItems"%ROWTYPE;
    v_cycle procurement_workflow."ProcurementPlanCycles"%ROWTYPE;
    v_budget procurement_workflow."BudgetLines"%ROWTYPE;
    v_requisition_id UUID;
    v_app_requested DECIMAL(18,2);
    v_budget_committed DECIMAL(18,2);
    v_available_for_item DECIMAL(18,2);
    v_remaining_budget DECIMAL(18,2);
    v_bpp_required BOOLEAN;
    v_procurement_method VARCHAR(255);
    v_first_stage VARCHAR(255);
    v_now TIMESTAMP WITHOUT TIME ZONE := NOW();
    v_sequence INT := 1;
BEGIN
    SELECT * INTO v_item
    FROM procurement_workflow."ProcurementPlanItems" i
    WHERE LOWER(i."AppCode") = LOWER(p_app_reference)
    LIMIT 1;

    IF v_item."PlanItemId" IS NULL THEN
        RAISE EXCEPTION 'Off-plan procurement blocked. Requisition must reference an existing APP item.';
    END IF;

    SELECT * INTO v_cycle
    FROM procurement_workflow."ProcurementPlanCycles" c
    WHERE c."PlanCycleId" = v_item."PlanCycleId";

    IF v_cycle."PlanCycleId" IS NULL OR LOWER(v_cycle."Status") <> 'approved' THEN
        RAISE EXCEPTION 'APP item exists but is not in an approved APP cycle. Requisition cannot proceed.';
    END IF;

    IF LOWER(v_item."Status") <> 'approved' THEN
        RAISE EXCEPTION 'APP item is not approved. Requisition cannot proceed.';
    END IF;

    IF v_item."BudgetVerified" = FALSE THEN
        RAISE EXCEPTION 'APP item budget is not verified. Requisition cannot proceed.';
    END IF;

    IF LOWER(v_item."BudgetCode") <> LOWER(p_budget_code) THEN
        RAISE EXCEPTION 'Budget code mismatch. Requisition budget code must match the linked APP item.';
    END IF;

    SELECT COALESCE(SUM(r."EstimatedCost"), 0)
    INTO v_app_requested
    FROM procurement_workflow."InternalRequisitions" r
    WHERE LOWER(r."AppReference") = LOWER(p_app_reference);

    v_available_for_item := v_item."EstimatedCost" - v_app_requested;
    IF p_estimated_cost > v_available_for_item THEN
        RAISE EXCEPTION 'Requested amount exceeds approved APP item balance. Available balance: %.', v_available_for_item;
    END IF;

    SELECT * INTO v_budget
    FROM procurement_workflow."BudgetLines" b
    WHERE LOWER(b."BudgetCode") = LOWER(p_budget_code)
      AND LOWER(b."Department") = LOWER(p_department)
      AND b."IsActive" = TRUE
    LIMIT 1;

    IF v_budget."BudgetCode" IS NULL THEN
        RAISE EXCEPTION 'Budget line was not found or does not belong to the requesting department.';
    END IF;

    SELECT COALESCE(SUM(r."EstimatedCost"), 0)
    INTO v_budget_committed
    FROM procurement_workflow."InternalRequisitions" r
    WHERE LOWER(r."BudgetCode") = LOWER(p_budget_code);

    v_remaining_budget := v_budget."AllocatedAmount" - v_budget_committed;
    IF v_remaining_budget < p_estimated_cost THEN
        RAISE EXCEPTION 'Insufficient budget provision for budget line %. Remaining: %.', p_budget_code, v_remaining_budget;
    END IF;

    v_bpp_required := p_estimated_cost >= 100000000;
    v_procurement_method := procurement_workflow."DetermineProcurementMethodFn"(p_estimated_cost);
    v_first_stage := 'Procurement Review';

    INSERT INTO procurement_workflow."InternalRequisitions" (
        "RequisitionId", "Title", "Department", "ProcurementCategory", "AppReference", "BudgetCode",
        "EstimatedCost", "Justification", "ScopeSummary", "Urgency", "RequiredBy",
        "ProcurementMethod", "BppNoObjectionRequired", "Status", "CreatedBy", "SubmittedAt")
    VALUES (
        gen_random_uuid(), TRIM(p_title), TRIM(p_department), TRIM(p_procurement_category), TRIM(p_app_reference), TRIM(p_budget_code),
        p_estimated_cost, TRIM(p_justification), TRIM(p_scope_summary), TRIM(p_urgency), p_required_by,
        v_procurement_method, v_bpp_required, 'Pending ' || v_first_stage, LOWER(TRIM(p_actor_email)), v_now
    )
    RETURNING "RequisitionId" INTO v_requisition_id;

    INSERT INTO procurement_workflow."RequisitionApprovalTasks" (
        "ApprovalTaskId", "RequisitionId", "Sequence", "StageName", "RequiredRole", "Status",
        "DueAt", "CreatedAt")
    VALUES (
        gen_random_uuid(), v_requisition_id, v_sequence, 'Procurement Review', 'procurement_officer', 'Pending',
        v_now + INTERVAL '3 days', v_now
    );
    v_sequence := v_sequence + 1;

    IF p_estimated_cost >= 50000000 THEN
        INSERT INTO procurement_workflow."RequisitionApprovalTasks" (
            "ApprovalTaskId", "RequisitionId", "Sequence", "StageName", "RequiredRole", "Status",
            "DueAt", "CreatedAt")
        VALUES (
            gen_random_uuid(), v_requisition_id, v_sequence, 'Tenders Board Review', 'tenders_board', 'AwaitingPriorStage',
            v_now + INTERVAL '3 days', v_now
        );
        v_sequence := v_sequence + 1;
    END IF;

    IF p_estimated_cost >= 100000000 THEN
        INSERT INTO procurement_workflow."RequisitionApprovalTasks" (
            "ApprovalTaskId", "RequisitionId", "Sequence", "StageName", "RequiredRole", "Status",
            "DueAt", "CreatedAt")
        VALUES (
            gen_random_uuid(), v_requisition_id, v_sequence, 'Accounting Officer Authorization', 'accounting_officer', 'AwaitingPriorStage',
            v_now + INTERVAL '2 days', v_now
        );
        v_sequence := v_sequence + 1;
    END IF;

    IF v_bpp_required THEN
        INSERT INTO procurement_workflow."RequisitionApprovalTasks" (
            "ApprovalTaskId", "RequisitionId", "Sequence", "StageName", "RequiredRole", "Status",
            "DueAt", "CreatedAt")
        VALUES (
            gen_random_uuid(), v_requisition_id, v_sequence, 'Regulatory No-Objection Confirmation', 'accounting_officer', 'AwaitingPriorStage',
            v_now + INTERVAL '2 days', v_now
        );
    END IF;

    INSERT INTO procurement_workflow."RequisitionAuditEvents" (
        "Id", "RequisitionId", "EventType", "ActorEmail", "Detail", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        v_requisition_id,
        'RequisitionInitiated',
        LOWER(TRIM(p_actor_email)),
        'Request initiated electronically and routed for approvals.',
        v_now
    );

    RETURN procurement_workflow."GetRequisitionSummaryJson"(v_requisition_id);
END;
$$;


--
-- Name: create_requisition_proc(character varying, character varying, character varying, character varying, character varying, numeric, text, text, character varying, timestamp without time zone, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_requisition_proc(IN p_title character varying, IN p_department character varying, IN p_procurement_category character varying, IN p_app_reference character varying, IN p_budget_code character varying, IN p_estimated_cost numeric, IN p_justification text, IN p_scope_summary text, IN p_urgency character varying, IN p_required_by timestamp without time zone, IN p_actor_email character varying, INOUT p_requisition_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisition_json := procurement_workflow."CreateRequisitionJson"(
        p_title, p_department, p_procurement_category, p_app_reference, p_budget_code,
        p_estimated_cost, p_justification, p_scope_summary, p_urgency, p_required_by, p_actor_email
    );
END;
$$;


--
-- Name: create_requisition_sp(character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying, timestamp without time zone, text, text, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_requisition_sp(IN p_title character varying, IN p_department character varying, IN p_status character varying, IN p_priority character varying, IN p_procurement_type character varying, IN p_funding_source character varying, IN p_budget_code character varying, IN p_project_code character varying, IN p_required_by timestamp without time zone, IN p_delivery_location text, IN p_justification text, IN p_risk_notes text, IN p_line_items jsonb, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_requisition(
        p_title,
        p_department,
        p_status,
        p_priority,
        p_procurement_type,
        p_funding_source,
        p_budget_code,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        p_line_items
    );
END;
$$;


--
-- Name: create_requisition_sp(character varying, character varying, uuid, character varying, character varying, character varying, character varying, character varying, uuid, character varying, timestamp without time zone, text, text, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_requisition_sp(IN p_title character varying, IN p_department character varying, IN p_unit_id uuid, IN p_status character varying, IN p_priority character varying, IN p_procurement_type character varying, IN p_funding_source character varying, IN p_budget_code character varying, IN p_app_item_id uuid, IN p_project_code character varying, IN p_required_by timestamp without time zone, IN p_delivery_location text, IN p_justification text, IN p_risk_notes text, IN p_line_items jsonb, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_requisition(
        p_title,
        p_department,
        p_unit_id,
        p_status,
        p_priority,
        p_procurement_type,
        p_funding_source,
        p_budget_code,
        p_app_item_id,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        p_line_items
    );
END;
$$;


--
-- Name: create_tender(character varying, text, character varying, timestamp without time zone, timestamp without time zone, timestamp without time zone, numeric, text, text, jsonb, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.create_tender(p_title character varying, p_description text, p_procurement_category character varying, p_submission_deadline timestamp without time zone, p_opening_date timestamp without time zone, p_closing_date timestamp without time zone, p_budget numeric, p_eligibility_criteria text, p_evaluation_criteria text, p_documents_json jsonb, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tender_id UUID;
    v_doc JSONB;
BEGIN
    INSERT INTO procurement_workflow."Tenders" (
        "TenderID", "Title", "Description", "ProcurementCategory", "ProcurementMethod", "Status",
        "SubmissionDeadline", "OpeningDate", "ClosingDate", "Budget",
        "EligibilityCriteria", "EvaluationCriteria", "CreatedBy", "CreatedAt", "UpdatedAt")
    VALUES (
        gen_random_uuid(), TRIM(p_title), TRIM(p_description), TRIM(p_procurement_category),
        'Open Competitive Bidding', 'Draft',
        p_submission_deadline, p_opening_date, p_closing_date, p_budget,
        TRIM(p_eligibility_criteria), TRIM(p_evaluation_criteria), p_actor_email, NOW(), NOW()
    )
    RETURNING "TenderID" INTO v_tender_id;

    FOR v_doc IN SELECT * FROM jsonb_array_elements(COALESCE(p_documents_json, '[]'::jsonb))
    LOOP
        INSERT INTO procurement_workflow."TenderDocuments" (
            "DocumentID", "TenderID", "Name", "ContentType", "Content", "CreatedAt")
        VALUES (
            gen_random_uuid(),
            v_tender_id,
            COALESCE(NULLIF(TRIM(v_doc->>'name'), ''), 'Unnamed Document'),
            COALESCE(NULLIF(TRIM(v_doc->>'contentType'), ''), 'text/plain'),
            COALESCE(v_doc->>'content', ''),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object(
        'id', v_tender_id,
        'title', TRIM(p_title),
        'procurementCategory', TRIM(p_procurement_category),
        'procurementMethod', 'Open Competitive Bidding',
        'status', 'Draft',
        'submissionDeadline', p_submission_deadline,
        'openingDate', p_opening_date,
        'closingDate', p_closing_date,
        'budget', p_budget
    );
END;
$$;


--
-- Name: create_tender_proc(character varying, text, character varying, timestamp without time zone, timestamp without time zone, timestamp without time zone, numeric, text, text, jsonb, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.create_tender_proc(IN p_title character varying, IN p_description text, IN p_procurement_category character varying, IN p_submission_deadline timestamp without time zone, IN p_opening_date timestamp without time zone, IN p_closing_date timestamp without time zone, IN p_budget numeric, IN p_eligibility_criteria text, IN p_evaluation_criteria text, IN p_documents_json jsonb, IN p_actor_email character varying, INOUT p_tender_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_tender_json := procurement_workflow."CreateTender"(
        p_title, p_description, p_procurement_category, p_submission_deadline, p_opening_date, p_closing_date,
        p_budget, p_eligibility_criteria, p_evaluation_criteria, p_documents_json, p_actor_email);
END;
$$;


--
-- Name: delete_procurement_plan(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.delete_procurement_plan(p_plan_id uuid) RETURNS TABLE(plan_id uuid, plan_title character varying, department character varying, fiscal_year integer, status character varying, total_budget numeric, notes text, submitted_at timestamp without time zone, approved_at timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    DELETE FROM procurement_workflow.procurement_plans
    WHERE plan_id = p_plan_id
    RETURNING
        procurement_plans.plan_id,
        procurement_plans.plan_title,
        procurement_plans.department,
        procurement_plans.fiscal_year,
        procurement_plans.status,
        procurement_plans.total_budget,
        procurement_plans.notes,
        procurement_plans.submitted_at,
        procurement_plans.approved_at,
        procurement_plans.created_at,
        procurement_plans.updated_at;
END;
$$;


--
-- Name: delete_procurement_plan_item(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.delete_procurement_plan_item(p_plan_item_id uuid) RETURNS TABLE(plan_item_id uuid, plan_id uuid, item_code character varying, description text, budget_code character varying, procurement_type character varying, estimated_amount numeric, status character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE v_deleted RECORD;
BEGIN
    DELETE FROM procurement_workflow.procurement_plan_items
    WHERE plan_item_id = p_plan_item_id
    RETURNING plan_item_id, plan_id, item_code, description, budget_code, procurement_type, estimated_amount, status, notes, created_at, updated_at
    INTO v_deleted;
    IF v_deleted IS NULL THEN RETURN; END IF;
    IF v_deleted.plan_id IS NOT NULL THEN PERFORM procurement_workflow.sync_procurement_plan_total_budget(v_deleted.plan_id); END IF;
    RETURN QUERY SELECT v_deleted.plan_item_id, v_deleted.plan_id, v_deleted.item_code, v_deleted.description, v_deleted.budget_code, v_deleted.procurement_type, v_deleted.estimated_amount, v_deleted.status, v_deleted.notes, v_deleted.created_at, v_deleted.updated_at;
END;
$$;


--
-- Name: delete_procurement_plan_item_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.delete_procurement_plan_item_sp(IN p_plan_item_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.delete_procurement_plan_item(p_plan_item_id);
END;
$$;


--
-- Name: delete_procurement_plan_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.delete_procurement_plan_sp(IN p_plan_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.delete_procurement_plan(p_plan_id);
END;
$$;


--
-- Name: determine_procurement_method_fn(numeric); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.determine_procurement_method_fn(p_estimated_cost numeric) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN CASE
        WHEN p_estimated_cost <= 5000000 THEN 'Request for Quotation (RFQ)'
        WHEN p_estimated_cost <= 100000000 THEN 'National Competitive Bidding'
        ELSE 'International Competitive Bidding (with BPP No-Objection gate)'
    END;
END;
$$;


--
-- Name: ensure_yearly_app(integer); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.ensure_yearly_app(p_fiscal_year integer) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_yearly_app_id UUID;
BEGIN
    IF p_fiscal_year IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Fiscal year is required to resolve the yearly APP.';
    END IF;

    INSERT INTO procurement_workflow.yearly_apps (fiscal_year, title, status, notes)
    VALUES (
        p_fiscal_year,
        p_fiscal_year::text || ' APP',
        'Under Review',
        'Auto-created while resolving yearly APP ownership.'
    )
    ON CONFLICT (fiscal_year) DO UPDATE
    SET title = EXCLUDED.title,
        updated_at = NOW()
    RETURNING yearly_app_id INTO v_yearly_app_id;

    RETURN v_yearly_app_id;
END;
$$;


--
-- Name: get_approval_inbox_json(character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_approval_inbox_json(p_actor_email character varying, p_actor_role character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'approvalTaskId', t."ApprovalTaskId",
            'sequence', t."Sequence",
            'stageName', t."StageName",
            'requiredRole', t."RequiredRole",
            'status', t."Status",
            'dueAt', t."DueAt",
            'requisition', procurement_workflow."GetRequisitionSummaryJson"(t."RequisitionId")
        ) ORDER BY t."DueAt")
        FROM procurement_workflow."RequisitionApprovalTasks" t
        WHERE LOWER(t."Status") = 'pending'
          AND (
            LOWER(t."RequiredRole") = LOWER(COALESCE(p_actor_role, '')) OR
            LOWER(COALESCE(p_actor_role, '')) = 'ict_admin'
          )
    ), '[]'::jsonb);
END;
$$;


--
-- Name: get_approval_inbox_proc(character varying, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_approval_inbox_proc(IN p_actor_email character varying, IN p_actor_role character varying, INOUT p_inbox_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_inbox_json := procurement_workflow."GetApprovalInboxJson"(p_actor_email, p_actor_role);
END;
$$;


--
-- Name: get_budget_available(character varying, character varying, integer); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_budget_available(p_budget_code character varying, p_department character varying, p_fiscal_year integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_appropriated DECIMAL(18, 2);
    v_released DECIMAL(18, 2);
    v_committed DECIMAL(18, 2);
    v_spent DECIMAL(18, 2);
    v_base DECIMAL(18, 2);
BEGIN
    SELECT COALESCE(SUM(a.amount), 0)
    INTO v_appropriated
    FROM procurement_workflow.budget_appropriations a
    WHERE a.budget_code = p_budget_code
      AND a.department = p_department
      AND a.fiscal_year = p_fiscal_year
      AND a.status = 'Active';

    SELECT COALESCE(SUM(r.amount), 0)
    INTO v_released
    FROM procurement_workflow.budget_releases r
    JOIN procurement_workflow.budget_appropriations a
      ON a.appropriation_id = r.appropriation_id
    WHERE a.budget_code = p_budget_code
      AND a.department = p_department
      AND a.fiscal_year = p_fiscal_year
      AND a.status = 'Active';

    v_base := CASE WHEN v_released > 0 THEN v_released ELSE v_appropriated END;

    SELECT COALESCE(SUM(c.amount), 0)
    INTO v_committed
    FROM procurement_workflow.budget_commitments c
    WHERE c.budget_code = p_budget_code
      AND c.department = p_department
      AND c.fiscal_year = p_fiscal_year
      AND c.status IN ('Reserved', 'Committed');

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_spent
    FROM procurement_workflow.budget_expenditures e
    JOIN procurement_workflow.budget_commitments c
      ON c.commitment_id = e.commitment_id
    WHERE c.budget_code = p_budget_code
      AND c.department = p_department
      AND c.fiscal_year = p_fiscal_year;

    RETURN v_base - v_committed - v_spent;
END;
$$;


--
-- Name: get_evaluation_report(character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_evaluation_report(p_report_code character varying) RETURNS TABLE(report_id uuid, report_code character varying, tender_id uuid, tender_title character varying, committee_lead character varying, recommendation character varying, score_summary character varying, status character varying, submitted_at timestamp without time zone, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.report_id,
        r.report_code,
        r.tender_id,
        r.tender_title,
        r.committee_lead,
        r.recommendation,
        r.score_summary,
        r.status,
        r.submitted_at,
        r.notes,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.evaluation_reports r
    WHERE r.report_code = p_report_code;
END;
$$;


--
-- Name: get_evaluation_report_json(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_evaluation_report_json(p_tender_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tender_title VARCHAR(500);
    v_tender_status VARCHAR(50);
    v_total_bids INT := 0;
    v_scored_technical_bids INT := 0;
    v_scored_financial_bids INT := 0;
    v_recommended_bid_id UUID;
    v_recommended_vendor_name VARCHAR(255);
    v_entries JSONB := '[]'::jsonb;
BEGIN
    SELECT
        t."Title",
        CASE LOWER(COALESCE(t."Status", 'open'))
            WHEN 'open' THEN 'Open'
            WHEN 'closed' THEN 'Closed'
            WHEN 'under evaluation' THEN 'Under Evaluation'
            WHEN 'awarded' THEN 'Awarded'
            WHEN 'cancelled' THEN 'Cancelled'
            ELSE t."Status"
        END
    INTO v_tender_title, v_tender_status
    FROM procurement_workflow."Tenders" t
    WHERE t."TenderID" = p_tender_id
    LIMIT 1;

    IF v_tender_title IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*)
    INTO v_total_bids
    FROM procurement_workflow."Bids" b
    WHERE b."TenderID" = p_tender_id;

    WITH scored AS (
        SELECT
            b."BidID",
            AVG(ts."Score") AS "AverageTechnicalScore",
            AVG(fs."Score") AS "AverageFinancialScore"
        FROM procurement_workflow."Bids" b
        LEFT JOIN procurement_workflow."TenderEvaluationTechnicalScores" ts
            ON ts."BidID" = b."BidID"
        LEFT JOIN procurement_workflow."TenderEvaluationFinancialScores" fs
            ON fs."BidID" = b."BidID"
        WHERE b."TenderID" = p_tender_id
        GROUP BY b."BidID"
    )
    SELECT
        COUNT(*) FILTER (WHERE "AverageTechnicalScore" IS NOT NULL),
        COUNT(*) FILTER (WHERE "AverageFinancialScore" IS NOT NULL)
    INTO v_scored_technical_bids, v_scored_financial_bids
    FROM scored;

    WITH base AS (
        SELECT
            b."BidID",
            COALESCE(v."CompanyName", 'Unknown Vendor') AS "VendorName",
            b."FinancialBid",
            ROUND(AVG(ts."Score"), 2) AS "AverageTechnicalScore",
            ROUND(AVG(fs."Score"), 2) AS "AverageFinancialScore"
        FROM procurement_workflow."Bids" b
        LEFT JOIN identity."Vendors" v
            ON v."VendorID" = b."VendorID"
        LEFT JOIN procurement_workflow."TenderEvaluationTechnicalScores" ts
            ON ts."BidID" = b."BidID"
        LEFT JOIN procurement_workflow."TenderEvaluationFinancialScores" fs
            ON fs."BidID" = b."BidID"
        WHERE b."TenderID" = p_tender_id
        GROUP BY
            b."BidID",
            v."CompanyName",
            b."FinancialBid",
            b."SubmissionDate"
    ),
    ranked AS (
        SELECT
            base."BidID",
            base."VendorName",
            base."FinancialBid",
            base."AverageTechnicalScore",
            base."AverageFinancialScore",
            ROUND(
                (COALESCE(base."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                + (COALESCE(base."AverageFinancialScore", 0)::NUMERIC * 0.30),
                2
            ) AS "CombinedScore",
            ROW_NUMBER() OVER (
                ORDER BY
                    ROUND(
                        (COALESCE(base."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                        + (COALESCE(base."AverageFinancialScore", 0)::NUMERIC * 0.30),
                        2
                    ) DESC,
                    base."FinancialBid" ASC
            ) AS "Ranking"
        FROM base
    )
    SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
            'bidId', r."BidID",
            'vendorName', r."VendorName",
            'financialBid', r."FinancialBid",
            'averageTechnicalScore', r."AverageTechnicalScore",
            'averageFinancialScore', r."AverageFinancialScore",
            'combinedScore', r."CombinedScore",
            'ranking', r."Ranking"
        ) ORDER BY r."Ranking"),
        '[]'::jsonb
    )
    INTO v_entries
    FROM ranked r;

    WITH base AS (
        SELECT
            b."BidID",
            COALESCE(v."CompanyName", 'Unknown Vendor') AS "VendorName",
            b."FinancialBid",
            ROUND(AVG(ts."Score"), 2) AS "AverageTechnicalScore",
            ROUND(AVG(fs."Score"), 2) AS "AverageFinancialScore"
        FROM procurement_workflow."Bids" b
        LEFT JOIN identity."Vendors" v
            ON v."VendorID" = b."VendorID"
        LEFT JOIN procurement_workflow."TenderEvaluationTechnicalScores" ts
            ON ts."BidID" = b."BidID"
        LEFT JOIN procurement_workflow."TenderEvaluationFinancialScores" fs
            ON fs."BidID" = b."BidID"
        WHERE b."TenderID" = p_tender_id
        GROUP BY
            b."BidID",
            v."CompanyName",
            b."FinancialBid",
            b."SubmissionDate"
    ),
    ranked AS (
        SELECT
            base."BidID",
            base."VendorName",
            base."AverageTechnicalScore",
            base."AverageFinancialScore",
            ROUND(
                (COALESCE(base."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                + (COALESCE(base."AverageFinancialScore", 0)::NUMERIC * 0.30),
                2
            ) AS "CombinedScore",
            ROW_NUMBER() OVER (
                ORDER BY
                    ROUND(
                        (COALESCE(base."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                        + (COALESCE(base."AverageFinancialScore", 0)::NUMERIC * 0.30),
                        2
                    ) DESC,
                    base."FinancialBid" ASC
            ) AS "Ranking"
        FROM base
    )
    SELECT r."BidID", r."VendorName"
    INTO v_recommended_bid_id, v_recommended_vendor_name
    FROM ranked r
    ORDER BY
        CASE
            WHEN r."AverageTechnicalScore" IS NOT NULL AND r."AverageFinancialScore" IS NOT NULL THEN 0
            ELSE 1
        END,
        r."Ranking"
    LIMIT 1;

    RETURN jsonb_build_object(
        'tenderId', p_tender_id,
        'tenderTitle', v_tender_title,
        'tenderStatus', v_tender_status,
        'totalBids', v_total_bids,
        'scoredTechnicalBids', v_scored_technical_bids,
        'scoredFinancialBids', v_scored_financial_bids,
        'recommendedBidId', v_recommended_bid_id,
        'recommendedVendorName', v_recommended_vendor_name,
        'generatedAt', NOW(),
        'entries', v_entries
    );
END;
$$;


--
-- Name: get_evaluation_report_proc(uuid, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_evaluation_report_proc(IN p_tender_id uuid, INOUT p_report_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_report_json := procurement_workflow."GetEvaluationReportJson"(p_tender_id);
END;
$$;


--
-- Name: get_evaluation_report_sp(character varying); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_evaluation_report_sp(IN p_report_code character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_evaluation_report(p_report_code);
END;
$$;


--
-- Name: get_evaluation_reports(character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_evaluation_reports(p_status character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text) RETURNS TABLE(report_id uuid, report_code character varying, tender_id uuid, tender_title character varying, committee_lead character varying, recommendation character varying, score_summary character varying, status character varying, submitted_at timestamp without time zone, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.report_id,
        r.report_code,
        r.tender_id,
        r.tender_title,
        r.committee_lead,
        r.recommendation,
        r.score_summary,
        r.status,
        r.submitted_at,
        r.notes,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.evaluation_reports r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR r.report_code ILIKE '%' || p_query || '%'
            OR r.tender_title ILIKE '%' || p_query || '%'
            OR r.committee_lead ILIKE '%' || p_query || '%'
        )
    ORDER BY r.submitted_at DESC, r.created_at DESC;
END;
$$;


--
-- Name: get_evaluation_reports_sp(character varying, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_evaluation_reports_sp(IN p_status character varying, IN p_query text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_evaluation_reports(p_status, p_query);
END;
$$;


--
-- Name: get_member_reviews(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_member_reviews(p_requisition_id uuid) RETURNS TABLE(review_id uuid, plan_id uuid, requisition_id uuid, reviewer_role character varying, reviewer_user_id character varying, decision character varying, remarks text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.review_id,
        r.plan_id,
        r.requisition_id,
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.requisition_id = p_requisition_id
    ORDER BY r.updated_at DESC;
END;
$$;


--
-- Name: get_member_reviews_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_member_reviews_sp(IN p_requisition_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_member_reviews(p_requisition_id);
END;
$$;


--
-- Name: get_member_statuses(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_member_statuses(p_requisition_id uuid) RETURNS TABLE(role_key character varying, status_label character varying, decision character varying, updated_by character varying, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.role_key,
        s.status_label,
        s.decision,
        s.updated_by,
        s.updated_at
    FROM procurement_workflow.planning_committee_member_status s
    WHERE s.requisition_id = p_requisition_id
    ORDER BY s.updated_at DESC;
END;
$$;


--
-- Name: get_member_statuses_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_member_statuses_sp(IN p_requisition_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_member_statuses(p_requisition_id);
END;
$$;


--
-- Name: get_open_tenders(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_open_tenders() RETURNS TABLE("TenderID" uuid, "Title" character varying, "ProcurementCategory" character varying, "Status" character varying, "SubmissionDeadline" timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."TenderID",
        t."Title",
        t."ProcurementCategory",
        t."Status",
        t."SubmissionDeadline"
    FROM
        procurement_workflow."Tenders" t
    WHERE
        t."Status" = 'Published' AND t."SubmissionDeadline" > NOW()
    ORDER BY
        t."SubmissionDeadline" ASC;
END;
$$;


--
-- Name: get_open_tenders_proc(); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_open_tenders_proc()
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT *
    FROM procurement_workflow."GetOpenTenders"();
END;
$$;


--
-- Name: get_procurement_budget_lines_snapshot(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_procurement_budget_lines_snapshot() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'budgetCode', b."BudgetCode",
            'department', b."Department",
            'fundingSource', b."FundingSource",
            'allocatedAmount', b."AllocatedAmount",
            'committedAmount', COALESCE(s."Committed", 0),
            'availableAmount', GREATEST(b."AllocatedAmount" - COALESCE(s."Committed", 0), 0),
            'isActive', b."IsActive"
        ) ORDER BY b."BudgetCode")
        FROM procurement_workflow."BudgetLines" b
        LEFT JOIN (
            SELECT
                i."BudgetCode",
                SUM(i."EstimatedCost") AS "Committed"
            FROM procurement_workflow."ProcurementPlanItems" i
            WHERE i."BudgetVerified" = TRUE
              AND LOWER(i."Status") <> 'rejected'
            GROUP BY i."BudgetCode"
        ) s ON s."BudgetCode" = b."BudgetCode"
    ), '[]'::jsonb);
END;
$$;


--
-- Name: get_procurement_budget_lines_snapshot_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_procurement_budget_lines_snapshot_proc(INOUT p_budget_lines_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_budget_lines_json := procurement_workflow."GetProcurementBudgetLinesSnapshot"();
END;
$$;


--
-- Name: get_procurement_plan_items(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_procurement_plan_items(p_plan_id uuid) RETURNS TABLE(plan_item_id uuid, plan_id uuid, item_code character varying, description text, budget_code character varying, procurement_type character varying, estimated_amount numeric, status character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.plan_item_id,
        i.plan_id,
        i.item_code,
        i.description,
        i.budget_code,
        i.procurement_type,
        i.estimated_amount,
        i.status,
        i.notes,
        i.created_at,
        i.updated_at
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p_plan_id
    ORDER BY i.created_at;
END;
$$;


--
-- Name: get_procurement_plan_items_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_procurement_plan_items_sp(IN p_plan_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plan_items(p_plan_id);
END;
$$;


--
-- Name: get_procurement_plans(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_procurement_plans() RETURNS TABLE(plan_id uuid, plan_title character varying, department character varying, fiscal_year integer, status character varying, total_budget numeric, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.created_at
    FROM
        procurement_workflow.procurement_plans p
    ORDER BY
        p.fiscal_year DESC,
        p.created_at DESC;
END;
$$;


--
-- Name: get_procurement_plans(integer, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_procurement_plans(p_fiscal_year integer DEFAULT NULL::integer, p_department character varying DEFAULT NULL::character varying, p_status character varying DEFAULT NULL::character varying) RETURNS TABLE(plan_id uuid, plan_title character varying, department character varying, fiscal_year integer, status character varying, total_budget numeric, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.created_at
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status)
    ORDER BY
        p.fiscal_year DESC,
        p.created_at DESC;
END;
$$;


--
-- Name: get_procurement_plans(integer, character varying, character varying, character varying, character varying, integer, integer); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_procurement_plans(p_fiscal_year integer DEFAULT NULL::integer, p_department character varying DEFAULT NULL::character varying, p_status character varying DEFAULT NULL::character varying, p_sort_by character varying DEFAULT 'created_at'::character varying, p_sort_dir character varying DEFAULT 'desc'::character varying, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(plan_id uuid, plan_title character varying, department character varying, fiscal_year integer, status character varying, total_budget numeric, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.created_at
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'plan_title' AND lower(p_sort_dir) = 'asc' THEN p.plan_title END ASC,
        CASE WHEN lower(p_sort_by) = 'plan_title' AND lower(p_sort_dir) = 'desc' THEN p.plan_title END DESC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'asc' THEN p.department END ASC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'desc' THEN p.department END DESC,
        CASE WHEN lower(p_sort_by) = 'fiscal_year' AND lower(p_sort_dir) = 'asc' THEN p.fiscal_year END ASC,
        CASE WHEN lower(p_sort_by) = 'fiscal_year' AND lower(p_sort_dir) = 'desc' THEN p.fiscal_year END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN p.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN p.status END DESC,
        CASE WHEN lower(p_sort_by) = 'total_budget' AND lower(p_sort_dir) = 'asc' THEN p.total_budget END ASC,
        CASE WHEN lower(p_sort_by) = 'total_budget' AND lower(p_sort_dir) = 'desc' THEN p.total_budget END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN p.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN p.created_at END DESC,
        p.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;


--
-- Name: get_procurement_plans_count(integer, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_procurement_plans_count(p_fiscal_year integer DEFAULT NULL::integer, p_department character varying DEFAULT NULL::character varying, p_status character varying DEFAULT NULL::character varying) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status);

    RETURN v_count;
END;
$$;


--
-- Name: get_procurement_plans_sp(); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_procurement_plans_sp(OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plans();
END;
$$;


--
-- Name: get_procurement_plans_sp(integer, character varying, character varying); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_procurement_plans_sp(IN p_fiscal_year integer, IN p_department character varying, IN p_status character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plans(p_fiscal_year, p_department, p_status);
END;
$$;


--
-- Name: get_procurement_plans_sp(integer, character varying, character varying, character varying, character varying, integer, integer); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_procurement_plans_sp(IN p_fiscal_year integer, IN p_department character varying, IN p_status character varying, IN p_sort_by character varying, IN p_sort_dir character varying, IN p_limit integer, IN p_offset integer, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plans(
        p_fiscal_year,
        p_department,
        p_status,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;


--
-- Name: get_requisition_by_id_json(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_requisition_by_id_json(p_requisition_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_summary JSONB;
    v_tasks JSONB;
BEGIN
    v_summary := procurement_workflow."GetRequisitionSummaryJson"(p_requisition_id);
    IF v_summary IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
            'approvalTaskId', t."ApprovalTaskId",
            'sequence', t."Sequence",
            'stageName', t."StageName",
            'requiredRole', t."RequiredRole",
            'status', t."Status",
            'decision', t."Decision",
            'decisionComment', t."DecisionComment",
            'actionedBy', t."ActionedBy",
            'actionedAt', t."ActionedAt",
            'dueAt', t."DueAt"
        ) ORDER BY t."Sequence"),
        '[]'::jsonb
    )
    INTO v_tasks
    FROM procurement_workflow."RequisitionApprovalTasks" t
    WHERE t."RequisitionId" = p_requisition_id;

    RETURN jsonb_build_object(
        'requisition', v_summary,
        'approvalTasks', v_tasks
    );
END;
$$;


--
-- Name: get_requisition_by_id_proc(uuid, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_requisition_by_id_proc(IN p_requisition_id uuid, INOUT p_requisition_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisition_json := procurement_workflow."GetRequisitionByIdJson"(p_requisition_id);
END;
$$;


--
-- Name: get_requisition_detail(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_requisition_detail(p_requisition_id uuid) RETURNS TABLE(requisition_id uuid, title character varying, department character varying, unit_id uuid, status character varying, priority character varying, funding_source character varying, total_estimate numeric, required_by timestamp without time zone, created_at timestamp without time zone, procurement_type character varying, budget_code character varying, app_item_id uuid, project_code character varying, delivery_location text, justification text, risk_notes text, updated_at timestamp without time zone, current_stage character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.unit_id,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.app_item_id,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;


--
-- Name: get_requisition_detail_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_requisition_detail_sp(IN p_requisition_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisition_detail(p_requisition_id);
END;
$$;


--
-- Name: get_requisition_line_items(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_requisition_line_items(p_requisition_id uuid) RETURNS TABLE(item_code character varying, description text, unit character varying, quantity numeric, unit_cost numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        li.item_code,
        li.description,
        li.unit,
        li.quantity,
        li.unit_cost
    FROM procurement_workflow.requisition_line_items li
    WHERE li.requisition_id = p_requisition_id
    ORDER BY li.created_at;
END;
$$;


--
-- Name: get_requisition_line_items_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_requisition_line_items_sp(IN p_requisition_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisition_line_items(p_requisition_id);
END;
$$;


--
-- Name: get_requisition_summary_json(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_requisition_summary_json(p_requisition_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_req procurement_workflow."InternalRequisitions"%ROWTYPE;
    v_pending_stage VARCHAR(255);
    v_pending_role VARCHAR(100);
    v_clarify_stage VARCHAR(255);
    v_reject_stage VARCHAR(255);
    v_route JSONB;
BEGIN
    SELECT * INTO v_req
    FROM procurement_workflow."InternalRequisitions"
    WHERE "RequisitionId" = p_requisition_id;

    IF v_req."RequisitionId" IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT t."StageName", t."RequiredRole"
    INTO v_pending_stage, v_pending_role
    FROM procurement_workflow."RequisitionApprovalTasks" t
    WHERE t."RequisitionId" = p_requisition_id
      AND LOWER(t."Status") = 'pending'
    ORDER BY t."Sequence"
    LIMIT 1;

    SELECT t."StageName"
    INTO v_clarify_stage
    FROM procurement_workflow."RequisitionApprovalTasks" t
    WHERE t."RequisitionId" = p_requisition_id
      AND LOWER(t."Status") = 'clarificationrequested'
    ORDER BY t."Sequence"
    LIMIT 1;

    SELECT t."StageName"
    INTO v_reject_stage
    FROM procurement_workflow."RequisitionApprovalTasks" t
    WHERE t."RequisitionId" = p_requisition_id
      AND LOWER(t."Status") = 'rejected'
    ORDER BY t."Sequence"
    LIMIT 1;

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
            'sequence', t."Sequence",
            'stageName', t."StageName",
            'requiredRole', t."RequiredRole",
            'status', t."Status",
            'decision', t."Decision",
            'actionedBy', t."ActionedBy",
            'actionedAt', t."ActionedAt"
        ) ORDER BY t."Sequence"),
        '[]'::jsonb
    )
    INTO v_route
    FROM procurement_workflow."RequisitionApprovalTasks" t
    WHERE t."RequisitionId" = p_requisition_id;

    RETURN jsonb_build_object(
        'requisitionId', v_req."RequisitionId",
        'title', v_req."Title",
        'department', v_req."Department",
        'procurementCategory', v_req."ProcurementCategory",
        'appReference', v_req."AppReference",
        'budgetCode', v_req."BudgetCode",
        'estimatedCost', v_req."EstimatedCost",
        'procurementMethod', v_req."ProcurementMethod",
        'bppNoObjectionRequired', v_req."BppNoObjectionRequired",
        'urgency', v_req."Urgency",
        'status', v_req."Status",
        'approvalStage', COALESCE(v_reject_stage, v_clarify_stage, v_pending_stage, 'Ready for Tender'),
        'pendingRole', v_pending_role,
        'route', v_route,
        'createdBy', v_req."CreatedBy",
        'submittedAt', v_req."SubmittedAt"
    );
END;
$$;


--
-- Name: get_requisitions(character varying, character varying, character varying, text, timestamp without time zone, timestamp without time zone, character varying, character varying, integer, integer); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_requisitions(p_status character varying DEFAULT NULL::character varying, p_department character varying DEFAULT NULL::character varying, p_priority character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text, p_date_from timestamp without time zone DEFAULT NULL::timestamp without time zone, p_date_to timestamp without time zone DEFAULT NULL::timestamp without time zone, p_sort_by character varying DEFAULT 'created_at'::character varying, p_sort_dir character varying DEFAULT 'desc'::character varying, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(requisition_id uuid, title character varying, department character varying, unit_id uuid, app_item_id uuid, app_item_description text, status character varying, priority character varying, funding_source character varying, total_estimate numeric, required_by timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.unit_id,
        r.app_item_id,
        pi.description,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at
    FROM
        procurement_workflow.requisitions r
        LEFT JOIN procurement_workflow.procurement_plan_items pi
            ON pi.plan_item_id = r.app_item_id
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (p_department IS NULL OR r.department ILIKE '%' || p_department || '%')
        AND (p_priority IS NULL OR r.priority ILIKE p_priority)
        AND (
            p_query IS NULL
            OR r.title ILIKE '%' || p_query || '%'
            OR r.department ILIKE '%' || p_query || '%'
            OR r.requisition_id::text ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR r.created_at >= p_date_from)
        AND (p_date_to IS NULL OR r.created_at <= p_date_to)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'asc' THEN r.title END ASC,
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'desc' THEN r.title END DESC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'asc' THEN r.department END ASC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'desc' THEN r.department END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN r.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN r.status END DESC,
        CASE WHEN lower(p_sort_by) = 'priority' AND lower(p_sort_dir) = 'asc' THEN r.priority END ASC,
        CASE WHEN lower(p_sort_by) = 'priority' AND lower(p_sort_dir) = 'desc' THEN r.priority END DESC,
        CASE WHEN lower(p_sort_by) = 'total_estimate' AND lower(p_sort_dir) = 'asc' THEN r.total_estimate END ASC,
        CASE WHEN lower(p_sort_by) = 'total_estimate' AND lower(p_sort_dir) = 'desc' THEN r.total_estimate END DESC,
        CASE WHEN lower(p_sort_by) = 'required_by' AND lower(p_sort_dir) = 'asc' THEN r.required_by END ASC,
        CASE WHEN lower(p_sort_by) = 'required_by' AND lower(p_sort_dir) = 'desc' THEN r.required_by END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN r.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN r.created_at END DESC,
        r.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;


--
-- Name: get_requisitions_count(character varying, character varying, character varying, text, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_requisitions_count(p_status character varying DEFAULT NULL::character varying, p_department character varying DEFAULT NULL::character varying, p_priority character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text, p_date_from timestamp without time zone DEFAULT NULL::timestamp without time zone, p_date_to timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM procurement_workflow.requisitions r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (p_department IS NULL OR r.department ILIKE '%' || p_department || '%')
        AND (p_priority IS NULL OR r.priority ILIKE p_priority)
        AND (
            p_query IS NULL
            OR r.title ILIKE '%' || p_query || '%'
            OR r.department ILIKE '%' || p_query || '%'
            OR r.requisition_id::text ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR r.created_at >= p_date_from)
        AND (p_date_to IS NULL OR r.created_at <= p_date_to);

    RETURN v_count;
END;
$$;


--
-- Name: get_requisitions_sp(character varying, character varying, character varying, text, timestamp without time zone, timestamp without time zone, character varying, character varying, integer, integer); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_requisitions_sp(IN p_status character varying, IN p_department character varying, IN p_priority character varying, IN p_query text, IN p_date_from timestamp without time zone, IN p_date_to timestamp without time zone, IN p_sort_by character varying, IN p_sort_dir character varying, IN p_limit integer, IN p_offset integer, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisitions(
        p_status,
        p_department,
        p_priority,
        p_query,
        p_date_from,
        p_date_to,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;


--
-- Name: get_submitted_bids(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_submitted_bids(p_vendorid uuid) RETURNS TABLE("BidID" uuid, "TenderID" uuid, "TenderTitle" character varying, "VendorID" uuid, "FinancialBid" numeric, "TechnicalProposal" text, "ValidityPeriodDays" integer, "SubmissionDate" timestamp without time zone, "BidStatus" character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        b."BidID",
        b."TenderID",
        t."Title" AS "TenderTitle",
        b."VendorID",
        b."FinancialBid",
        b."TechnicalProposal",
        b."ValidityPeriodDays",
        b."SubmissionDate",
        b."BidStatus"
    FROM
        procurement_workflow."Bids" b
    INNER JOIN
        procurement_workflow."Tenders" t ON t."TenderID" = b."TenderID"
    WHERE
        b."VendorID" = p_VendorID
    ORDER BY
        b."SubmissionDate" DESC;
END;
$$;


--
-- Name: get_submitted_bids_proc(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_submitted_bids_proc(IN p_vendorid uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT *
    FROM procurement_workflow."GetSubmittedBids"(p_vendorid);
END;
$$;


--
-- Name: get_submitted_bids_proc(uuid, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_submitted_bids_proc(IN p_vendorid uuid, INOUT p_bids_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'BidID', b."BidID",
                'TenderID', b."TenderID",
                'FinancialBid', b."FinancialBid",
                'TechnicalProposal', b."TechnicalProposal",
                'ValidityPeriodDays', b."ValidityPeriodDays",
                'SubmissionDate', to_char(b."SubmissionDate", 'YYYY-MM-DD"T"HH24:MI:SS'),
                'BidStatus', b."BidStatus"
            )
            ORDER BY b."SubmissionDate" DESC
        ),
        '[]'::jsonb
    )
    INTO p_bids_json
    FROM procurement_workflow."GetSubmittedBids"(p_vendorid) b;
END;
$$;


--
-- Name: get_tender_board_review_queue_json(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_tender_board_review_queue_json() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        WITH technical_avg AS (
            SELECT
                ts."BidID",
                ROUND(AVG(ts."Score"), 2) AS "AverageTechnicalScore"
            FROM procurement_workflow."TenderEvaluationTechnicalScores" ts
            GROUP BY ts."BidID"
        ),
        financial_avg AS (
            SELECT
                fs."BidID",
                ROUND(AVG(fs."Score"), 2) AS "AverageFinancialScore"
            FROM procurement_workflow."TenderEvaluationFinancialScores" fs
            GROUP BY fs."BidID"
        ),
        bid_stats AS (
            SELECT
                b."TenderID",
                COUNT(*) AS "TotalBids",
                COUNT(*) FILTER (WHERE ta."AverageTechnicalScore" IS NOT NULL) AS "ScoredTechnicalBids",
                COUNT(*) FILTER (WHERE fa."AverageFinancialScore" IS NOT NULL) AS "ScoredFinancialBids"
            FROM procurement_workflow."Bids" b
            LEFT JOIN technical_avg ta
                ON ta."BidID" = b."BidID"
            LEFT JOIN financial_avg fa
                ON fa."BidID" = b."BidID"
            GROUP BY b."TenderID"
        ),
        ranked_bids AS (
            SELECT
                b."TenderID",
                b."BidID",
                COALESCE(v."CompanyName", 'Unknown Vendor') AS "VendorName",
                b."FinancialBid",
                ta."AverageTechnicalScore",
                fa."AverageFinancialScore",
                ROUND(
                    (COALESCE(ta."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                    + (COALESCE(fa."AverageFinancialScore", 0)::NUMERIC * 0.30),
                    2
                ) AS "CombinedScore",
                ROW_NUMBER() OVER (
                    PARTITION BY b."TenderID"
                    ORDER BY
                        ROUND(
                            (COALESCE(ta."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                            + (COALESCE(fa."AverageFinancialScore", 0)::NUMERIC * 0.30),
                            2
                        ) DESC,
                        b."FinancialBid" ASC,
                        b."SubmissionDate" ASC
                ) AS "Ranking"
            FROM procurement_workflow."Bids" b
            LEFT JOIN identity."Vendors" v
                ON v."VendorID" = b."VendorID"
            LEFT JOIN technical_avg ta
                ON ta."BidID" = b."BidID"
            LEFT JOIN financial_avg fa
                ON fa."BidID" = b."BidID"
        ),
        latest_decision AS (
            SELECT DISTINCT ON (d."TenderID")
                d."TenderID",
                d."Decision",
                d."Comment",
                d."DecidedBy",
                d."DecidedAt"
            FROM procurement_workflow."TenderBoardDecisions" d
            ORDER BY d."TenderID", d."DecidedAt" DESC
        )
        SELECT jsonb_agg(jsonb_build_object(
            'tenderId', t."TenderID",
            'title', t."Title",
            'procurementCategory', t."ProcurementCategory",
            'status', CASE LOWER(COALESCE(t."Status", 'open'))
                WHEN 'open' THEN 'Open'
                WHEN 'closed' THEN 'Closed'
                WHEN 'under evaluation' THEN 'Under Evaluation'
                WHEN 'awarded' THEN 'Awarded'
                WHEN 'cancelled' THEN 'Cancelled'
                ELSE t."Status"
            END,
            'submissionDeadline', t."SubmissionDeadline",
            'closingDate', t."ClosingDate",
            'totalBids', COALESCE(bs."TotalBids", 0),
            'scoredTechnicalBids', COALESCE(bs."ScoredTechnicalBids", 0),
            'scoredFinancialBids', COALESCE(bs."ScoredFinancialBids", 0),
            'recommendedBidId', rb."BidID",
            'recommendedVendorName', rb."VendorName",
            'recommendedCombinedScore', rb."CombinedScore",
            'latestBoardDecision', ld."Decision",
            'latestBoardComment', ld."Comment",
            'latestBoardDecidedBy', ld."DecidedBy",
            'latestBoardDecidedAt', ld."DecidedAt"
        ) ORDER BY COALESCE(t."ClosingDate", t."SubmissionDeadline", t."CreatedAt") DESC)
        FROM procurement_workflow."Tenders" t
        LEFT JOIN bid_stats bs
            ON bs."TenderID" = t."TenderID"
        LEFT JOIN ranked_bids rb
            ON rb."TenderID" = t."TenderID"
           AND rb."Ranking" = 1
        LEFT JOIN latest_decision ld
            ON ld."TenderID" = t."TenderID"
        WHERE LOWER(COALESCE(t."Status", '')) IN ('open', 'closed', 'under evaluation', 'awarded', 'cancelled')
    ), '[]'::jsonb);
END;
$$;


--
-- Name: get_tender_board_review_queue_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_tender_board_review_queue_proc(INOUT p_queue_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_queue_json := procurement_workflow."GetTenderBoardReviewQueueJson"();
END;
$$;


--
-- Name: get_tender_by_id(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_tender_by_id(p_tender_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_json JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', t."TenderID",
        'title', t."Title",
        'description', t."Description",
        'procurementCategory', t."ProcurementCategory",
        'procurementMethod', COALESCE(NULLIF(TRIM(t."ProcurementMethod"), ''), 'Open Competitive Bidding'),
        'status', t."Status",
        'submissionDeadline', t."SubmissionDeadline",
        'openingDate', t."OpeningDate",
        'closingDate', t."ClosingDate",
        'budget', t."Budget",
        'eligibilityCriteria', t."EligibilityCriteria",
        'evaluationCriteria', t."EvaluationCriteria",
        'documents', COALESCE(d.docs, '[]'::jsonb)
    )
    INTO v_json
    FROM procurement_workflow."Tenders" t
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
            'id', td."DocumentID",
            'name', td."Name",
            'contentType', td."ContentType"
        ) ORDER BY td."CreatedAt") AS docs
        FROM procurement_workflow."TenderDocuments" td
        WHERE td."TenderID" = t."TenderID"
    ) d ON TRUE
    WHERE t."TenderID" = p_tender_id;

    RETURN v_json;
END;
$$;


--
-- Name: get_tender_by_id_proc(uuid, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_tender_by_id_proc(IN p_tender_id uuid, INOUT p_tender_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_tender_json := procurement_workflow."GetTenderById"(p_tender_id);
END;
$$;


--
-- Name: get_tender_details(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_tender_details(p_tenderid uuid) RETURNS TABLE("TenderID" uuid, "Title" character varying, "Description" text, "ProcurementCategory" character varying, "Status" character varying, "SubmissionDeadline" timestamp without time zone, "OpeningDate" timestamp without time zone, "ClosingDate" timestamp without time zone, "Budget" numeric, "Specifications" text, "EligibilityCriteria" text, "EvaluationCriteria" text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."TenderID",
        t."Title",
        t."Description",
        t."ProcurementCategory",
        t."Status",
        t."SubmissionDeadline",
        t."OpeningDate",
        t."ClosingDate",
        t."Budget",
        t."Specifications",
        t."EligibilityCriteria",
        t."EvaluationCriteria"
    FROM
        procurement_workflow."Tenders" t
    WHERE
        t."TenderID" = p_TenderID;
END;
$$;


--
-- Name: get_tender_details_proc(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_tender_details_proc(IN p_tenderid uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT *
    FROM procurement_workflow."GetTenderDetails"(p_tenderid);
END;
$$;


--
-- Name: get_tender_document_proc(uuid, uuid, character varying, character varying, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.get_tender_document_proc(IN p_tender_id uuid, IN p_document_id uuid, INOUT p_name character varying DEFAULT NULL::character varying, INOUT p_content_type character varying DEFAULT NULL::character varying, INOUT p_content text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT d."Name", d."ContentType", d."Content"
    INTO p_name, p_content_type, p_content
    FROM procurement_workflow."TenderDocuments" d
    WHERE d."TenderID" = p_tender_id
      AND d."DocumentID" = p_document_id
    LIMIT 1;
END;
$$;


--
-- Name: get_threshold_for_amount(character varying, numeric); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.get_threshold_for_amount(p_procurement_type character varying, p_amount numeric) RETURNS TABLE(threshold_id uuid, approval_route character varying, requires_board boolean, requires_bpp boolean, min_amount numeric, max_amount numeric, notes text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_amount IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        t.threshold_id,
        t.approval_route,
        t.requires_board,
        t.requires_bpp,
        t.min_amount,
        t.max_amount,
        t.notes
    FROM procurement_workflow.approval_thresholds t
    WHERE t.status = 'Active'
      AND (t.procurement_type IS NULL OR (p_procurement_type IS NOT NULL AND t.procurement_type ILIKE p_procurement_type))
      AND p_amount >= t.min_amount
      AND (t.max_amount IS NULL OR p_amount <= t.max_amount)
    ORDER BY
        CASE WHEN t.procurement_type IS NULL THEN 1 ELSE 0 END,
        t.min_amount DESC
    LIMIT 1;
END;
$$;


--
-- Name: list_assigned_evaluation_tenders_json(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_assigned_evaluation_tenders_json() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'tenderId', r."TenderID",
            'title', r."Title",
            'procurementCategory', r."ProcurementCategory",
            'status', CASE LOWER(COALESCE(r."Status", 'open'))
                WHEN 'open' THEN 'Open'
                WHEN 'closed' THEN 'Closed'
                WHEN 'under evaluation' THEN 'Under Evaluation'
                WHEN 'awarded' THEN 'Awarded'
                WHEN 'cancelled' THEN 'Cancelled'
                ELSE r."Status"
            END,
            'submissionDeadline', r."SubmissionDeadline",
            'closingDate', r."ClosingDate",
            'bidCount', r."BidCount",
            'technicalScoredBids', r."TechnicalScoredBids",
            'financialScoredBids', r."FinancialScoredBids"
        ) ORDER BY r."SortDate" DESC, r."CreatedAt" DESC)
        FROM (
            SELECT
                t."TenderID",
                t."Title",
                t."ProcurementCategory",
                t."Status",
                t."SubmissionDeadline",
                t."ClosingDate",
                t."CreatedAt",
                COALESCE(t."ClosingDate", t."SubmissionDeadline", t."CreatedAt") AS "SortDate",
                COUNT(DISTINCT b."BidID") AS "BidCount",
                COUNT(DISTINCT ts."BidID") AS "TechnicalScoredBids",
                COUNT(DISTINCT fs."BidID") AS "FinancialScoredBids"
            FROM procurement_workflow."Tenders" t
            LEFT JOIN procurement_workflow."Bids" b
                ON b."TenderID" = t."TenderID"
            LEFT JOIN procurement_workflow."TenderEvaluationTechnicalScores" ts
                ON ts."TenderID" = t."TenderID"
            LEFT JOIN procurement_workflow."TenderEvaluationFinancialScores" fs
                ON fs."TenderID" = t."TenderID"
            WHERE LOWER(COALESCE(t."Status", '')) IN ('open', 'closed', 'under evaluation', 'awarded')
            GROUP BY
                t."TenderID",
                t."Title",
                t."ProcurementCategory",
                t."Status",
                t."SubmissionDeadline",
                t."ClosingDate",
                t."CreatedAt"
        ) r
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_assigned_evaluation_tenders_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_assigned_evaluation_tenders_proc(INOUT p_tenders_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_tenders_json := procurement_workflow."ListAssignedEvaluationTendersJson"();
END;
$$;


--
-- Name: list_internal_tenders(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_internal_tenders() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE procurement_workflow."Tenders"
    SET "Status" = 'Closed',
        "ClosingDate" = COALESCE("ClosingDate", NOW()),
        "UpdatedAt" = NOW()
    WHERE LOWER("Status") = 'open'
      AND "SubmissionDeadline" <= NOW();

    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', t."TenderID",
            'title', t."Title",
            'procurementCategory', t."ProcurementCategory",
            'procurementMethod', COALESCE(NULLIF(TRIM(t."ProcurementMethod"), ''), 'Open Competitive Bidding'),
            'status', t."Status",
            'submissionDeadline', t."SubmissionDeadline",
            'openingDate', t."OpeningDate",
            'closingDate', t."ClosingDate",
            'budget', t."Budget",
            'documents', COALESCE(d.docs, '[]'::jsonb)
        ) ORDER BY t."CreatedAt" DESC)
        FROM procurement_workflow."Tenders" t
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(jsonb_build_object(
                'id', td."DocumentID",
                'name', td."Name",
                'contentType', td."ContentType"
            ) ORDER BY td."CreatedAt") AS docs
            FROM procurement_workflow."TenderDocuments" td
            WHERE td."TenderID" = t."TenderID"
        ) d ON TRUE
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_internal_tenders_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_internal_tenders_proc(INOUT p_tenders_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_tenders_json := procurement_workflow."ListInternalTenders"();
END;
$$;


--
-- Name: list_open_internal_tenders(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_open_internal_tenders() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE procurement_workflow."Tenders"
    SET "Status" = 'Closed',
        "ClosingDate" = COALESCE("ClosingDate", NOW()),
        "UpdatedAt" = NOW()
    WHERE LOWER("Status") = 'open'
      AND "SubmissionDeadline" <= NOW();

    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', t."TenderID",
            'title', t."Title",
            'procurementCategory', t."ProcurementCategory",
            'status', t."Status",
            'submissionDeadline', t."SubmissionDeadline"
        ) ORDER BY t."SubmissionDeadline" ASC)
        FROM procurement_workflow."Tenders" t
        WHERE LOWER(t."Status") = 'open'
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_open_internal_tenders_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_open_internal_tenders_proc(INOUT p_tenders_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_tenders_json := procurement_workflow."ListOpenInternalTenders"();
END;
$$;


--
-- Name: list_procurement_plan_cycles(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_procurement_plan_cycles() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'planCycleId', c."PlanCycleId",
            'fiscalYear', c."FiscalYear",
            'cycleCode', c."CycleCode",
            'title', c."Title",
            'department', c."Department",
            'status', c."Status",
            'createdBy', c."CreatedBy",
            'createdAt', c."CreatedAt",
            'submittedAt', c."SubmittedAt",
            'approvedBy', c."ApprovedBy",
            'approvedAt', c."ApprovedAt",
            'rejectionReason', c."RejectionReason"
        ) ORDER BY c."FiscalYear" DESC, c."CreatedAt" DESC)
        FROM procurement_workflow."ProcurementPlanCycles" c
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_procurement_plan_cycles_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_procurement_plan_cycles_proc(INOUT p_cycles_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_cycles_json := procurement_workflow."ListProcurementPlanCycles"();
END;
$$;


--
-- Name: list_procurement_plan_items(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_procurement_plan_items() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'planItemId', i."PlanItemId",
            'planCycleId', i."PlanCycleId",
            'fiscalYear', i."FiscalYear",
            'appCode', i."AppCode",
            'title', i."Title",
            'department', i."Department",
            'procurementCategory', i."ProcurementCategory",
            'budgetCode', i."BudgetCode",
            'fundingSource', i."FundingSource",
            'estimatedCost', i."EstimatedCost",
            'procurementMethod', i."ProcurementMethod",
            'bppNoObjectionRequired', i."BppNoObjectionRequired",
            'budgetVerified', i."BudgetVerified",
            'budgetVerifiedBy', i."BudgetVerifiedBy",
            'budgetVerifiedAt', i."BudgetVerifiedAt",
            'status', i."Status",
            'createdBy', i."CreatedBy",
            'createdAt', i."CreatedAt"
        ) ORDER BY i."CreatedAt" DESC)
        FROM procurement_workflow."ProcurementPlanItems" i
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_procurement_plan_items_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_procurement_plan_items_proc(INOUT p_items_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_items_json := procurement_workflow."ListProcurementPlanItems"();
END;
$$;


--
-- Name: list_requisition_audit_json(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_requisition_audit_json(p_requisition_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', e."Id",
            'requisitionId', e."RequisitionId",
            'eventType', e."EventType",
            'actorEmail', e."ActorEmail",
            'detail', e."Detail",
            'occurredAt', e."OccurredAt"
        ) ORDER BY e."OccurredAt" DESC)
        FROM procurement_workflow."RequisitionAuditEvents" e
        WHERE e."RequisitionId" = p_requisition_id
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_requisition_audit_proc(uuid, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_requisition_audit_proc(IN p_requisition_id uuid, INOUT p_audit_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_audit_json := procurement_workflow."ListRequisitionAuditJson"(p_requisition_id);
END;
$$;


--
-- Name: list_requisitions_json(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_requisitions_json() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(procurement_workflow."GetRequisitionSummaryJson"(r."RequisitionId") ORDER BY r."SubmittedAt" DESC)
        FROM procurement_workflow."InternalRequisitions" r
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_requisitions_proc(jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_requisitions_proc(INOUT p_requisitions_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisitions_json := procurement_workflow."ListRequisitionsJson"();
END;
$$;


--
-- Name: list_tender_evaluation_bids_json(uuid, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.list_tender_evaluation_bids_json(p_tender_id uuid, p_evaluator_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'bidId', b."BidID",
            'tenderId', b."TenderID",
            'vendorId', b."VendorID",
            'vendorName', COALESCE(v."CompanyName", 'Unknown Vendor'),
            'financialBid', b."FinancialBid",
            'technicalProposal', b."TechnicalProposal",
            'submissionDate', b."SubmissionDate",
            'bidStatus', CASE LOWER(COALESCE(b."BidStatus", 'submitted'))
                WHEN 'submitted' THEN 'Submitted'
                WHEN 'under review' THEN 'Under Review'
                WHEN 'approved' THEN 'Approved'
                WHEN 'accepted' THEN 'Approved'
                WHEN 'rejected' THEN 'Rejected'
                ELSE b."BidStatus"
            END,
            'myTechnicalScore', ts_self."Score",
            'myTechnicalRemarks', ts_self."Remarks",
            'myFinancialScore', fs_self."Score",
            'myFinancialRemarks', fs_self."Remarks",
            'averageTechnicalScore', ts_avg."AverageTechnicalScore",
            'averageFinancialScore', fs_avg."AverageFinancialScore"
        ) ORDER BY b."FinancialBid" ASC, b."SubmissionDate" ASC)
        FROM procurement_workflow."Bids" b
        LEFT JOIN identity."Vendors" v
            ON v."VendorID" = b."VendorID"
        LEFT JOIN procurement_workflow."TenderEvaluationTechnicalScores" ts_self
            ON ts_self."BidID" = b."BidID"
           AND ts_self."EvaluatorEmail" = p_evaluator_email
        LEFT JOIN procurement_workflow."TenderEvaluationFinancialScores" fs_self
            ON fs_self."BidID" = b."BidID"
           AND fs_self."EvaluatorEmail" = p_evaluator_email
        LEFT JOIN (
            SELECT
                "BidID",
                ROUND(AVG("Score"), 2) AS "AverageTechnicalScore"
            FROM procurement_workflow."TenderEvaluationTechnicalScores"
            GROUP BY "BidID"
        ) ts_avg
            ON ts_avg."BidID" = b."BidID"
        LEFT JOIN (
            SELECT
                "BidID",
                ROUND(AVG("Score"), 2) AS "AverageFinancialScore"
            FROM procurement_workflow."TenderEvaluationFinancialScores"
            GROUP BY "BidID"
        ) fs_avg
            ON fs_avg."BidID" = b."BidID"
        WHERE b."TenderID" = p_tender_id
    ), '[]'::jsonb);
END;
$$;


--
-- Name: list_tender_evaluation_bids_proc(uuid, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.list_tender_evaluation_bids_proc(IN p_tender_id uuid, IN p_evaluator_email character varying, INOUT p_bids_json jsonb DEFAULT '[]'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_bids_json := procurement_workflow."ListTenderEvaluationBidsJson"(p_tender_id, p_evaluator_email);
END;
$$;


--
-- Name: publish_tender(uuid, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.publish_tender(p_tender_id uuid, p_channel character varying, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status VARCHAR(50);
BEGIN
    SELECT t."Status" INTO v_status
    FROM procurement_workflow."Tenders" t
    WHERE t."TenderID" = p_tender_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Tender not found.';
    END IF;

    IF LOWER(v_status) <> 'draft' THEN
        RAISE EXCEPTION 'Only draft tenders can be published.';
    END IF;

    UPDATE procurement_workflow."Tenders"
    SET "Status" = 'Open',
        "PublishedAt" = NOW(),
        "AdvertisementChannel" = TRIM(p_channel),
        "PublishedBy" = p_actor_email,
        "UpdatedBy" = p_actor_email,
        "UpdatedAt" = NOW()
    WHERE "TenderID" = p_tender_id;

    RETURN jsonb_build_object(
        'id', p_tender_id,
        'status', 'Open',
        'publishedAt', NOW(),
        'advertisementChannel', TRIM(p_channel),
        'publishedBy', p_actor_email
    );
END;
$$;


--
-- Name: publish_tender_proc(uuid, character varying, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.publish_tender_proc(IN p_tender_id uuid, IN p_channel character varying, IN p_actor_email character varying, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."PublishTender"(p_tender_id, p_channel, p_actor_email);
END;
$$;


--
-- Name: record_expenditure_sp(character varying, numeric, text, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.record_expenditure_sp(p_contract_code character varying, p_amount numeric, p_notes text, p_recorded_by character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_contract_id UUID;
    v_commitment_id UUID;
    v_expenditure_id UUID;
BEGIN
    -- Find commitment linked to the same tender title/vendor as this contract
    SELECT bc.commitment_id
    INTO v_commitment_id
    FROM procurement_workflow.budget_commitments bc
    WHERE bc.tender_id IN (
        SELECT tender_id FROM vendor_sourcing.tenders WHERE title = (SELECT tender_title FROM post_award.contracts WHERE contract_code = p_contract_code LIMIT 1)
    )
    AND bc.status IN ('Reserved', 'Committed')
    LIMIT 1;

    IF v_commitment_id IS NULL THEN
        -- Fallback: find by requisition_id if tender is missing
        SELECT bc.commitment_id
        INTO v_commitment_id
        FROM procurement_workflow.budget_commitments bc
        WHERE bc.requisition_id IN (
            SELECT requisition_id 
            FROM procurement_workflow.requisitions r
            JOIN post_award.contracts c ON c.tender_title = r.subject -- loose matching
            WHERE c.contract_code = p_contract_code
        )
        AND bc.status IN ('Reserved', 'Committed')
        LIMIT 1;
    END IF;

    -- Record the expenditure if commitment found
    IF v_commitment_id IS NOT NULL THEN
        INSERT INTO procurement_workflow.budget_expenditures (
            commitment_id,
            amount,
            spent_at,
            notes,
            created_by
        )
        VALUES (
            v_commitment_id,
            p_amount,
            NOW(),
            p_notes,
            p_recorded_by
        )
        RETURNING expenditure_id INTO v_expenditure_id;
    END IF;

    RETURN v_expenditure_id;
END;
$$;


--
-- Name: reject_procurement_plan_cycle(uuid, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.reject_procurement_plan_cycle(p_plan_cycle_id uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cycle procurement_workflow."ProcurementPlanCycles"%ROWTYPE;
BEGIN
    SELECT * INTO v_cycle
    FROM procurement_workflow."ProcurementPlanCycles"
    WHERE "PlanCycleId" = p_plan_cycle_id;

    IF v_cycle."PlanCycleId" IS NULL THEN
        RAISE EXCEPTION 'APP cycle not found.';
    END IF;

    IF LOWER(v_cycle."Status") <> 'submitted' THEN
        RAISE EXCEPTION 'Only Submitted APP cycles can be rejected.';
    END IF;

    UPDATE procurement_workflow."ProcurementPlanItems"
    SET "Status" = 'Draft'
    WHERE "PlanCycleId" = p_plan_cycle_id;

    UPDATE procurement_workflow."ProcurementPlanCycles"
    SET "Status" = 'Draft',
        "RejectionReason" = p_reason
    WHERE "PlanCycleId" = p_plan_cycle_id;

    RETURN jsonb_build_object(
        'planCycleId', p_plan_cycle_id,
        'status', 'Draft',
        'rejectionReason', p_reason
    );
END;
$$;


--
-- Name: reject_procurement_plan_cycle_proc(uuid, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.reject_procurement_plan_cycle_proc(IN p_plan_cycle_id uuid, IN p_reason text, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."RejectProcurementPlanCycle"(p_plan_cycle_id, p_reason);
END;
$$;


--
-- Name: reject_task_proc(uuid, character varying, character varying, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.reject_task_proc(IN p_task_id uuid, IN p_actor_email character varying, IN p_actor_role character varying, IN p_comment text, INOUT p_requisition_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisition_json := procurement_workflow."ApprovalRejectJson"(p_task_id, p_actor_email, p_actor_role, p_comment);
END;
$$;


--
-- Name: release_budget_for_requisition(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.release_budget_for_requisition(p_requisition_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE procurement_workflow.budget_commitments
    SET
        status = 'Released',
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id
      AND status IN ('Reserved', 'Committed');
END;
$$;


--
-- Name: release_budget_for_tender(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.release_budget_for_tender(p_tender_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE procurement_workflow.budget_commitments
    SET
        status = 'Released',
        updated_at = NOW()
    WHERE tender_id = p_tender_id
      AND status IN ('Reserved', 'Committed');
END;
$$;


--
-- Name: require_bpp_no_objection(uuid, character varying, numeric); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.require_bpp_no_objection(p_requisition_id uuid, p_procurement_type character varying, p_amount numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_requires_bpp BOOLEAN;
BEGIN
    SELECT requires_bpp
    INTO v_requires_bpp
    FROM procurement_workflow.get_threshold_for_amount(p_procurement_type, p_amount);

    IF COALESCE(v_requires_bpp, FALSE) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM procurement_workflow.bpp_no_objections b
            WHERE b.requisition_id = p_requisition_id
              AND b.status = 'Approved'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BPP No Objection approval is required before approval.';
        END IF;
    END IF;
END;
$$;


--
-- Name: reserve_budget_for_requisition(uuid, character varying, character varying, integer, numeric); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.reserve_budget_for_requisition(p_requisition_id uuid, p_budget_code character varying, p_department character varying, p_fiscal_year integer, p_amount numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_existing_id UUID;
    v_existing_amount DECIMAL(18, 2);
    v_available DECIMAL(18, 2);
    v_appropriation_id UUID;
BEGIN
    IF p_budget_code IS NULL OR btrim(p_budget_code) = '' THEN
        RETURN;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Budget reservation amount must be greater than 0.';
    END IF;

    SELECT commitment_id, amount
    INTO v_existing_id, v_existing_amount
    FROM procurement_workflow.budget_commitments
    WHERE requisition_id = p_requisition_id
      AND status IN ('Reserved', 'Committed')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    v_available := procurement_workflow.get_budget_available(p_budget_code, p_department, p_fiscal_year);

    SELECT a.appropriation_id
    INTO v_appropriation_id
    FROM procurement_workflow.budget_appropriations a
    WHERE a.budget_code = p_budget_code
      AND a.department = p_department
      AND a.fiscal_year = p_fiscal_year
      AND a.status = 'Active'
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_appropriation_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Active appropriation not found for this budget code, department, and fiscal year.';
    END IF;

    IF v_existing_id IS NOT NULL THEN
        v_available := v_available + v_existing_amount;
    END IF;

    IF p_amount > v_available THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Insufficient budget available for this requisition.';
    END IF;

    IF v_existing_id IS NULL THEN
        INSERT INTO procurement_workflow.budget_commitments (
            appropriation_id,
            requisition_id,
            fiscal_year,
            department,
            budget_code,
            amount,
            status,
            committed_at
        )
        VALUES (
            v_appropriation_id,
            p_requisition_id,
            p_fiscal_year,
            p_department,
            p_budget_code,
            p_amount,
            'Reserved',
            NOW()
        );
    ELSE
        UPDATE procurement_workflow.budget_commitments
        SET
            appropriation_id = v_appropriation_id,
            fiscal_year = p_fiscal_year,
            department = p_department,
            budget_code = p_budget_code,
            amount = p_amount,
            updated_at = NOW()
        WHERE commitment_id = v_existing_id;
    END IF;
END;
$$;


--
-- Name: reserve_budget_for_tender(uuid, character varying, character varying, integer, numeric); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.reserve_budget_for_tender(p_tender_id uuid, p_budget_code character varying, p_department character varying, p_fiscal_year integer, p_amount numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_existing_id UUID;
    v_existing_amount DECIMAL(18, 2);
    v_available DECIMAL(18, 2);
BEGIN
    IF p_budget_code IS NULL OR btrim(p_budget_code) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BudgetCode is required for tender budget reservation.';
    END IF;

    IF p_department IS NULL OR btrim(p_department) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department is required for tender budget reservation.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tender budget reservation amount must be greater than 0.';
    END IF;

    SELECT commitment_id, amount
    INTO v_existing_id, v_existing_amount
    FROM procurement_workflow.budget_commitments
    WHERE tender_id = p_tender_id
      AND status IN ('Reserved', 'Committed')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    v_available := procurement_workflow.get_budget_available(p_budget_code, p_department, p_fiscal_year);

    IF v_existing_id IS NOT NULL THEN
        v_available := v_available + v_existing_amount;
    END IF;

    IF p_amount > v_available THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Insufficient budget available for this tender.';
    END IF;

    IF v_existing_id IS NULL THEN
        INSERT INTO procurement_workflow.budget_commitments (
            tender_id,
            fiscal_year,
            department,
            budget_code,
            amount,
            status,
            committed_at
        )
        VALUES (
            p_tender_id,
            p_fiscal_year,
            p_department,
            p_budget_code,
            p_amount,
            'Reserved',
            NOW()
        );
    ELSE
        UPDATE procurement_workflow.budget_commitments
        SET
            fiscal_year = p_fiscal_year,
            department = p_department,
            budget_code = p_budget_code,
            amount = p_amount,
            updated_at = NOW()
        WHERE commitment_id = v_existing_id;
    END IF;
END;
$$;


--
-- Name: resolve_requisition_stage(character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.resolve_requisition_stage(p_status character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN CASE
        WHEN p_status IS NULL THEN 'department_need_capture'
        WHEN p_status ILIKE 'Draft' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Submitted' THEN 'department_head_endorsement'
        WHEN p_status ILIKE 'Endorsed' THEN 'budget_code_allocation'
        WHEN p_status ILIKE 'Initial' THEN 'comptroller_procurement_review'
        WHEN p_status ILIKE 'Under Review' THEN 'planning_committee_review'
        WHEN p_status ILIKE 'Evaluation' THEN 'evaluation'
        WHEN p_status ILIKE 'Board Review' THEN 'tenders_board_review'
        WHEN p_status ILIKE 'Approved' THEN 'accounting_officer_review'
        WHEN p_status ILIKE 'Rejected' THEN 'department_need_capture'
        ELSE 'department_need_capture'
    END;
END;
$$;


--
-- Name: resolve_sla_days_fn(character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.resolve_sla_days_fn(p_required_role character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN CASE LOWER(p_required_role)
        WHEN 'accounting_officer' THEN 2
        WHEN 'tenders_board' THEN 3
        ELSE 3
    END;
END;
$$;


--
-- Name: resubmit_requisition_json(uuid, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.resubmit_requisition_json(p_requisition_id uuid, p_actor_email character varying, p_response text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_req procurement_workflow."InternalRequisitions"%ROWTYPE;
    v_task procurement_workflow."RequisitionApprovalTasks"%ROWTYPE;
BEGIN
    SELECT * INTO v_req
    FROM procurement_workflow."InternalRequisitions"
    WHERE "RequisitionId" = p_requisition_id;

    IF v_req."RequisitionId" IS NULL THEN
        RAISE EXCEPTION 'Requisition not found.';
    END IF;

    IF LOWER(v_req."CreatedBy") <> LOWER(p_actor_email) THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    SELECT * INTO v_task
    FROM procurement_workflow."RequisitionApprovalTasks"
    WHERE "RequisitionId" = p_requisition_id
      AND LOWER("Status") = 'clarificationrequested'
    ORDER BY "Sequence"
    LIMIT 1;

    IF v_task."ApprovalTaskId" IS NULL THEN
        RAISE EXCEPTION 'No clarification request exists for this requisition.';
    END IF;

    UPDATE procurement_workflow."RequisitionApprovalTasks"
    SET "Status" = 'Pending',
        "Decision" = NULL,
        "DecisionComment" = NULL,
        "ActionedBy" = NULL,
        "ActionedAt" = NULL,
        "DueAt" = NOW() + INTERVAL '3 days'
    WHERE "ApprovalTaskId" = v_task."ApprovalTaskId";

    UPDATE procurement_workflow."InternalRequisitions"
    SET "Status" = 'Pending ' || v_task."StageName"
    WHERE "RequisitionId" = p_requisition_id;

    INSERT INTO procurement_workflow."RequisitionAuditEvents" (
        "Id", "RequisitionId", "EventType", "ActorEmail", "Detail", "OccurredAt")
    VALUES (
        gen_random_uuid(),
        p_requisition_id,
        'ClarificationResponded',
        LOWER(TRIM(p_actor_email)),
        p_response,
        NOW()
    );

    RETURN procurement_workflow."GetRequisitionSummaryJson"(p_requisition_id);
END;
$$;


--
-- Name: resubmit_requisition_proc(uuid, character varying, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.resubmit_requisition_proc(IN p_requisition_id uuid, IN p_actor_email character varying, IN p_response text, INOUT p_requisition_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_requisition_json := procurement_workflow."ResubmitRequisitionJson"(p_requisition_id, p_actor_email, p_response);
END;
$$;


--
-- Name: save_tender_board_decision(uuid, character varying, text, uuid, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.save_tender_board_decision(p_tender_id uuid, p_decision character varying, p_comment text, p_recommended_bid_id uuid, p_actor_email character varying, p_actor_role character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tender_status VARCHAR(50);
    v_normalized_decision VARCHAR(30);
    v_final_decision VARCHAR(30);
    v_comment TEXT;
    v_recommended_bid_id UUID;
    v_recommended_vendor_id UUID;
BEGIN
    v_normalized_decision := LOWER(TRIM(COALESCE(p_decision, '')));
    IF v_normalized_decision IN ('approve', 'approved') THEN
        v_final_decision := 'Approved';
    ELSIF v_normalized_decision IN ('reject', 'rejected') THEN
        v_final_decision := 'Rejected';
    ELSE
        RAISE EXCEPTION 'Invalid decision. Use approve or reject.';
    END IF;

    IF LOWER(TRIM(COALESCE(p_actor_role, ''))) NOT IN ('tenders_board', 'accounting_officer', 'ict_admin') THEN
        RAISE EXCEPTION 'Forbidden: role is not allowed to decide tender board outcomes.';
    END IF;

    SELECT t."Status"
    INTO v_tender_status
    FROM procurement_workflow."Tenders" t
    WHERE t."TenderID" = p_tender_id
    LIMIT 1;

    IF v_tender_status IS NULL THEN
        RAISE EXCEPTION 'Tender not found.';
    END IF;

    v_comment := NULLIF(TRIM(COALESCE(p_comment, '')), '');
    IF v_final_decision = 'Rejected' AND LENGTH(COALESCE(v_comment, '')) < 5 THEN
        RAISE EXCEPTION 'Rejection comment is required (minimum 5 characters).';
    END IF;

    v_recommended_bid_id := p_recommended_bid_id;
    v_recommended_vendor_id := NULL;

    IF v_final_decision = 'Approved' THEN
        IF v_recommended_bid_id IS NOT NULL THEN
            SELECT b."VendorID"
            INTO v_recommended_vendor_id
            FROM procurement_workflow."Bids" b
            WHERE b."BidID" = v_recommended_bid_id
              AND b."TenderID" = p_tender_id
            LIMIT 1;

            IF v_recommended_vendor_id IS NULL THEN
                RAISE EXCEPTION 'Recommended bid is not linked to the selected tender.';
            END IF;
        ELSE
            WITH technical_avg AS (
                SELECT
                    ts."BidID",
                    ROUND(AVG(ts."Score"), 2) AS "AverageTechnicalScore"
                FROM procurement_workflow."TenderEvaluationTechnicalScores" ts
                GROUP BY ts."BidID"
            ),
            financial_avg AS (
                SELECT
                    fs."BidID",
                    ROUND(AVG(fs."Score"), 2) AS "AverageFinancialScore"
                FROM procurement_workflow."TenderEvaluationFinancialScores" fs
                GROUP BY fs."BidID"
            ),
            ranked AS (
                SELECT
                    b."BidID",
                    b."VendorID",
                    b."FinancialBid",
                    ta."AverageTechnicalScore",
                    fa."AverageFinancialScore",
                    ROUND(
                        (COALESCE(ta."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                        + (COALESCE(fa."AverageFinancialScore", 0)::NUMERIC * 0.30),
                        2
                    ) AS "CombinedScore",
                    ROW_NUMBER() OVER (
                        ORDER BY
                            CASE
                                WHEN ta."AverageTechnicalScore" IS NOT NULL
                                 AND fa."AverageFinancialScore" IS NOT NULL THEN 0
                                ELSE 1
                            END,
                            ROUND(
                                (COALESCE(ta."AverageTechnicalScore", 0)::NUMERIC * 0.70)
                                + (COALESCE(fa."AverageFinancialScore", 0)::NUMERIC * 0.30),
                                2
                            ) DESC,
                            b."FinancialBid" ASC,
                            b."SubmissionDate" ASC
                    ) AS "Ranking"
                FROM procurement_workflow."Bids" b
                LEFT JOIN technical_avg ta
                    ON ta."BidID" = b."BidID"
                LEFT JOIN financial_avg fa
                    ON fa."BidID" = b."BidID"
                WHERE b."TenderID" = p_tender_id
            )
            SELECT r."BidID", r."VendorID"
            INTO v_recommended_bid_id, v_recommended_vendor_id
            FROM ranked r
            WHERE r."Ranking" = 1;

            IF v_recommended_bid_id IS NULL THEN
                RAISE EXCEPTION 'No bids are available for approval on this tender.';
            END IF;
        END IF;
    END IF;

    INSERT INTO procurement_workflow."TenderBoardDecisions" (
        "DecisionID",
        "TenderID",
        "Decision",
        "Comment",
        "RecommendedBidID",
        "RecommendedVendorID",
        "DecidedBy",
        "DecidedRole",
        "DecidedAt"
    )
    VALUES (
        gen_random_uuid(),
        p_tender_id,
        v_final_decision,
        v_comment,
        v_recommended_bid_id,
        v_recommended_vendor_id,
        p_actor_email,
        p_actor_role,
        NOW()
    );

    IF v_final_decision = 'Approved' THEN
        UPDATE procurement_workflow."Tenders"
        SET "Status" = 'Awarded',
            "AwardedBidID" = v_recommended_bid_id,
            "AwardedVendorID" = v_recommended_vendor_id,
            "AwardedBy" = p_actor_email,
            "AwardedAt" = NOW(),
            "AwardDecisionNote" = v_comment,
            "UpdatedBy" = p_actor_email,
            "UpdatedAt" = NOW()
        WHERE "TenderID" = p_tender_id;
    ELSE
        UPDATE procurement_workflow."Tenders"
        SET "Status" = 'Cancelled',
            "AwardedBidID" = NULL,
            "AwardedVendorID" = NULL,
            "AwardedBy" = NULL,
            "AwardedAt" = NULL,
            "AwardDecisionNote" = v_comment,
            "UpdatedBy" = p_actor_email,
            "UpdatedAt" = NOW()
        WHERE "TenderID" = p_tender_id;
    END IF;

    RETURN jsonb_build_object(
        'tenderId', p_tender_id,
        'decision', v_final_decision,
        'status', CASE WHEN v_final_decision = 'Approved' THEN 'Awarded' ELSE 'Cancelled' END,
        'recommendedBidId', v_recommended_bid_id,
        'recommendedVendorId', v_recommended_vendor_id,
        'decidedBy', p_actor_email,
        'decidedAt', NOW()
    );
END;
$$;


--
-- Name: save_tender_board_decision_proc(uuid, character varying, text, uuid, character varying, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.save_tender_board_decision_proc(IN p_tender_id uuid, IN p_decision character varying, IN p_comment text, IN p_recommended_bid_id uuid, IN p_actor_email character varying, IN p_actor_role character varying, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."SaveTenderBoardDecision"(
        p_tender_id,
        p_decision,
        p_comment,
        p_recommended_bid_id,
        p_actor_email,
        p_actor_role
    );
END;
$$;


--
-- Name: save_tender_financial_score(uuid, uuid, character varying, numeric, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.save_tender_financial_score(p_tender_id uuid, p_bid_id uuid, p_evaluator_email character varying, p_score numeric, p_remarks text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_score < 0 OR p_score > 100 THEN
        RAISE EXCEPTION 'Score must be between 0 and 100.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM procurement_workflow."Bids" b
        WHERE b."BidID" = p_bid_id
          AND b."TenderID" = p_tender_id
    ) THEN
        RAISE EXCEPTION 'Bid is not linked to the selected tender.';
    END IF;

    INSERT INTO procurement_workflow."TenderEvaluationFinancialScores" (
        "TenderID",
        "BidID",
        "EvaluatorEmail",
        "Score",
        "Remarks",
        "CreatedAt",
        "UpdatedAt"
    )
    VALUES (
        p_tender_id,
        p_bid_id,
        p_evaluator_email,
        p_score,
        NULLIF(TRIM(COALESCE(p_remarks, '')), ''),
        NOW(),
        NOW()
    )
    ON CONFLICT ("TenderID", "BidID", "EvaluatorEmail")
    DO UPDATE SET
        "Score" = EXCLUDED."Score",
        "Remarks" = EXCLUDED."Remarks",
        "UpdatedAt" = NOW();

    UPDATE procurement_workflow."Tenders"
    SET "Status" = 'Under Evaluation',
        "UpdatedBy" = p_evaluator_email,
        "UpdatedAt" = NOW()
    WHERE "TenderID" = p_tender_id
      AND LOWER(COALESCE("Status", '')) IN ('open', 'closed');

    RETURN jsonb_build_object(
        'message', 'Financial score saved.',
        'tenderId', p_tender_id,
        'bidId', p_bid_id,
        'score', p_score
    );
END;
$$;


--
-- Name: save_tender_financial_score_proc(uuid, uuid, character varying, numeric, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.save_tender_financial_score_proc(IN p_tender_id uuid, IN p_bid_id uuid, IN p_evaluator_email character varying, IN p_score numeric, IN p_remarks text, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."SaveTenderFinancialScore"(
        p_tender_id,
        p_bid_id,
        p_evaluator_email,
        p_score,
        p_remarks
    );
END;
$$;


--
-- Name: save_tender_technical_score(uuid, uuid, character varying, numeric, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.save_tender_technical_score(p_tender_id uuid, p_bid_id uuid, p_evaluator_email character varying, p_score numeric, p_remarks text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_score < 0 OR p_score > 100 THEN
        RAISE EXCEPTION 'Score must be between 0 and 100.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM procurement_workflow."Bids" b
        WHERE b."BidID" = p_bid_id
          AND b."TenderID" = p_tender_id
    ) THEN
        RAISE EXCEPTION 'Bid is not linked to the selected tender.';
    END IF;

    INSERT INTO procurement_workflow."TenderEvaluationTechnicalScores" (
        "TenderID",
        "BidID",
        "EvaluatorEmail",
        "Score",
        "Remarks",
        "CreatedAt",
        "UpdatedAt"
    )
    VALUES (
        p_tender_id,
        p_bid_id,
        p_evaluator_email,
        p_score,
        NULLIF(TRIM(COALESCE(p_remarks, '')), ''),
        NOW(),
        NOW()
    )
    ON CONFLICT ("TenderID", "BidID", "EvaluatorEmail")
    DO UPDATE SET
        "Score" = EXCLUDED."Score",
        "Remarks" = EXCLUDED."Remarks",
        "UpdatedAt" = NOW();

    UPDATE procurement_workflow."Tenders"
    SET "Status" = 'Under Evaluation',
        "UpdatedBy" = p_evaluator_email,
        "UpdatedAt" = NOW()
    WHERE "TenderID" = p_tender_id
      AND LOWER(COALESCE("Status", '')) IN ('open', 'closed');

    RETURN jsonb_build_object(
        'message', 'Technical score saved.',
        'tenderId', p_tender_id,
        'bidId', p_bid_id,
        'score', p_score
    );
END;
$$;


--
-- Name: save_tender_technical_score_proc(uuid, uuid, character varying, numeric, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.save_tender_technical_score_proc(IN p_tender_id uuid, IN p_bid_id uuid, IN p_evaluator_email character varying, IN p_score numeric, IN p_remarks text, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."SaveTenderTechnicalScore"(
        p_tender_id,
        p_bid_id,
        p_evaluator_email,
        p_score,
        p_remarks
    );
END;
$$;


--
-- Name: seed_procurement_plans(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.seed_procurement_plans() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cycle_id UUID;
BEGIN
    INSERT INTO procurement_workflow."BudgetLines" ("BudgetCode", "Department", "FundingSource", "AllocatedAmount", "IsActive")
    VALUES
        ('BUD-ICT-CAPEX-2026-04', 'ICT Directorate', 'Capital Expenditure', 35000000, TRUE),
        ('BUD-LOG-REC-2026-11', 'Logistics and Supply Chain', 'Recurrent', 18000000, TRUE)
    ON CONFLICT ("BudgetCode") DO NOTHING;

    SELECT "PlanCycleId" INTO v_cycle_id
    FROM procurement_workflow."ProcurementPlanCycles"
    WHERE "CycleCode" = 'NIS-APP-2026' AND "FiscalYear" = EXTRACT(YEAR FROM NOW())::INT
    LIMIT 1;

    IF v_cycle_id IS NULL THEN
        INSERT INTO procurement_workflow."ProcurementPlanCycles" (
            "PlanCycleId", "FiscalYear", "CycleCode", "Title", "Department", "Status",
            "CreatedBy", "CreatedAt", "SubmittedAt", "ApprovedBy", "ApprovedAt", "RejectionReason")
        VALUES (
            gen_random_uuid(),
            EXTRACT(YEAR FROM NOW())::INT,
            'NIS-APP-2026',
            'NIS Annual Procurement Plan 2026',
            'Procurement Unit',
            'Approved',
            'procurement.officer@nis.gov.ng',
            NOW() - INTERVAL '30 days',
            NOW() - INTERVAL '28 days',
            'accounting.officer@nis.gov.ng',
            NOW() - INTERVAL '24 days',
            NULL
        )
        RETURNING "PlanCycleId" INTO v_cycle_id;
    END IF;

    INSERT INTO procurement_workflow."ProcurementPlanItems" (
        "PlanItemId", "PlanCycleId", "FiscalYear", "AppCode", "Title", "Department", "ProcurementCategory",
        "BudgetCode", "FundingSource", "EstimatedCost", "ProcurementMethod", "BppNoObjectionRequired",
        "BudgetVerified", "BudgetVerifiedBy", "BudgetVerifiedAt", "Status", "CreatedBy", "CreatedAt")
    VALUES (
        gen_random_uuid(), v_cycle_id, EXTRACT(YEAR FROM NOW())::INT, 'APP-2026-ICT-014',
        'Border Surveillance Accessories Batch A', 'ICT Directorate', 'Goods',
        'BUD-ICT-CAPEX-2026-04', 'Capital Expenditure', 12500000,
        'National Competitive Bidding', FALSE, TRUE, 'procurement.officer@nis.gov.ng',
        NOW() - INTERVAL '27 days', 'Approved', 'procurement.officer@nis.gov.ng', NOW() - INTERVAL '15 days'
    )
    ON CONFLICT ("AppCode") DO NOTHING;
END;
$$;


--
-- Name: seed_procurement_plans_proc(); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.seed_procurement_plans_proc()
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM procurement_workflow."SeedProcurementPlans"();
END;
$$;


--
-- Name: seed_requisition_data(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.seed_requisition_data() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_exists UUID;
    v_json JSONB;
BEGIN
    SELECT "RequisitionId" INTO v_exists
    FROM procurement_workflow."InternalRequisitions"
    WHERE "AppReference" = 'APP-2026-ICT-014'
    LIMIT 1;

    IF v_exists IS NULL THEN
        v_json := procurement_workflow."CreateRequisitionJson"(
            'Border Surveillance Accessories Batch A',
            'ICT Directorate',
            'Goods',
            'APP-2026-ICT-014',
            'BUD-ICT-CAPEX-2026-04',
            12500000,
            'Support border command centers with resilient surveillance accessories for operational continuity.',
            'Departmental need captured and reviewed for Q2 operations.',
            'Medium',
            NOW() + INTERVAL '45 days',
            'department.user@nis.gov.ng'
        );
    END IF;
END;
$$;


--
-- Name: seed_requisition_data_proc(); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.seed_requisition_data_proc()
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM procurement_workflow."SeedRequisitionData"();
END;
$$;


--
-- Name: seed_tender_data(); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.seed_tender_data() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tender_id UUID;
BEGIN
    SELECT t."TenderID"
    INTO v_tender_id
    FROM procurement_workflow."Tenders" t
    WHERE t."Title" = 'Integrated Border Post Communication Upgrade'
    LIMIT 1;

    IF v_tender_id IS NULL THEN
        INSERT INTO procurement_workflow."Tenders" (
            "TenderID", "Title", "Description", "ProcurementCategory", "Status",
            "SubmissionDeadline", "OpeningDate", "ClosingDate", "Budget",
            "EligibilityCriteria", "EvaluationCriteria", "ProcurementMethod",
            "CreatedBy", "CreatedAt")
        VALUES (
            gen_random_uuid(),
            'Integrated Border Post Communication Upgrade',
            'Deployment and integration of resilient communication endpoints across selected border posts.',
            'Goods',
            'Draft',
            NOW() + INTERVAL '2 days',
            NOW() + INTERVAL '3 days',
            NOW() + INTERVAL '32 days',
            84500000,
            'OEM compliance certification, local support capability, and successful delivery references in similar deployments.',
            'Technical compliance (40%), delivery timeline (20%), after-sales service (10%), and price competitiveness (30%).',
            'Open Competitive Bidding',
            'procurement.officer@nis.gov.ng',
            NOW() - INTERVAL '1 days'
        )
        RETURNING "TenderID" INTO v_tender_id;
    END IF;

    INSERT INTO procurement_workflow."TenderDocuments" ("DocumentID", "TenderID", "Name", "ContentType", "Content")
    SELECT gen_random_uuid(), v_tender_id, 'Invitation to Bid', 'text/plain',
           'Invitation to Bid for Integrated Border Post Communication Upgrade.
Submission closes at the official deadline.
All bids must comply with eligibility criteria.'
    WHERE NOT EXISTS (
        SELECT 1 FROM procurement_workflow."TenderDocuments" d
        WHERE d."TenderID" = v_tender_id AND d."Name" = 'Invitation to Bid'
    );

    INSERT INTO procurement_workflow."TenderDocuments" ("DocumentID", "TenderID", "Name", "ContentType", "Content")
    SELECT gen_random_uuid(), v_tender_id, 'Technical Requirements', 'text/plain',
           'Technical Requirements:
- Ruggedized hardware support
- Redundant communication links
- 24-month warranty
- On-site commissioning at designated posts'
    WHERE NOT EXISTS (
        SELECT 1 FROM procurement_workflow."TenderDocuments" d
        WHERE d."TenderID" = v_tender_id AND d."Name" = 'Technical Requirements'
    );
END;
$$;


--
-- Name: seed_tender_data_proc(); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.seed_tender_data_proc()
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM procurement_workflow."SeedTenderData"();
END;
$$;


--
-- Name: submit_bid(uuid, uuid, numeric, text, integer); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.submit_bid(p_tenderid uuid, p_vendorid uuid, p_financialbid numeric, p_technicalproposal text, p_validityperioddays integer) RETURNS TABLE("BidID" uuid, "TenderID" uuid, "VendorID" uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    INSERT INTO procurement_workflow."Bids" (
        "TenderID",
        "VendorID",
        "FinancialBid",
        "TechnicalProposal",
        "ValidityPeriodDays",
        "BidStatus"
    )
    VALUES (
        p_TenderID,
        p_VendorID,
        p_FinancialBid,
        p_TechnicalProposal,
        p_ValidityPeriodDays,
        'Submitted'
    )
    RETURNING "BidID", "TenderID", "VendorID";
END;
$$;


--
-- Name: submit_bid_proc(uuid, uuid, numeric, text, integer, uuid, uuid, uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.submit_bid_proc(IN p_tenderid uuid, IN p_vendorid uuid, IN p_financialbid numeric, IN p_technicalproposal text, IN p_validityperioddays integer, INOUT p_bidid uuid DEFAULT NULL::uuid, INOUT p_tenderid_out uuid DEFAULT NULL::uuid, INOUT p_vendorid_out uuid DEFAULT NULL::uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT
        sb."BidID",
        sb."TenderID",
        sb."VendorID"
    INTO
        p_bidid,
        p_tenderid_out,
        p_vendorid_out
    FROM procurement_workflow."SubmitBid"(
        p_tenderid,
        p_vendorid,
        p_financialbid,
        p_technicalproposal,
        p_validityperioddays
    ) sb;
END;
$$;


--
-- Name: submit_committee_decision(uuid, character varying, character varying, character varying, text, date); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.submit_committee_decision(p_plan_id uuid, p_chairman_user_id character varying, p_secretary_user_id character varying, p_overall_decision character varying, p_committee_remarks text, p_meeting_date date) RETURNS TABLE(decision_id uuid, plan_id uuid, overall_decision character varying, committee_remarks text, meeting_date date, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_decision_id UUID;
    v_plan_status VARCHAR(50);
BEGIN
    INSERT INTO procurement_workflow.planning_committee_decisions (
        plan_id,
        chairman_user_id,
        secretary_user_id,
        overall_decision,
        committee_remarks,
        meeting_date
    )
    VALUES (
        p_plan_id,
        p_chairman_user_id,
        p_secretary_user_id,
        p_overall_decision,
        p_committee_remarks,
        COALESCE(p_meeting_date, CURRENT_DATE)
    )
    ON CONFLICT (plan_id) DO UPDATE
    SET
        overall_decision = EXCLUDED.overall_decision,
        committee_remarks = EXCLUDED.committee_remarks,
        meeting_date = EXCLUDED.meeting_date,
        updated_at = NOW()
    RETURNING planning_committee_decisions.decision_id INTO v_decision_id;

    -- Update plan status based on decision
    IF p_overall_decision = 'Recommended' THEN
        v_plan_status := 'Submitted'; -- In this system, Submitted means ready for next stage (Budget Confirmation)
    ELSIF p_overall_decision = 'Returned' THEN
        v_plan_status := 'Draft'; -- Return to department
    ELSIF p_overall_decision = 'Rejected' THEN
        v_plan_status := 'Rejected';
    END IF;

    UPDATE procurement_workflow.procurement_plans
    SET status = v_plan_status, updated_at = NOW()
    WHERE plan_id = p_plan_id;

    RETURN QUERY
    SELECT
        d.decision_id,
        d.plan_id,
        d.overall_decision,
        d.committee_remarks,
        d.meeting_date,
        d.created_at
    FROM procurement_workflow.planning_committee_decisions d
    WHERE d.decision_id = v_decision_id;
END;
$$;


--
-- Name: submit_committee_decision_sp(uuid, character varying, character varying, character varying, text, date); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.submit_committee_decision_sp(IN p_plan_id uuid, IN p_chairman_user_id character varying, IN p_secretary_user_id character varying, IN p_overall_decision character varying, IN p_committee_remarks text, IN p_meeting_date date, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.submit_committee_decision(
        p_plan_id,
        p_chairman_user_id,
        p_secretary_user_id,
        p_overall_decision,
        p_committee_remarks,
        p_meeting_date
    );
END;
$$;


--
-- Name: submit_member_review(uuid, character varying, character varying, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.submit_member_review(p_plan_id uuid, p_reviewer_role character varying, p_reviewer_user_id character varying, p_decision character varying, p_remarks text) RETURNS TABLE(review_id uuid, plan_id uuid, reviewer_role character varying, reviewer_user_id character varying, decision character varying, remarks text, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_review_id UUID;
    v_role_key VARCHAR(80);
    v_status_label VARCHAR(80);
BEGIN
    v_role_key := LOWER(REPLACE(REPLACE(p_reviewer_role, '-', '_'), ' ', '_'));

    v_status_label := CASE
        WHEN v_role_key = 'planning_statistics_officer' THEN 'PSO Reviewed'
        WHEN v_role_key = 'financial_unit_officer' THEN 'Finance Reviewed'
        WHEN v_role_key = 'department_head' THEN 'Technical Reviewed'
        WHEN v_role_key = 'legal_reviewer' THEN 'Legal Reviewed'
        WHEN v_role_key = 'procurement_secretary' THEN 'Secretary Recorded'
        WHEN v_role_key = 'comptroller_procurement' THEN 'Chair Reviewed'
        ELSE 'Reviewed'
    END;

    INSERT INTO procurement_workflow.planning_committee_member_reviews (
        plan_id,
        reviewer_role,
        reviewer_user_id,
        decision,
        remarks
    )
    VALUES (
        p_plan_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    )
    ON CONFLICT ON CONSTRAINT uq_member_review_plan_role_user DO UPDATE
    SET
        decision = EXCLUDED.decision,
        remarks = EXCLUDED.remarks,
        updated_at = NOW()
    RETURNING planning_committee_member_reviews.review_id INTO v_review_id;

    PERFORM procurement_workflow.upsert_member_status(
        p_plan_id,
        v_role_key,
        v_status_label,
        p_decision,
        p_reviewer_user_id
    );

    RETURN QUERY
    SELECT
        r.review_id,
        r.plan_id,
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.created_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.review_id = v_review_id;
END;
$$;


--
-- Name: submit_member_review(uuid, uuid, character varying, character varying, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.submit_member_review(p_plan_id uuid, p_requisition_id uuid, p_reviewer_role character varying, p_reviewer_user_id character varying, p_decision character varying, p_remarks text) RETURNS TABLE(review_id uuid, plan_id uuid, requisition_id uuid, reviewer_role character varying, reviewer_user_id character varying, decision character varying, remarks text, review_round integer, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_review_id UUID;
    v_role_key VARCHAR(80);
    v_status_label VARCHAR(80);
    v_review_round INT;
BEGIN
    v_role_key := LOWER(REPLACE(REPLACE(p_reviewer_role, '-', '_'), ' ', '_'));
    SELECT COALESCE(p.review_round, 1)
      INTO v_review_round
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;

    v_status_label := CASE
        WHEN v_role_key = 'planning_statistics_officer' THEN 'PSO Reviewed'
        WHEN v_role_key = 'financial_unit_officer' THEN 'Finance Reviewed'
        WHEN v_role_key = 'department_head' THEN 'Technical Reviewed'
        WHEN v_role_key = 'legal_reviewer' THEN 'Legal Reviewed'
        WHEN v_role_key = 'procurement_secretary' THEN 'Secretary Recorded'
        WHEN v_role_key = 'comptroller_procurement' THEN 'Chair Reviewed'
        ELSE 'Reviewed'
    END;

    INSERT INTO procurement_workflow.planning_committee_member_reviews (
        plan_id,
        requisition_id,
        reviewer_role,
        reviewer_user_id,
        decision,
        remarks,
        review_round
    )
    VALUES (
        p_plan_id,
        p_requisition_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks,
        v_review_round
    )
    ON CONFLICT ON CONSTRAINT uq_member_review_req_role_user_round DO UPDATE
    SET
        decision = EXCLUDED.decision,
        remarks = EXCLUDED.remarks,
        updated_at = NOW()
    RETURNING planning_committee_member_reviews.review_id INTO v_review_id;

    PERFORM procurement_workflow.upsert_member_status(
        p_plan_id,
        p_requisition_id,
        v_role_key,
        v_status_label,
        p_decision,
        p_reviewer_user_id
    );

    RETURN QUERY
    SELECT
        r.review_id,
        r.plan_id,
        r.requisition_id,
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.review_round,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.review_id = v_review_id;
END;
$$;


--
-- Name: submit_member_review_sp(uuid, character varying, character varying, character varying, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.submit_member_review_sp(IN p_plan_id uuid, IN p_reviewer_role character varying, IN p_reviewer_user_id character varying, IN p_decision character varying, IN p_remarks text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.submit_member_review(
        p_plan_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    );
END;
$$;


--
-- Name: submit_member_review_sp(uuid, uuid, character varying, character varying, character varying, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.submit_member_review_sp(IN p_plan_id uuid, IN p_requisition_id uuid, IN p_reviewer_role character varying, IN p_reviewer_user_id character varying, IN p_decision character varying, IN p_remarks text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.submit_member_review(
        p_plan_id,
        p_requisition_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    );
END;
$$;


--
-- Name: submit_procurement_plan_cycle(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.submit_procurement_plan_cycle(p_plan_cycle_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cycle procurement_workflow."ProcurementPlanCycles"%ROWTYPE;
    v_count INT;
    v_unverified INT;
BEGIN
    SELECT * INTO v_cycle
    FROM procurement_workflow."ProcurementPlanCycles"
    WHERE "PlanCycleId" = p_plan_cycle_id;

    IF v_cycle."PlanCycleId" IS NULL THEN
        RAISE EXCEPTION 'APP cycle not found.';
    END IF;

    IF LOWER(v_cycle."Status") <> 'draft' THEN
        RAISE EXCEPTION 'Only Draft APP cycles can be submitted.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM procurement_workflow."ProcurementPlanItems"
    WHERE "PlanCycleId" = p_plan_cycle_id;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'APP cycle has no items. Add items before submission.';
    END IF;

    SELECT COUNT(*) INTO v_unverified
    FROM procurement_workflow."ProcurementPlanItems"
    WHERE "PlanCycleId" = p_plan_cycle_id
      AND "BudgetVerified" = FALSE;
    IF v_unverified > 0 THEN
        RAISE EXCEPTION 'All APP items must pass budget verification before submission.';
    END IF;

    UPDATE procurement_workflow."ProcurementPlanItems"
    SET "Status" = 'Submitted'
    WHERE "PlanCycleId" = p_plan_cycle_id;

    UPDATE procurement_workflow."ProcurementPlanCycles"
    SET "Status" = 'Submitted',
        "SubmittedAt" = NOW()
    WHERE "PlanCycleId" = p_plan_cycle_id;

    RETURN jsonb_build_object(
        'planCycleId', p_plan_cycle_id,
        'status', 'Submitted',
        'submittedAt', NOW()
    );
END;
$$;


--
-- Name: submit_procurement_plan_cycle_proc(uuid, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.submit_procurement_plan_cycle_proc(IN p_plan_cycle_id uuid, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."SubmitProcurementPlanCycle"(p_plan_cycle_id);
END;
$$;


--
-- Name: sync_procurement_plan_total_budget(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.sync_procurement_plan_total_budget(p_plan_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE procurement_workflow.procurement_plans p
    SET total_budget = COALESCE((
            SELECT SUM(i.estimated_amount)
            FROM procurement_workflow.procurement_plan_items i
            WHERE i.plan_id = p_plan_id
        ), 0),
        updated_at = NOW()
    WHERE p.plan_id = p_plan_id;
END;
$$;


--
-- Name: unlink_requisition_app_item(uuid); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.unlink_requisition_app_item(p_requisition_id uuid) RETURNS TABLE(requisition_id uuid, app_item_id uuid, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE procurement_workflow.requisitions
    SET
        app_item_id = NULL,
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    RETURN QUERY
    SELECT r.requisition_id, r.app_item_id, r.updated_at
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;


--
-- Name: unlink_requisition_app_item(uuid, text, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.unlink_requisition_app_item(p_requisition_id uuid, p_reason text, p_unlinked_by character varying) RETURNS TABLE(requisition_id uuid, app_item_id uuid, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_prev_app_item_id UUID;
BEGIN
    SELECT r.app_item_id
    INTO v_prev_app_item_id
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Unlink reason is required.';
    END IF;

    INSERT INTO procurement_workflow.requisition_app_unlinks (
        requisition_id,
        previous_app_item_id,
        reason,
        unlinked_by
    )
    VALUES (
        p_requisition_id,
        v_prev_app_item_id,
        p_reason,
        p_unlinked_by
    );

    UPDATE procurement_workflow.requisitions
    SET
        app_item_id = NULL,
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    RETURN QUERY
    SELECT r.requisition_id, r.app_item_id, r.updated_at
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;


--
-- Name: unlink_requisition_app_item_sp(uuid); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.unlink_requisition_app_item_sp(IN p_requisition_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.unlink_requisition_app_item(p_requisition_id);
END;
$$;


--
-- Name: unlink_requisition_app_item_sp(uuid, text, character varying); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.unlink_requisition_app_item_sp(IN p_requisition_id uuid, IN p_reason text, IN p_unlinked_by character varying, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.unlink_requisition_app_item(p_requisition_id, p_reason, p_unlinked_by);
END;
$$;


--
-- Name: update_procurement_plan(uuid, character varying, character varying, integer, character varying, numeric, text, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.update_procurement_plan(p_plan_id uuid, p_plan_title character varying, p_department character varying, p_fiscal_year integer, p_status character varying, p_total_budget numeric, p_notes text, p_submitted_at timestamp without time zone, p_approved_at timestamp without time zone) RETURNS TABLE(plan_id uuid, plan_title character varying, department character varying, fiscal_year integer, status character varying, total_budget numeric, notes text, submitted_at timestamp without time zone, approved_at timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_fiscal_year INT;
    v_yearly_app_id UUID;
BEGIN
    SELECT COALESCE(p_fiscal_year, p.fiscal_year)
    INTO v_fiscal_year
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;

    IF v_fiscal_year IS NULL THEN
        RETURN;
    END IF;

    v_yearly_app_id := procurement_workflow.ensure_yearly_app(v_fiscal_year);

    UPDATE procurement_workflow.procurement_plans
    SET
        yearly_app_id = v_yearly_app_id,
        plan_title = COALESCE(p_plan_title, plan_title),
        department = COALESCE(p_department, department),
        fiscal_year = v_fiscal_year,
        status = COALESCE(p_status, status),
        total_budget = COALESCE(p_total_budget, total_budget),
        notes = COALESCE(p_notes, notes),
        submitted_at = COALESCE(p_submitted_at, submitted_at),
        approved_at = COALESCE(p_approved_at, approved_at),
        updated_at = NOW()
    WHERE plan_id = p_plan_id;

    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.notes,
        p.submitted_at,
        p.approved_at,
        p.created_at,
        p.updated_at
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;
END;
$$;


--
-- Name: update_procurement_plan_item(uuid, character varying, text, character varying, character varying, numeric, character varying, text); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.update_procurement_plan_item(p_plan_item_id uuid, p_item_code character varying, p_description text, p_budget_code character varying, p_procurement_type character varying, p_estimated_amount numeric, p_status character varying, p_notes text) RETURNS TABLE(plan_item_id uuid, plan_id uuid, item_code character varying, description text, budget_code character varying, procurement_type character varying, estimated_amount numeric, status character varying, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE v_plan_id UUID;
BEGIN
    SELECT i.plan_id INTO v_plan_id FROM procurement_workflow.procurement_plan_items i WHERE i.plan_item_id = p_plan_item_id;
    UPDATE procurement_workflow.procurement_plan_items
    SET item_code = COALESCE(p_item_code, item_code), description = COALESCE(p_description, description),
        budget_code = COALESCE(p_budget_code, budget_code), procurement_type = COALESCE(p_procurement_type, procurement_type),
        estimated_amount = COALESCE(p_estimated_amount, estimated_amount), status = COALESCE(p_status, status),
        notes = COALESCE(p_notes, notes), updated_at = NOW()
    WHERE plan_item_id = p_plan_item_id;
    IF v_plan_id IS NOT NULL THEN PERFORM procurement_workflow.sync_procurement_plan_total_budget(v_plan_id); END IF;
    RETURN QUERY SELECT i.plan_item_id, i.plan_id, i.item_code, i.description, i.budget_code, i.procurement_type, i.estimated_amount, i.status, i.notes, i.created_at, i.updated_at
    FROM procurement_workflow.procurement_plan_items i WHERE i.plan_item_id = p_plan_item_id;
END;
$$;


--
-- Name: update_procurement_plan_item_sp(uuid, character varying, text, character varying, character varying, numeric, character varying, text); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.update_procurement_plan_item_sp(IN p_plan_item_id uuid, IN p_item_code character varying, IN p_description text, IN p_budget_code character varying, IN p_procurement_type character varying, IN p_estimated_amount numeric, IN p_status character varying, IN p_notes text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_procurement_plan_item(
        p_plan_item_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        p_estimated_amount,
        p_status,
        p_notes
    );
END;
$$;


--
-- Name: update_procurement_plan_sp(uuid, character varying, character varying, integer, character varying, numeric, text, timestamp without time zone, timestamp without time zone); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.update_procurement_plan_sp(IN p_plan_id uuid, IN p_plan_title character varying, IN p_department character varying, IN p_fiscal_year integer, IN p_status character varying, IN p_total_budget numeric, IN p_notes text, IN p_submitted_at timestamp without time zone, IN p_approved_at timestamp without time zone, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_procurement_plan(
        p_plan_id,
        p_plan_title,
        p_department,
        p_fiscal_year,
        p_status,
        p_total_budget,
        p_notes,
        p_submitted_at,
        p_approved_at
    );
END;
$$;


--
-- Name: update_requisition(uuid, character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying, timestamp without time zone, text, text, text, jsonb); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.update_requisition(p_requisition_id uuid, p_title character varying, p_department character varying, p_status character varying, p_priority character varying, p_procurement_type character varying, p_funding_source character varying, p_budget_code character varying, p_project_code character varying, p_required_by timestamp without time zone, p_delivery_location text, p_justification text, p_risk_notes text, p_line_items jsonb) RETURNS TABLE(requisition_id uuid, title character varying, department character varying, status character varying, priority character varying, funding_source character varying, total_estimate numeric, required_by timestamp without time zone, created_at timestamp without time zone, procurement_type character varying, budget_code character varying, project_code character varying, delivery_location text, justification text, risk_notes text, updated_at timestamp without time zone, current_stage character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status VARCHAR(50);
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_required_by TIMESTAMP WITHOUT TIME ZONE;
    v_total_estimate DECIMAL(18, 2);
    v_fiscal_year INT;
BEGIN
    UPDATE procurement_workflow.requisitions
    SET
        title = COALESCE(p_title, title),
        department = COALESCE(p_department, department),
        status = COALESCE(p_status, status),
        priority = COALESCE(p_priority, priority),
        procurement_type = COALESCE(p_procurement_type, procurement_type),
        funding_source = COALESCE(p_funding_source, funding_source),
        budget_code = COALESCE(p_budget_code, budget_code),
        project_code = COALESCE(p_project_code, project_code),
        required_by = COALESCE(p_required_by, required_by),
        delivery_location = COALESCE(p_delivery_location, delivery_location),
        justification = COALESCE(p_justification, justification),
        risk_notes = COALESCE(p_risk_notes, risk_notes),
        current_stage = COALESCE(
            CASE WHEN p_status IS NULL THEN NULL ELSE procurement_workflow.resolve_requisition_stage(p_status) END,
            current_stage
        ),
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    IF p_line_items IS NOT NULL THEN
        DELETE FROM procurement_workflow.requisition_line_items
        WHERE requisition_id = p_requisition_id;

        INSERT INTO procurement_workflow.requisition_line_items (
            requisition_id,
            item_code,
            description,
            unit,
            quantity,
            unit_cost
        )
        SELECT
            p_requisition_id,
            NULLIF(item->>'ItemId', ''),
            item->>'Description',
            item->>'Unit',
            (item->>'Quantity')::numeric,
            (item->>'UnitCost')::numeric
        FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;
    END IF;

    UPDATE procurement_workflow.requisitions
    SET total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items
            WHERE requisition_id = p_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    SELECT r.status, r.department, r.budget_code, r.required_by, r.total_estimate
    INTO v_status, v_department, v_budget_code, v_required_by, v_total_estimate
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_fiscal_year := COALESCE(EXTRACT(YEAR FROM v_required_by)::int, EXTRACT(YEAR FROM NOW())::int);

    IF v_status IN ('Submitted', 'Under Review', 'Evaluation', 'Board Review', 'Approved') THEN
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            p_requisition_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_total_estimate
        );
    ELSIF v_status IN ('Draft', 'Rejected', 'Cancelled') THEN
        PERFORM procurement_workflow.release_budget_for_requisition(p_requisition_id);
    END IF;

    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;


--
-- Name: update_requisition(uuid, character varying, character varying, uuid, character varying, character varying, character varying, character varying, character varying, uuid, character varying, timestamp without time zone, text, text, text, jsonb); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.update_requisition(p_requisition_id uuid, p_title character varying, p_department character varying, p_unit_id uuid, p_status character varying, p_priority character varying, p_procurement_type character varying, p_funding_source character varying, p_budget_code character varying, p_app_item_id uuid, p_project_code character varying, p_required_by timestamp without time zone, p_delivery_location text, p_justification text, p_risk_notes text, p_line_items jsonb) RETURNS TABLE(requisition_id uuid, title character varying, department character varying, unit_id uuid, status character varying, priority character varying, funding_source character varying, total_estimate numeric, required_by timestamp without time zone, created_at timestamp without time zone, procurement_type character varying, budget_code character varying, app_item_id uuid, project_code character varying, delivery_location text, justification text, risk_notes text, updated_at timestamp without time zone, current_stage character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_existing_department VARCHAR(150);
    v_existing_budget_code VARCHAR(60);
    v_existing_app_item_id UUID;
    v_existing_proc_type VARCHAR(50);
    v_existing_status VARCHAR(50);
    v_existing_required_by TIMESTAMP WITHOUT TIME ZONE;
    v_existing_unit_id UUID;
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_app_item_id UUID;
    v_procurement_type VARCHAR(50);
    v_status VARCHAR(50);
    v_required_by TIMESTAMP WITHOUT TIME ZONE;
    v_total_estimate DECIMAL(18, 2);
    v_fiscal_year INT;
    v_plan_status VARCHAR(50);
    v_plan_department VARCHAR(150);
    v_item_budget_code VARCHAR(60);
    v_item_status VARCHAR(30);
    v_unit_id UUID;
    v_linked_requisition_id UUID;
BEGIN
    SELECT r.department, r.unit_id, r.budget_code, r.app_item_id, r.procurement_type, r.status, r.required_by
    INTO v_existing_department, v_existing_unit_id, v_existing_budget_code, v_existing_app_item_id, v_existing_proc_type, v_existing_status, v_existing_required_by
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_budget_code := COALESCE(p_budget_code, v_existing_budget_code);
    v_app_item_id := COALESCE(p_app_item_id, v_existing_app_item_id);
    v_procurement_type := COALESCE(p_procurement_type, v_existing_proc_type);
    v_status := COALESCE(p_status, v_existing_status);
    v_required_by := COALESCE(p_required_by, v_existing_required_by);
    v_unit_id := COALESCE(p_unit_id, v_existing_unit_id);

    IF p_app_item_id IS NOT NULL AND v_existing_app_item_id IS NOT NULL AND v_existing_app_item_id <> p_app_item_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Requisition is already linked to an APP item.';
    END IF;

    IF v_unit_id IS NOT NULL THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE ou.unit_id = v_unit_id
          AND ou.is_active = TRUE
          AND ou.is_assignable = TRUE;

        IF v_department IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Organizational unit is invalid or inactive.';
        END IF;
    ELSIF p_department IS NOT NULL AND btrim(p_department) <> '' THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE LOWER(ou.unit_name) = LOWER(btrim(p_department))
          AND ou.is_active = TRUE
          AND ou.is_assignable = TRUE
        LIMIT 1;

        v_department := COALESCE(v_department, btrim(p_department));
    ELSE
        v_department := v_existing_department;
    END IF;

    v_department := COALESCE(v_department, v_existing_department, NULLIF(btrim(p_department), ''));

    IF v_department IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department or organizational unit is required.';
    END IF;

    IF v_app_item_id IS NOT NULL THEN
        SELECT p.status, p.department, i.budget_code, i.status
        INTO v_plan_status, v_plan_department, v_item_budget_code, v_item_status
        FROM procurement_workflow.procurement_plan_items i
        JOIN procurement_workflow.procurement_plans p ON p.plan_id = i.plan_id
        WHERE i.plan_item_id = v_app_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item not found.';
        END IF;

        IF v_item_status <> 'Active' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item is not active.';
        END IF;

        IF v_plan_status <> 'Under Review' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan must be under review for this APP item.';
        END IF;

        SELECT r.requisition_id
        INTO v_linked_requisition_id
        FROM procurement_workflow.requisitions r
        WHERE r.app_item_id = v_app_item_id
          AND r.requisition_id <> p_requisition_id
        LIMIT 1;

        IF v_linked_requisition_id IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP item is already linked to another requisition.';
        END IF;

        IF v_plan_department IS NOT NULL AND v_department IS NOT NULL AND v_plan_department <> v_department THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department does not match procurement plan.';
        END IF;

        IF v_budget_code IS NULL OR btrim(v_budget_code) = '' THEN
            v_budget_code := v_item_budget_code;
        ELSIF v_item_budget_code IS NOT NULL AND v_budget_code <> v_item_budget_code THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BudgetCode does not match APP line item.';
        END IF;
    END IF;

    UPDATE procurement_workflow.requisitions r
    SET
        title = COALESCE(p_title, r.title),
        department = v_department,
        unit_id = v_unit_id,
        status = COALESCE(p_status, r.status),
        priority = COALESCE(p_priority, r.priority),
        procurement_type = COALESCE(p_procurement_type, r.procurement_type),
        funding_source = COALESCE(p_funding_source, r.funding_source),
        budget_code = v_budget_code,
        app_item_id = v_app_item_id,
        project_code = COALESCE(p_project_code, r.project_code),
        required_by = COALESCE(p_required_by, r.required_by),
        delivery_location = COALESCE(p_delivery_location, r.delivery_location),
        justification = COALESCE(p_justification, r.justification),
        risk_notes = COALESCE(p_risk_notes, r.risk_notes),
        current_stage = COALESCE(
            CASE WHEN p_status IS NULL THEN NULL ELSE procurement_workflow.resolve_requisition_stage(p_status) END,
            r.current_stage
        ),
        updated_at = NOW()
    WHERE r.requisition_id = p_requisition_id;

    IF p_line_items IS NOT NULL THEN
        DELETE FROM procurement_workflow.requisition_line_items li
        WHERE li.requisition_id = p_requisition_id;

        INSERT INTO procurement_workflow.requisition_line_items (
            requisition_id,
            item_code,
            description,
            unit,
            quantity,
            unit_cost
        )
        SELECT
            p_requisition_id,
            NULLIF(item->>'ItemId', ''),
            item->>'Description',
            item->>'Unit',
            (item->>'Quantity')::numeric,
            (item->>'UnitCost')::numeric
        FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;
    END IF;

    UPDATE procurement_workflow.requisitions r
    SET total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items li
            WHERE li.requisition_id = p_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE r.requisition_id = p_requisition_id;

    SELECT r.total_estimate
    INTO v_total_estimate
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_fiscal_year := COALESCE(EXTRACT(YEAR FROM v_required_by)::int, EXTRACT(YEAR FROM NOW())::int);

    IF v_status IN ('Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved') AND v_budget_code IS NOT NULL AND btrim(v_budget_code) <> '' THEN
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            p_requisition_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_total_estimate
        );
    ELSIF v_status IN ('Draft', 'Submitted', 'Endorsed', 'Rejected', 'Cancelled') THEN
        PERFORM procurement_workflow.release_budget_for_requisition(p_requisition_id);
    END IF;

    IF v_status = 'Approved' THEN
        PERFORM procurement_workflow.require_bpp_no_objection(p_requisition_id, v_procurement_type, v_total_estimate);
    END IF;

    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.unit_id,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.app_item_id,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;


--
-- Name: update_requisition_sp(uuid, character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying, timestamp without time zone, text, text, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.update_requisition_sp(IN p_requisition_id uuid, IN p_title character varying, IN p_department character varying, IN p_status character varying, IN p_priority character varying, IN p_procurement_type character varying, IN p_funding_source character varying, IN p_budget_code character varying, IN p_project_code character varying, IN p_required_by timestamp without time zone, IN p_delivery_location text, IN p_justification text, IN p_risk_notes text, IN p_line_items jsonb, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_requisition(
        p_requisition_id,
        p_title,
        p_department,
        p_status,
        p_priority,
        p_procurement_type,
        p_funding_source,
        p_budget_code,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        p_line_items
    );
END;
$$;


--
-- Name: update_requisition_sp(uuid, character varying, character varying, uuid, character varying, character varying, character varying, character varying, character varying, uuid, character varying, timestamp without time zone, text, text, text, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.update_requisition_sp(IN p_requisition_id uuid, IN p_title character varying, IN p_department character varying, IN p_unit_id uuid, IN p_status character varying, IN p_priority character varying, IN p_procurement_type character varying, IN p_funding_source character varying, IN p_budget_code character varying, IN p_app_item_id uuid, IN p_project_code character varying, IN p_required_by timestamp without time zone, IN p_delivery_location text, IN p_justification text, IN p_risk_notes text, IN p_line_items jsonb, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_requisition(
        p_requisition_id,
        p_title,
        p_department,
        p_unit_id,
        p_status,
        p_priority,
        p_procurement_type,
        p_funding_source,
        p_budget_code,
        p_app_item_id,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        p_line_items
    );
END;
$$;


--
-- Name: upsert_member_status(uuid, character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.upsert_member_status(p_plan_id uuid, p_role_key character varying, p_status_label character varying, p_decision character varying, p_updated_by character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO procurement_workflow.planning_committee_member_status (
        plan_id,
        role_key,
        status_label,
        decision,
        updated_by,
        updated_at
    )
    VALUES (
        p_plan_id,
        p_role_key,
        p_status_label,
        p_decision,
        p_updated_by,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_member_status_plan_role DO UPDATE
    SET
        status_label = EXCLUDED.status_label,
        decision = EXCLUDED.decision,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;


--
-- Name: upsert_member_status(uuid, uuid, character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.upsert_member_status(p_plan_id uuid, p_requisition_id uuid, p_role_key character varying, p_status_label character varying, p_decision character varying, p_updated_by character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO procurement_workflow.planning_committee_member_status (
        plan_id,
        requisition_id,
        role_key,
        status_label,
        decision,
        updated_by,
        updated_at
    )
    VALUES (
        p_plan_id,
        p_requisition_id,
        p_role_key,
        p_status_label,
        p_decision,
        p_updated_by,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_member_status_req_role DO UPDATE
    SET
        status_label = EXCLUDED.status_label,
        decision = EXCLUDED.decision,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;


--
-- Name: verify_procurement_plan_budget(uuid, character varying); Type: FUNCTION; Schema: procurement_workflow; Owner: -
--

CREATE FUNCTION procurement_workflow.verify_procurement_plan_budget(p_plan_item_id uuid, p_actor_email character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_item procurement_workflow."ProcurementPlanItems"%ROWTYPE;
    v_allocated DECIMAL(18,2);
    v_committed DECIMAL(18,2);
    v_remaining DECIMAL(18,2);
BEGIN
    SELECT * INTO v_item
    FROM procurement_workflow."ProcurementPlanItems"
    WHERE "PlanItemId" = p_plan_item_id;

    IF v_item."PlanItemId" IS NULL THEN
        RAISE EXCEPTION 'APP item not found.';
    END IF;

    IF LOWER(v_item."Status") <> 'draft' THEN
        RAISE EXCEPTION 'Budget verification is only allowed for APP items in Draft state.';
    END IF;

    SELECT b."AllocatedAmount" INTO v_allocated
    FROM procurement_workflow."BudgetLines" b
    WHERE b."BudgetCode" = v_item."BudgetCode"
      AND b."Department" = v_item."Department"
      AND b."IsActive" = TRUE;

    IF v_allocated IS NULL THEN
        RAISE EXCEPTION 'Referenced budget line is not active for this department.';
    END IF;

    SELECT COALESCE(SUM(i."EstimatedCost"), 0) INTO v_committed
    FROM procurement_workflow."ProcurementPlanItems" i
    WHERE i."BudgetCode" = v_item."BudgetCode"
      AND i."PlanItemId" <> v_item."PlanItemId"
      AND i."BudgetVerified" = TRUE
      AND LOWER(i."Status") <> 'rejected';

    v_remaining := v_allocated - v_committed;
    IF v_remaining < v_item."EstimatedCost" THEN
        RAISE EXCEPTION 'Budget verification failed. Remaining allocation on % is %.', v_item."BudgetCode", v_remaining;
    END IF;

    UPDATE procurement_workflow."ProcurementPlanItems"
    SET "BudgetVerified" = TRUE,
        "BudgetVerifiedBy" = p_actor_email,
        "BudgetVerifiedAt" = NOW(),
        "Status" = 'BudgetVerified'
    WHERE "PlanItemId" = p_plan_item_id;

    RETURN jsonb_build_object(
        'planItemId', v_item."PlanItemId",
        'appCode', v_item."AppCode",
        'budgetCode', v_item."BudgetCode",
        'budgetVerified', TRUE,
        'budgetVerifiedBy', p_actor_email,
        'budgetVerifiedAt', NOW(),
        'status', 'BudgetVerified'
    );
END;
$$;


--
-- Name: verify_procurement_plan_budget_proc(uuid, character varying, jsonb); Type: PROCEDURE; Schema: procurement_workflow; Owner: -
--

CREATE PROCEDURE procurement_workflow.verify_procurement_plan_budget_proc(IN p_plan_item_id uuid, IN p_actor_email character varying, INOUT p_result_json jsonb DEFAULT '{}'::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    p_result_json := procurement_workflow."VerifyProcurementPlanBudget"(p_plan_item_id, p_actor_email);
END;
$$;


--
-- Name: create_bid_opening_session(uuid, character varying, character varying, timestamp without time zone, character varying, timestamp without time zone, timestamp without time zone, text); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.create_bid_opening_session(p_tender_id uuid, p_session_title character varying, p_location character varying, p_scheduled_at timestamp without time zone, p_status character varying, p_opened_at timestamp without time zone, p_closed_at timestamp without time zone, p_notes text) RETURNS TABLE(session_id uuid, tender_id uuid, session_title character varying, location character varying, scheduled_at timestamp without time zone, status character varying, opened_at timestamp without time zone, closed_at timestamp without time zone, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO vendor_sourcing.bid_opening_sessions (
        tender_id,
        session_title,
        location,
        scheduled_at,
        status,
        opened_at,
        closed_at,
        notes
    )
    VALUES (
        p_tender_id,
        p_session_title,
        p_location,
        p_scheduled_at,
        COALESCE(p_status, 'Scheduled'),
        p_opened_at,
        p_closed_at,
        p_notes
    )
    RETURNING bid_opening_sessions.session_id INTO v_session_id;

    RETURN QUERY
    SELECT * FROM vendor_sourcing.get_bid_opening_session_details(v_session_id);
END;
$$;


--
-- Name: create_bid_opening_session_sp(uuid, character varying, character varying, timestamp without time zone, character varying, timestamp without time zone, timestamp without time zone, text); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.create_bid_opening_session_sp(IN p_tender_id uuid, IN p_session_title character varying, IN p_location character varying, IN p_scheduled_at timestamp without time zone, IN p_status character varying, IN p_opened_at timestamp without time zone, IN p_closed_at timestamp without time zone, IN p_notes text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.create_bid_opening_session(
        p_tender_id,
        p_session_title,
        p_location,
        p_scheduled_at,
        p_status,
        p_opened_at,
        p_closed_at,
        p_notes
    );
END;
$$;


--
-- Name: create_tender(character varying, text, character varying, character varying, numeric, character varying, character varying, integer, text, text, text, timestamp without time zone, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.create_tender(p_title character varying, p_description text, p_category character varying, p_status character varying, p_budget numeric, p_department character varying, p_budget_code character varying, p_fiscal_year integer, p_specifications text, p_eligibility_criteria text, p_evaluation_criteria text, p_publish_date timestamp without time zone, p_opening_date timestamp without time zone, p_closing_date timestamp without time zone) RETURNS TABLE(tender_id uuid, title character varying, description text, category character varying, status character varying, budget numeric, department character varying, budget_code character varying, fiscal_year integer, specifications text, eligibility_criteria text, evaluation_criteria text, publish_date timestamp without time zone, opening_date timestamp without time zone, closing_date timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tender_id UUID;
    v_status VARCHAR(50);
    v_fiscal_year INT;
BEGIN
    v_status := COALESCE(p_status, 'Draft');
    v_fiscal_year := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::INT);

    INSERT INTO vendor_sourcing.tenders (
        title,
        description,
        category,
        status,
        budget,
        department,
        budget_code,
        fiscal_year,
        specifications,
        eligibility_criteria,
        evaluation_criteria,
        publish_date,
        opening_date,
        closing_date
    )
    VALUES (
        p_title,
        p_description,
        p_category,
        v_status,
        p_budget,
        p_department,
        p_budget_code,
        v_fiscal_year,
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    )
    RETURNING tenders.tender_id INTO v_tender_id;

    IF v_status IN ('Published', 'Closed', 'Awarded') THEN
        PERFORM procurement_workflow.reserve_budget_for_tender(
            v_tender_id,
            p_budget_code,
            p_department,
            v_fiscal_year,
            p_budget
        );
    END IF;

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.specifications,
        t.eligibility_criteria,
        t.evaluation_criteria,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at,
        t.updated_at
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = v_tender_id;
END;
$$;


--
-- Name: create_tender_sp(character varying, text, character varying, character varying, numeric, character varying, character varying, integer, text, text, text, timestamp without time zone, timestamp without time zone, timestamp without time zone); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.create_tender_sp(IN p_title character varying, IN p_description text, IN p_category character varying, IN p_status character varying, IN p_budget numeric, IN p_department character varying, IN p_budget_code character varying, IN p_fiscal_year integer, IN p_specifications text, IN p_eligibility_criteria text, IN p_evaluation_criteria text, IN p_publish_date timestamp without time zone, IN p_opening_date timestamp without time zone, IN p_closing_date timestamp without time zone, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.create_tender(
        p_title,
        p_description,
        p_category,
        p_status,
        p_budget,
        p_department,
        p_budget_code,
        p_fiscal_year,
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;


--
-- Name: get_bid_opening_session_details(uuid); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_bid_opening_session_details(p_session_id uuid) RETURNS TABLE(session_id uuid, tender_id uuid, session_title character varying, location character varying, scheduled_at timestamp without time zone, status character varying, opened_at timestamp without time zone, closed_at timestamp without time zone, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.tender_id,
        s.session_title,
        s.location,
        s.scheduled_at,
        s.status,
        s.opened_at,
        s.closed_at,
        s.notes,
        s.created_at,
        s.updated_at
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE s.session_id = p_session_id;
END;
$$;


--
-- Name: get_bid_opening_session_details_sp(uuid); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_bid_opening_session_details_sp(IN p_session_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_bid_opening_session_details(p_session_id);
END;
$$;


--
-- Name: get_bid_opening_sessions(character varying, uuid, text, timestamp without time zone, timestamp without time zone, character varying, character varying, integer, integer); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_bid_opening_sessions(p_status character varying DEFAULT NULL::character varying, p_tender_id uuid DEFAULT NULL::uuid, p_query text DEFAULT NULL::text, p_date_from timestamp without time zone DEFAULT NULL::timestamp without time zone, p_date_to timestamp without time zone DEFAULT NULL::timestamp without time zone, p_sort_by character varying DEFAULT 'scheduled_at'::character varying, p_sort_dir character varying DEFAULT 'asc'::character varying, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(session_id uuid, tender_id uuid, session_title character varying, location character varying, scheduled_at timestamp without time zone, status character varying, opened_at timestamp without time zone, closed_at timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.tender_id,
        s.session_title,
        s.location,
        s.scheduled_at,
        s.status,
        s.opened_at,
        s.closed_at,
        s.created_at
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE
        (p_status IS NULL OR s.status ILIKE p_status)
        AND (p_tender_id IS NULL OR s.tender_id = p_tender_id)
        AND (
            p_query IS NULL
            OR s.session_title ILIKE '%' || p_query || '%'
            OR s.location ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR s.scheduled_at >= p_date_from)
        AND (p_date_to IS NULL OR s.scheduled_at <= p_date_to)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'session_title' AND lower(p_sort_dir) = 'asc' THEN s.session_title END ASC,
        CASE WHEN lower(p_sort_by) = 'session_title' AND lower(p_sort_dir) = 'desc' THEN s.session_title END DESC,
        CASE WHEN lower(p_sort_by) = 'location' AND lower(p_sort_dir) = 'asc' THEN s.location END ASC,
        CASE WHEN lower(p_sort_by) = 'location' AND lower(p_sort_dir) = 'desc' THEN s.location END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN s.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN s.status END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN s.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN s.created_at END DESC,
        CASE WHEN lower(p_sort_by) = 'scheduled_at' AND lower(p_sort_dir) = 'asc' THEN s.scheduled_at END ASC,
        CASE WHEN lower(p_sort_by) = 'scheduled_at' AND lower(p_sort_dir) = 'desc' THEN s.scheduled_at END DESC,
        s.scheduled_at ASC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;


--
-- Name: get_bid_opening_sessions_count(character varying, uuid, text, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_bid_opening_sessions_count(p_status character varying DEFAULT NULL::character varying, p_tender_id uuid DEFAULT NULL::uuid, p_query text DEFAULT NULL::text, p_date_from timestamp without time zone DEFAULT NULL::timestamp without time zone, p_date_to timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE
        (p_status IS NULL OR s.status ILIKE p_status)
        AND (p_tender_id IS NULL OR s.tender_id = p_tender_id)
        AND (
            p_query IS NULL
            OR s.session_title ILIKE '%' || p_query || '%'
            OR s.location ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR s.scheduled_at >= p_date_from)
        AND (p_date_to IS NULL OR s.scheduled_at <= p_date_to);

    RETURN v_count;
END;
$$;


--
-- Name: get_bid_opening_sessions_sp(character varying, uuid, text, timestamp without time zone, timestamp without time zone, character varying, character varying, integer, integer); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_bid_opening_sessions_sp(IN p_status character varying, IN p_tender_id uuid, IN p_query text, IN p_date_from timestamp without time zone, IN p_date_to timestamp without time zone, IN p_sort_by character varying, IN p_sort_dir character varying, IN p_limit integer, IN p_offset integer, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_bid_opening_sessions(
        p_status,
        p_tender_id,
        p_query,
        p_date_from,
        p_date_to,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;


--
-- Name: get_open_tenders(); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_open_tenders() RETURNS TABLE(tender_id uuid, title character varying, category character varying, status character varying, closing_date timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.category,
        t.status,
        t.closing_date
    FROM
        vendor_sourcing.tenders t
    WHERE
        t.status = 'Published' AND t.closing_date > NOW()
    ORDER BY
        t.closing_date ASC;
END;
$$;


--
-- Name: get_open_tenders_sp(); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_open_tenders_sp(OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_open_tenders();
END;
$$;


--
-- Name: get_submitted_bids(uuid); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_submitted_bids(p_vendor_id uuid) RETURNS TABLE(bid_id uuid, tender_id uuid, vendor_id uuid, bid_amount numeric, technical_proposal_url text, validity_period_days integer, submission_date timestamp without time zone, status character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.bid_id,
        b.tender_id,
        b.vendor_id,
        b.bid_amount,
        b.technical_proposal_url,
        b.validity_period_days,
        b.submission_date,
        b.status
    FROM
        vendor_sourcing.bids b
    WHERE
        b.vendor_id = p_vendor_id
    ORDER BY
        b.submission_date DESC;
END;
$$;


--
-- Name: get_submitted_bids_sp(uuid); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_submitted_bids_sp(IN p_vendor_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_submitted_bids(p_vendor_id);
END;
$$;


--
-- Name: get_tender_details(uuid); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_tender_details(p_tender_id uuid) RETURNS TABLE(tender_id uuid, title character varying, description text, category character varying, status character varying, budget numeric, department character varying, budget_code character varying, fiscal_year integer, specifications text, eligibility_criteria text, evaluation_criteria text, publish_date timestamp without time zone, opening_date timestamp without time zone, closing_date timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.specifications,
        t.eligibility_criteria,
        t.evaluation_criteria,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at,
        t.updated_at
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;
END;
$$;


--
-- Name: get_tender_details_sp(uuid); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_tender_details_sp(IN p_tender_id uuid, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_tender_details(p_tender_id);
END;
$$;


--
-- Name: get_tenders(character varying, character varying, text, character varying, character varying, integer, integer); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_tenders(p_status character varying DEFAULT NULL::character varying, p_category character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text, p_sort_by character varying DEFAULT 'created_at'::character varying, p_sort_dir character varying DEFAULT 'desc'::character varying, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(tender_id uuid, title character varying, category character varying, status character varying, budget numeric, department character varying, budget_code character varying, fiscal_year integer, publish_date timestamp without time zone, opening_date timestamp without time zone, closing_date timestamp without time zone, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at
    FROM vendor_sourcing.tenders t
    WHERE
        (p_status IS NULL OR t.status ILIKE p_status)
        AND (p_category IS NULL OR t.category ILIKE '%' || p_category || '%')
        AND (
            p_query IS NULL
            OR t.title ILIKE '%' || p_query || '%'
            OR t.description ILIKE '%' || p_query || '%'
        )
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'asc' THEN t.title END ASC,
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'desc' THEN t.title END DESC,
        CASE WHEN lower(p_sort_by) = 'category' AND lower(p_sort_dir) = 'asc' THEN t.category END ASC,
        CASE WHEN lower(p_sort_by) = 'category' AND lower(p_sort_dir) = 'desc' THEN t.category END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN t.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN t.status END DESC,
        CASE WHEN lower(p_sort_by) = 'budget' AND lower(p_sort_dir) = 'asc' THEN t.budget END ASC,
        CASE WHEN lower(p_sort_by) = 'budget' AND lower(p_sort_dir) = 'desc' THEN t.budget END DESC,
        CASE WHEN lower(p_sort_by) = 'publish_date' AND lower(p_sort_dir) = 'asc' THEN t.publish_date END ASC,
        CASE WHEN lower(p_sort_by) = 'publish_date' AND lower(p_sort_dir) = 'desc' THEN t.publish_date END DESC,
        CASE WHEN lower(p_sort_by) = 'closing_date' AND lower(p_sort_dir) = 'asc' THEN t.closing_date END ASC,
        CASE WHEN lower(p_sort_by) = 'closing_date' AND lower(p_sort_dir) = 'desc' THEN t.closing_date END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN t.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN t.created_at END DESC,
        t.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;


--
-- Name: get_tenders_count(character varying, character varying, text); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_tenders_count(p_status character varying DEFAULT NULL::character varying, p_category character varying DEFAULT NULL::character varying, p_query text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM vendor_sourcing.tenders t
    WHERE
        (p_status IS NULL OR t.status ILIKE p_status)
        AND (p_category IS NULL OR t.category ILIKE '%' || p_category || '%')
        AND (
            p_query IS NULL
            OR t.title ILIKE '%' || p_query || '%'
            OR t.description ILIKE '%' || p_query || '%'
        );

    RETURN v_count;
END;
$$;


--
-- Name: get_tenders_sp(character varying, character varying, text, character varying, character varying, integer, integer); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_tenders_sp(IN p_status character varying, IN p_category character varying, IN p_query text, IN p_sort_by character varying, IN p_sort_dir character varying, IN p_limit integer, IN p_offset integer, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_tenders(
        p_status,
        p_category,
        p_query,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;


--
-- Name: get_vendor_compliance_documents(uuid); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_vendor_compliance_documents(p_vendorid uuid) RETURNS TABLE("DocumentID" uuid, "VendorID" uuid, "DocumentName" character varying, "DocumentType" character varying, "FileReference" text, "UploadDate" timestamp without time zone, "ExpiryDate" timestamp without time zone, "DocumentStatus" character varying, "RejectionReason" text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd."DocumentID",
        cd."VendorID",
        cd."DocumentName",
        cd."DocumentType",
        cd."FileReference",
        cd."UploadDate",
        cd."ExpiryDate",
        cd."DocumentStatus",
        cd."RejectionReason"
    FROM
        vendor_sourcing."ComplianceDocuments" cd
    WHERE
        cd."VendorID" = p_VendorID;
END;
$$;


--
-- Name: get_vendor_compliance_documents_by_email(character varying); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_vendor_compliance_documents_by_email(p_email character varying) RETURNS TABLE("DocumentID" uuid, "VendorID" uuid, "DocumentName" character varying, "DocumentType" character varying, "FileReference" text, "UploadDate" timestamp without time zone, "ExpiryDate" timestamp without time zone, "DocumentStatus" character varying, "RejectionReason" text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd."DocumentID",
        cd."VendorID",
        cd."DocumentName",
        cd."DocumentType",
        cd."FileReference",
        cd."UploadDate",
        cd."ExpiryDate",
        cd."DocumentStatus",
        cd."RejectionReason"
    FROM vendor_sourcing."ComplianceDocuments" cd
    INNER JOIN identity."Vendors" v ON v."VendorID" = cd."VendorID"
    WHERE lower(v."Email") = lower(p_Email)
    ORDER BY cd."DocumentName";
END;
$$;


--
-- Name: get_vendor_compliance_documents_by_email_proc(character varying); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_vendor_compliance_documents_by_email_proc(IN p_email character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Returns a result set from the underlying function.
    SELECT *
    FROM vendor_sourcing."GetVendorComplianceDocumentsByEmail"(p_email);
END;
$$;


--
-- Name: get_vendor_compliance_documents_by_email_proc(character varying, text); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_vendor_compliance_documents_by_email_proc(IN p_email character varying, INOUT p_documents_json text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'DocumentID', cd."DocumentID",
                'VendorID', cd."VendorID",
                'DocumentName', cd."DocumentName",
                'DocumentType', cd."DocumentType",
                'FileReference', cd."FileReference",
                'UploadDate', cd."UploadDate",
                'ExpiryDate', cd."ExpiryDate",
                'DocumentStatus', cd."DocumentStatus",
                'RejectionReason', cd."RejectionReason"
            )
            ORDER BY cd."DocumentName"
        )::text,
        '[]'
    )
    INTO p_documents_json
    FROM vendor_sourcing."ComplianceDocuments" cd
    INNER JOIN identity."Vendors" v ON v."VendorID" = cd."VendorID"
    WHERE lower(v."Email") = lower(p_email);
END;
$$;


--
-- Name: get_vendor_profile(uuid); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_vendor_profile(p_vendorid uuid) RETURNS TABLE("VendorID" uuid, "CompanyName" character varying, "RegistrationNumber" character varying, "TaxID" character varying, "CompanyAddress" text, "ContactPerson" character varying, "Email" character varying, "RegistrationDate" timestamp without time zone, "LastLogin" timestamp without time zone, "VendorStatus" character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        v."VendorID",
        v."CompanyName",
        v."RegistrationNumber",
        v."TaxID",
        v."CompanyAddress",
        v."ContactPerson",
        v."Email",
        v."RegistrationDate",
        v."LastLogin",
        v."VendorStatus"
    FROM
        identity."Vendors" v
    WHERE
        v."VendorID" = p_VendorID;
END;
$$;


--
-- Name: get_vendor_profile_by_email(character varying); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.get_vendor_profile_by_email(p_email character varying) RETURNS TABLE("VendorID" uuid, "CompanyName" character varying, "RegistrationNumber" character varying, "TaxID" character varying, "CompanyAddress" text, "ContactPerson" character varying, "Email" character varying, "RegistrationDate" timestamp without time zone, "LastLogin" timestamp without time zone, "VendorStatus" character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        v."VendorID",
        v."CompanyName",
        v."RegistrationNumber",
        v."TaxID",
        v."CompanyAddress",
        v."ContactPerson",
        v."Email",
        v."RegistrationDate",
        v."LastLogin",
        v."VendorStatus"
    FROM identity."Vendors" v
    WHERE lower(v."Email") = lower(p_Email)
    LIMIT 1;
END;
$$;


--
-- Name: get_vendor_profile_by_email_proc(character varying, uuid, character varying, character varying, character varying, text, character varying, character varying, timestamp without time zone, timestamp without time zone, character varying); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.get_vendor_profile_by_email_proc(IN p_email character varying, INOUT p_vendorid uuid DEFAULT NULL::uuid, INOUT p_companyname character varying DEFAULT NULL::character varying, INOUT p_registrationnumber character varying DEFAULT NULL::character varying, INOUT p_taxid character varying DEFAULT NULL::character varying, INOUT p_companyaddress text DEFAULT NULL::text, INOUT p_contactperson character varying DEFAULT NULL::character varying, INOUT p_email_out character varying DEFAULT NULL::character varying, INOUT p_registrationdate timestamp without time zone DEFAULT NULL::timestamp without time zone, INOUT p_lastlogin timestamp without time zone DEFAULT NULL::timestamp without time zone, INOUT p_vendorstatus character varying DEFAULT NULL::character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT
        vp."VendorID",
        vp."CompanyName",
        vp."RegistrationNumber",
        vp."TaxID",
        vp."CompanyAddress",
        vp."ContactPerson",
        vp."Email",
        vp."RegistrationDate",
        vp."LastLogin",
        vp."VendorStatus"
    INTO
        p_vendorid,
        p_companyname,
        p_registrationnumber,
        p_taxid,
        p_companyaddress,
        p_contactperson,
        p_email_out,
        p_registrationdate,
        p_lastlogin,
        p_vendorstatus
    FROM vendor_sourcing."GetVendorProfileByEmail"(p_email) vp;
END;
$$;


--
-- Name: publish_tender(uuid, timestamp without time zone, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.publish_tender(p_tender_id uuid, p_publish_date timestamp without time zone, p_opening_date timestamp without time zone, p_closing_date timestamp without time zone) RETURNS TABLE(tender_id uuid, title character varying, description text, category character varying, status character varying, budget numeric, department character varying, budget_code character varying, fiscal_year integer, specifications text, eligibility_criteria text, evaluation_criteria text, publish_date timestamp without time zone, opening_date timestamp without time zone, closing_date timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_budget DECIMAL(18, 2);
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_fiscal_year INT;
BEGIN
    UPDATE vendor_sourcing.tenders AS t
    SET
        status = 'Published',
        publish_date = COALESCE(p_publish_date, NOW()),
        opening_date = COALESCE(p_opening_date, t.opening_date),
        closing_date = COALESCE(p_closing_date, t.closing_date),
        fiscal_year = COALESCE(t.fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::int),
        updated_at = NOW()
    WHERE t.tender_id = p_tender_id
    RETURNING t.budget, t.department, t.budget_code, t.fiscal_year
    INTO v_budget, v_department, v_budget_code, v_fiscal_year;

    PERFORM procurement_workflow.reserve_budget_for_tender(
        p_tender_id,
        v_budget_code,
        v_department,
        v_fiscal_year,
        v_budget
    );

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.specifications,
        t.eligibility_criteria,
        t.evaluation_criteria,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at,
        t.updated_at
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;
END;
$$;


--
-- Name: publish_tender_sp(uuid, timestamp without time zone, timestamp without time zone, timestamp without time zone); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.publish_tender_sp(IN p_tender_id uuid, IN p_publish_date timestamp without time zone, IN p_opening_date timestamp without time zone, IN p_closing_date timestamp without time zone, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.publish_tender(
        p_tender_id,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;


--
-- Name: submit_bid(uuid, uuid, numeric, text, integer); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.submit_bid(p_tender_id uuid, p_vendor_id uuid, p_bid_amount numeric, p_technical_proposal_url text, p_validity_period_days integer) RETURNS TABLE(bid_id uuid, tender_id uuid, vendor_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM vendor_sourcing.bids
        WHERE tender_id = p_tender_id
          AND vendor_id = p_vendor_id
    ) THEN
        RAISE EXCEPTION 'Bid already submitted for this tender.'
            USING ERRCODE = '23505';
    END IF;

    RETURN QUERY
    INSERT INTO vendor_sourcing.bids (
        tender_id,
        vendor_id,
        bid_amount,
        technical_proposal_url,
        validity_period_days,
        status
    )
    VALUES (
        p_tender_id,
        p_vendor_id,
        p_bid_amount,
        p_technical_proposal_url,
        p_validity_period_days,
        'Submitted'
    )
    RETURNING bids.bid_id, bids.tender_id, bids.vendor_id;
END;
$$;


--
-- Name: submit_bid_sp(uuid, uuid, numeric, text, integer); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.submit_bid_sp(IN p_tender_id uuid, IN p_vendor_id uuid, IN p_bid_amount numeric, IN p_technical_proposal_url text, IN p_validity_period_days integer, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.submit_bid(
        p_tender_id,
        p_vendor_id,
        p_bid_amount,
        p_technical_proposal_url,
        p_validity_period_days
    );
END;
$$;


--
-- Name: update_bid_opening_session(uuid, character varying, character varying, timestamp without time zone, character varying, timestamp without time zone, timestamp without time zone, text); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.update_bid_opening_session(p_session_id uuid, p_session_title character varying, p_location character varying, p_scheduled_at timestamp without time zone, p_status character varying, p_opened_at timestamp without time zone, p_closed_at timestamp without time zone, p_notes text) RETURNS TABLE(session_id uuid, tender_id uuid, session_title character varying, location character varying, scheduled_at timestamp without time zone, status character varying, opened_at timestamp without time zone, closed_at timestamp without time zone, notes text, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE vendor_sourcing.bid_opening_sessions
    SET
        session_title = COALESCE(p_session_title, session_title),
        location = COALESCE(p_location, location),
        scheduled_at = COALESCE(p_scheduled_at, scheduled_at),
        status = COALESCE(p_status, status),
        opened_at = COALESCE(p_opened_at, opened_at),
        closed_at = COALESCE(p_closed_at, closed_at),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN QUERY
    SELECT * FROM vendor_sourcing.get_bid_opening_session_details(p_session_id);
END;
$$;


--
-- Name: update_bid_opening_session_sp(uuid, character varying, character varying, timestamp without time zone, character varying, timestamp without time zone, timestamp without time zone, text); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.update_bid_opening_session_sp(IN p_session_id uuid, IN p_session_title character varying, IN p_location character varying, IN p_scheduled_at timestamp without time zone, IN p_status character varying, IN p_opened_at timestamp without time zone, IN p_closed_at timestamp without time zone, IN p_notes text, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.update_bid_opening_session(
        p_session_id,
        p_session_title,
        p_location,
        p_scheduled_at,
        p_status,
        p_opened_at,
        p_closed_at,
        p_notes
    );
END;
$$;


--
-- Name: update_tender(uuid, character varying, text, character varying, character varying, numeric, character varying, character varying, integer, text, text, text, timestamp without time zone, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.update_tender(p_tender_id uuid, p_title character varying, p_description text, p_category character varying, p_status character varying, p_budget numeric, p_department character varying, p_budget_code character varying, p_fiscal_year integer, p_specifications text, p_eligibility_criteria text, p_evaluation_criteria text, p_publish_date timestamp without time zone, p_opening_date timestamp without time zone, p_closing_date timestamp without time zone) RETURNS TABLE(tender_id uuid, title character varying, description text, category character varying, status character varying, budget numeric, department character varying, budget_code character varying, fiscal_year integer, specifications text, eligibility_criteria text, evaluation_criteria text, publish_date timestamp without time zone, opening_date timestamp without time zone, closing_date timestamp without time zone, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_existing_status VARCHAR(50);
    v_existing_budget DECIMAL(18, 2);
    v_existing_department VARCHAR(150);
    v_existing_budget_code VARCHAR(60);
    v_existing_fiscal_year INT;
    v_status VARCHAR(50);
    v_budget DECIMAL(18, 2);
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_fiscal_year INT;
BEGIN
    SELECT t.status, t.budget, t.department, t.budget_code, t.fiscal_year
    INTO v_existing_status, v_existing_budget, v_existing_department, v_existing_budget_code, v_existing_fiscal_year
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;

    v_status := COALESCE(p_status, v_existing_status);
    v_budget := COALESCE(p_budget, v_existing_budget);
    v_department := COALESCE(p_department, v_existing_department);
    v_budget_code := COALESCE(p_budget_code, v_existing_budget_code);
    v_fiscal_year := COALESCE(p_fiscal_year, v_existing_fiscal_year, EXTRACT(YEAR FROM NOW())::INT);

    UPDATE vendor_sourcing.tenders
    SET
        title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        category = COALESCE(p_category, category),
        status = COALESCE(p_status, status),
        budget = COALESCE(p_budget, budget),
        department = v_department,
        budget_code = v_budget_code,
        fiscal_year = v_fiscal_year,
        specifications = COALESCE(p_specifications, specifications),
        eligibility_criteria = COALESCE(p_eligibility_criteria, eligibility_criteria),
        evaluation_criteria = COALESCE(p_evaluation_criteria, evaluation_criteria),
        publish_date = COALESCE(p_publish_date, publish_date),
        opening_date = COALESCE(p_opening_date, opening_date),
        closing_date = COALESCE(p_closing_date, closing_date),
        updated_at = NOW()
    WHERE tender_id = p_tender_id;

    IF v_status IN ('Published', 'Closed', 'Awarded') THEN
        PERFORM procurement_workflow.reserve_budget_for_tender(
            p_tender_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_budget
        );
    ELSIF v_status IN ('Draft', 'Cancelled') THEN
        PERFORM procurement_workflow.release_budget_for_tender(p_tender_id);
    END IF;

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.specifications,
        t.eligibility_criteria,
        t.evaluation_criteria,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at,
        t.updated_at
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;
END;
$$;


--
-- Name: update_tender_sp(uuid, character varying, text, character varying, character varying, numeric, character varying, character varying, integer, text, text, text, timestamp without time zone, timestamp without time zone, timestamp without time zone); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.update_tender_sp(IN p_tender_id uuid, IN p_title character varying, IN p_description text, IN p_category character varying, IN p_status character varying, IN p_budget numeric, IN p_department character varying, IN p_budget_code character varying, IN p_fiscal_year integer, IN p_specifications text, IN p_eligibility_criteria text, IN p_evaluation_criteria text, IN p_publish_date timestamp without time zone, IN p_opening_date timestamp without time zone, IN p_closing_date timestamp without time zone, OUT p_result refcursor)
    LANGUAGE plpgsql
    AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.update_tender(
        p_tender_id,
        p_title,
        p_description,
        p_category,
        p_status,
        p_budget,
        p_department,
        p_budget_code,
        p_fiscal_year,
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;


--
-- Name: upload_compliance_document(uuid, character varying, character varying, text, timestamp without time zone); Type: FUNCTION; Schema: vendor_sourcing; Owner: -
--

CREATE FUNCTION vendor_sourcing.upload_compliance_document(p_vendorid uuid, p_documentname character varying, p_documenttype character varying, p_filereference text, p_expirydate timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("DocumentID" uuid, "VendorID" uuid, "DocumentName" character varying, "DocumentType" character varying, "FileReference" text, "DocumentStatus" character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM vendor_sourcing."ComplianceDocuments" cd
        WHERE cd."VendorID" = p_VendorID AND cd."DocumentName" = p_DocumentName
    ) THEN
        RETURN QUERY
        UPDATE vendor_sourcing."ComplianceDocuments" cd
        SET
            "DocumentType" = p_DocumentType,
            "FileReference" = p_FileReference,
            "UploadDate" = NOW(),
            "ExpiryDate" = p_ExpiryDate,
            "DocumentStatus" = 'Pending Review',
            "ReviewerID" = NULL,
            "ReviewDate" = NULL,
            "RejectionReason" = NULL,
            "UpdatedAt" = NOW()
        WHERE
            cd."VendorID" = p_VendorID AND cd."DocumentName" = p_DocumentName
        RETURNING
            cd."DocumentID", cd."VendorID", cd."DocumentName", cd."DocumentType", cd."FileReference", cd."DocumentStatus";
    ELSE
        RETURN QUERY
        INSERT INTO vendor_sourcing."ComplianceDocuments" AS cd (
            "VendorID",
            "DocumentName",
            "DocumentType",
            "FileReference",
            "ExpiryDate",
            "DocumentStatus"
        )
        VALUES (
            p_VendorID,
            p_DocumentName,
            p_DocumentType,
            p_FileReference,
            p_ExpiryDate,
            'Pending Review'
        )
        RETURNING
            cd."DocumentID", cd."VendorID", cd."DocumentName", cd."DocumentType", cd."FileReference", cd."DocumentStatus";
    END IF;
END;
$$;


--
-- Name: upload_compliance_document_by_email_proc(character varying, character varying, character varying, text, timestamp without time zone, uuid, uuid, character varying, character varying, text, character varying); Type: PROCEDURE; Schema: vendor_sourcing; Owner: -
--

CREATE PROCEDURE vendor_sourcing.upload_compliance_document_by_email_proc(IN p_email character varying, IN p_documentname character varying, IN p_documenttype character varying, IN p_filereference text, IN p_expirydate timestamp without time zone, INOUT p_documentid uuid DEFAULT NULL::uuid, INOUT p_vendorid uuid DEFAULT NULL::uuid, INOUT p_documentname_out character varying DEFAULT NULL::character varying, INOUT p_documenttype_out character varying DEFAULT NULL::character varying, INOUT p_filereference_out text DEFAULT NULL::text, INOUT p_documentstatus character varying DEFAULT NULL::character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_vendorid UUID;
BEGIN
    SELECT v."VendorID"
    INTO v_vendorid
    FROM identity."Vendors" v
    WHERE lower(v."Email") = lower(p_email)
    LIMIT 1;

    IF v_vendorid IS NULL THEN
        RETURN;
    END IF;

    SELECT
        ucd."DocumentID",
        ucd."VendorID",
        ucd."DocumentName",
        ucd."DocumentType",
        ucd."FileReference",
        ucd."DocumentStatus"
    INTO
        p_documentid,
        p_vendorid,
        p_documentname_out,
        p_documenttype_out,
        p_filereference_out,
        p_documentstatus
    FROM vendor_sourcing."UploadComplianceDocument"(
        v_vendorid,
        p_documentname,
        p_documenttype,
        p_filereference,
        p_expirydate
    ) ucd;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: compliance_document_history; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.compliance_document_history (
    history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    document_url text NOT NULL,
    expiry_date date,
    verification_status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: compliance_documents; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.compliance_documents (
    document_id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    document_url text NOT NULL,
    expiry_date date,
    verification_status character varying(50) DEFAULT 'Pending'::character varying,
    verified_by character varying(255),
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: internal_module_grant_audit; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.internal_module_grant_audit (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type character varying(10) NOT NULL,
    role_id uuid,
    internal_user_id uuid,
    module_id character varying(120) NOT NULL,
    previous_state boolean,
    new_state boolean,
    changed_by uuid,
    change_source character varying(40) DEFAULT 'manual'::character varying NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_module_grant_audit_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['role'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: internal_module_grants; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.internal_module_grants (
    grant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid,
    internal_user_id uuid,
    module_id character varying(120) NOT NULL,
    is_enabled boolean NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_module_grants_target_chk CHECK ((((role_id IS NOT NULL) AND (internal_user_id IS NULL)) OR ((role_id IS NULL) AND (internal_user_id IS NOT NULL))))
);


--
-- Name: internal_users; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.internal_users (
    internal_user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id uuid NOT NULL,
    status character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    last_login timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    username character varying(100) NOT NULL,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100),
    surname character varying(100) NOT NULL,
    service_number character varying(100) NOT NULL,
    unit_id uuid
);


--
-- Name: organizational_positions; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.organizational_positions (
    position_id uuid DEFAULT gen_random_uuid() NOT NULL,
    position_code character varying(80) NOT NULL,
    position_title character varying(160) NOT NULL,
    unit_id uuid,
    reports_to_position_id uuid,
    is_executive boolean DEFAULT false NOT NULL,
    is_board_eligible boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: organizational_units; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.organizational_units (
    unit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_code character varying(60) NOT NULL,
    unit_name character varying(150) NOT NULL,
    unit_type character varying(50) NOT NULL,
    parent_unit_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_assignable boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.roles (
    role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_login_security; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.user_login_security (
    internal_user_id uuid NOT NULL,
    failed_login_attempts integer DEFAULT 0,
    lockout_until timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vendors; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.vendors (
    vendor_id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name character varying(255) NOT NULL,
    registration_number character varying(100) NOT NULL,
    tax_id character varying(100) NOT NULL,
    company_address text NOT NULL,
    contact_person character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    registration_date timestamp without time zone DEFAULT now(),
    last_login timestamp without time zone,
    vendor_status character varying(50) DEFAULT 'Pending Approval'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    phone_number character varying(50)
);


--
-- Name: contract_awards; Type: TABLE; Schema: post_award; Owner: -
--

CREATE TABLE post_award.contract_awards (
    award_id uuid DEFAULT gen_random_uuid() NOT NULL,
    award_code character varying(50) NOT NULL,
    tender_title character varying(255) NOT NULL,
    vendor_name character varying(255) NOT NULL,
    award_value numeric(18,2) DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    award_date timestamp without time zone NOT NULL,
    contract_start timestamp without time zone NOT NULL,
    contract_end timestamp without time zone NOT NULL,
    funding_source character varying(120) NOT NULL,
    notes text,
    published_at timestamp without time zone,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT contract_awards_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending Approval'::character varying, 'Approved'::character varying, 'Published'::character varying, 'Cancelled'::character varying])::text[]))),
    CONSTRAINT contract_awards_value_chk CHECK ((award_value >= (0)::numeric))
);


--
-- Name: contract_milestones; Type: TABLE; Schema: post_award; Owner: -
--

CREATE TABLE post_award.contract_milestones (
    milestone_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_code character varying(50) NOT NULL,
    milestone_title character varying(180) NOT NULL,
    status_after character varying(50) NOT NULL,
    progress_after integer DEFAULT 0 NOT NULL,
    notes text NOT NULL,
    contract_manager character varying(150) NOT NULL,
    recorded_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT contract_milestones_progress_chk CHECK (((progress_after >= 0) AND (progress_after <= 100))),
    CONSTRAINT contract_milestones_status_chk CHECK (((status_after)::text = ANY ((ARRAY['Active'::character varying, 'On Hold'::character varying, 'Completed'::character varying, 'Terminated'::character varying])::text[])))
);


--
-- Name: contracts; Type: TABLE; Schema: post_award; Owner: -
--

CREATE TABLE post_award.contracts (
    contract_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_code character varying(50) NOT NULL,
    tender_title character varying(255) NOT NULL,
    vendor_name character varying(255) NOT NULL,
    contract_value numeric(18,2) DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    contract_manager character varying(150) NOT NULL,
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    is_paid boolean DEFAULT false NOT NULL,
    payment_recorded_at timestamp without time zone,
    CONSTRAINT contracts_progress_chk CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT contracts_status_chk CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'On Hold'::character varying, 'Completed'::character varying, 'Terminated'::character varying])::text[]))),
    CONSTRAINT contracts_value_chk CHECK ((contract_value >= (0)::numeric))
);


--
-- Name: inspections; Type: TABLE; Schema: post_award; Owner: -
--

CREATE TABLE post_award.inspections (
    inspection_id uuid DEFAULT gen_random_uuid() NOT NULL,
    inspection_code character varying(50) NOT NULL,
    contract_code character varying(50) NOT NULL,
    tender_title character varying(255) NOT NULL,
    vendor_name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'Scheduled'::character varying NOT NULL,
    scheduled_date timestamp without time zone NOT NULL,
    completed_date timestamp without time zone,
    inspector_name character varying(150) NOT NULL,
    outcome character varying(50),
    location character varying(255) NOT NULL,
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT inspections_outcome_chk CHECK (((outcome IS NULL) OR ((outcome)::text = ANY ((ARRAY['Accepted'::character varying, 'Rejected'::character varying, 'Pending'::character varying])::text[])))),
    CONSTRAINT inspections_status_chk CHECK (((status)::text = ANY ((ARRAY['Scheduled'::character varying, 'In Progress'::character varying, 'Accepted'::character varying, 'Rejected'::character varying])::text[])))
);


--
-- Name: payments; Type: TABLE; Schema: post_award; Owner: -
--

CREATE TABLE post_award.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_reference character varying(80) NOT NULL,
    contract_code character varying(50) NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(40) DEFAULT 'Paid'::character varying NOT NULL,
    payment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recorded_by character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: approval_thresholds; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.approval_thresholds (
    threshold_id uuid DEFAULT gen_random_uuid() NOT NULL,
    procurement_type character varying(50),
    min_amount numeric(18,2) DEFAULT 0 NOT NULL,
    max_amount numeric(18,2),
    approval_route character varying(80) NOT NULL,
    requires_board boolean DEFAULT false NOT NULL,
    requires_bpp boolean DEFAULT false NOT NULL,
    status character varying(30) DEFAULT 'Active'::character varying NOT NULL,
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    approval_authority_code character varying(80) DEFAULT 'GENERIC_ROUTE'::character varying NOT NULL,
    approval_authority_label character varying(160) DEFAULT 'Threshold authority'::character varying NOT NULL,
    requires_cgis_approval boolean DEFAULT false NOT NULL,
    governance_body_id uuid,
    CONSTRAINT approval_thresholds_amount_chk CHECK (((min_amount >= (0)::numeric) AND ((max_amount IS NULL) OR (max_amount >= min_amount)))),
    CONSTRAINT approval_thresholds_status_chk CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


--
-- Name: bids; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.bids (
    bid_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    financial_bid numeric(18,2) NOT NULL,
    technical_proposal text NOT NULL,
    validity_period_days integer NOT NULL,
    submission_date timestamp without time zone DEFAULT now(),
    bid_status character varying(50) DEFAULT 'Submitted'::character varying NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: bpp_no_objections; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.bpp_no_objections (
    no_objection_id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid,
    tender_id uuid,
    amount numeric(18,2) NOT NULL,
    procurement_type character varying(50),
    status character varying(30) DEFAULT 'Draft'::character varying NOT NULL,
    requested_by character varying(255),
    requested_at timestamp without time zone DEFAULT now(),
    decision_by character varying(255),
    decision_at timestamp without time zone,
    decision_notes text,
    reference_code character varying(80),
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bpp_no_objections_source_chk CHECK (((requisition_id IS NOT NULL) OR (tender_id IS NOT NULL))),
    CONSTRAINT bpp_no_objections_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Submitted'::character varying, 'In Review'::character varying, 'Approved'::character varying, 'Rejected'::character varying, 'Cancelled'::character varying])::text[])))
);


--
-- Name: budget_appropriations; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.budget_appropriations (
    appropriation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    fiscal_year integer NOT NULL,
    department character varying(150) NOT NULL,
    budget_code character varying(60) NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(30) DEFAULT 'Active'::character varying NOT NULL,
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT budget_appropriations_amount_chk CHECK ((amount > (0)::numeric)),
    CONSTRAINT budget_appropriations_status_chk CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Closed'::character varying])::text[])))
);


--
-- Name: budget_commitments; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.budget_commitments (
    commitment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid,
    tender_id uuid,
    fiscal_year integer NOT NULL,
    department character varying(150) NOT NULL,
    budget_code character varying(60) NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(30) DEFAULT 'Reserved'::character varying NOT NULL,
    committed_at timestamp without time zone DEFAULT now(),
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    appropriation_id uuid,
    CONSTRAINT budget_commitments_amount_chk CHECK ((amount > (0)::numeric)),
    CONSTRAINT budget_commitments_source_chk CHECK (((requisition_id IS NOT NULL) OR (tender_id IS NOT NULL) OR (appropriation_id IS NOT NULL))),
    CONSTRAINT budget_commitments_status_chk CHECK (((status)::text = ANY ((ARRAY['Reserved'::character varying, 'Committed'::character varying, 'Released'::character varying, 'Cancelled'::character varying])::text[])))
);


--
-- Name: budget_expenditures; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.budget_expenditures (
    expenditure_id uuid DEFAULT gen_random_uuid() NOT NULL,
    commitment_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    spent_at timestamp without time zone DEFAULT now(),
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT budget_expenditures_amount_chk CHECK ((amount > (0)::numeric))
);


--
-- Name: budget_lines; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.budget_lines (
    budget_code character varying(100) NOT NULL,
    department character varying(255) NOT NULL,
    funding_source character varying(255) NOT NULL,
    allocated_amount numeric(18,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: budget_releases; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.budget_releases (
    release_id uuid DEFAULT gen_random_uuid() NOT NULL,
    appropriation_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    release_date timestamp without time zone DEFAULT now(),
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT budget_releases_amount_chk CHECK ((amount > (0)::numeric))
);


--
-- Name: evaluation_actions; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.evaluation_actions (
    action_id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type character varying(50) NOT NULL,
    report_code character varying(50),
    tender_id uuid NOT NULL,
    notes text,
    reason text,
    justification text,
    recommendation character varying(120),
    threshold_note text,
    requested_by character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: evaluation_reports; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.evaluation_reports (
    report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_code character varying(50) NOT NULL,
    tender_id uuid NOT NULL,
    tender_title character varying(255) NOT NULL,
    committee_lead character varying(150) NOT NULL,
    recommendation character varying(120) NOT NULL,
    score_summary character varying(120) NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    submitted_at timestamp without time zone NOT NULL,
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT evaluation_reports_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Submitted'::character varying, 'Under Review'::character varying, 'Approved'::character varying, 'Returned'::character varying])::text[])))
);


--
-- Name: governance_bodies; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.governance_bodies (
    body_id uuid DEFAULT gen_random_uuid() NOT NULL,
    body_code character varying(80) NOT NULL,
    body_name character varying(160) NOT NULL,
    body_type character varying(80) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: governance_body_memberships; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.governance_body_memberships (
    membership_id uuid DEFAULT gen_random_uuid() NOT NULL,
    body_id uuid NOT NULL,
    position_id uuid NOT NULL,
    membership_role character varying(80) NOT NULL,
    voting_order integer DEFAULT 0 NOT NULL,
    is_voting_member boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(255) DEFAULT CURRENT_USER NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: internal_requisitions; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.internal_requisitions (
    requisition_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(500) NOT NULL,
    department character varying(255) NOT NULL,
    procurement_category character varying(100) NOT NULL,
    app_reference character varying(100) NOT NULL,
    budget_code character varying(100) NOT NULL,
    estimated_cost numeric(18,2) NOT NULL,
    justification text NOT NULL,
    scope_summary text NOT NULL,
    urgency character varying(50) NOT NULL,
    required_by timestamp without time zone NOT NULL,
    procurement_method character varying(255) NOT NULL,
    bpp_no_objection_required boolean DEFAULT false NOT NULL,
    status character varying(100) NOT NULL,
    created_by character varying(255) NOT NULL,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: planning_committee_configuration; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.planning_committee_configuration (
    committee_code character varying NOT NULL,
    chairman_internal_user_id uuid,
    assigned_by character varying,
    assigned_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: planning_committee_decisions; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.planning_committee_decisions (
    decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    chairman_user_id character varying(255) NOT NULL,
    secretary_user_id character varying(255) NOT NULL,
    overall_decision character varying(50) NOT NULL,
    committee_remarks text,
    meeting_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    requisition_id uuid NOT NULL,
    CONSTRAINT committee_decision_overall_chk CHECK (((overall_decision)::text = ANY ((ARRAY['Recommended'::character varying, 'ReturnedToDepartment'::character varying, 'Rejected'::character varying])::text[])))
);


--
-- Name: planning_committee_member_reviews; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.planning_committee_member_reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    reviewer_role character varying(80) NOT NULL,
    reviewer_user_id character varying(255) NOT NULL,
    decision character varying(50) NOT NULL,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    requisition_id uuid,
    review_round integer DEFAULT 1 NOT NULL,
    CONSTRAINT member_review_decision_chk CHECK (((decision)::text = ANY ((ARRAY['Cleared'::character varying, 'Queried'::character varying, 'Rejected'::character varying])::text[])))
);


--
-- Name: planning_committee_member_status; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.planning_committee_member_status (
    status_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    role_key character varying(80) NOT NULL,
    status_label character varying(80) NOT NULL,
    decision character varying(50),
    updated_by character varying(255),
    updated_at timestamp without time zone DEFAULT now(),
    requisition_id uuid
);


--
-- Name: planning_committee_plan_links; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.planning_committee_plan_links (
    requisition_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    linked_by character varying(255),
    linked_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: procurement_closeouts; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.procurement_closeouts (
    closeout_id uuid DEFAULT gen_random_uuid() NOT NULL,
    closeout_reference character varying(80) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id uuid NOT NULL,
    status character varying(40) DEFAULT 'Archived'::character varying NOT NULL,
    record_title character varying(255),
    summary text NOT NULL,
    archive_location text,
    final_acceptance_completed boolean DEFAULT false NOT NULL,
    final_payment_completed boolean DEFAULT false NOT NULL,
    archived_by character varying(255),
    archived_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT procurement_closeouts_status_chk CHECK (((status)::text = ANY ((ARRAY['Submitted'::character varying, 'Archived'::character varying, 'Reopened'::character varying])::text[])))
);


--
-- Name: procurement_complaints; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.procurement_complaints (
    complaint_id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_reference character varying(80) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id uuid NOT NULL,
    stage_key_at_filing character varying(80) NOT NULL,
    status character varying(40) DEFAULT 'Filed'::character varying NOT NULL,
    subject character varying(255) NOT NULL,
    summary text NOT NULL,
    details text NOT NULL,
    complaint_channel character varying(80),
    requested_remedy text,
    filed_by character varying(255),
    assigned_to character varying(255),
    reviewed_by character varying(255),
    resolution_outcome character varying(80),
    resolution_stage_key character varying(80),
    resolution_notes text,
    filed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at timestamp without time zone,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT procurement_complaints_resolution_outcome_chk CHECK (((resolution_outcome IS NULL) OR ((resolution_outcome)::text = ANY ((ARRAY['Resume Procurement'::character varying, 'Modify Decision'::character varying, 'Escalate To BPP'::character varying, 'Terminate Procurement'::character varying, 'Dismiss Complaint'::character varying])::text[])))),
    CONSTRAINT procurement_complaints_status_chk CHECK (((status)::text = ANY ((ARRAY['Filed'::character varying, 'In Review'::character varying, 'Escalated'::character varying, 'Resolved'::character varying, 'Rejected'::character varying, 'Closed'::character varying])::text[])))
);


--
-- Name: procurement_plan_cycles; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.procurement_plan_cycles (
    plan_cycle_id uuid DEFAULT gen_random_uuid() NOT NULL,
    fiscal_year integer NOT NULL,
    cycle_code character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    department character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    created_by character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    submitted_at timestamp without time zone,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    rejection_reason text
);


--
-- Name: procurement_plan_items; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.procurement_plan_items (
    plan_item_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_cycle_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    app_code character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    department character varying(255) NOT NULL,
    procurement_category character varying(100) NOT NULL,
    budget_code character varying(100) NOT NULL,
    funding_source character varying(255) NOT NULL,
    estimated_cost numeric(18,2) NOT NULL,
    procurement_method character varying(255) NOT NULL,
    bpp_no_objection_required boolean DEFAULT false NOT NULL,
    budget_verified boolean DEFAULT false NOT NULL,
    budget_verified_by character varying(255),
    budget_verified_at timestamp without time zone,
    status character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    created_by character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    plan_id uuid NOT NULL,
    item_code character varying(60),
    description text NOT NULL,
    procurement_type character varying(50),
    estimated_amount numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT procurement_plan_items_amount_chk CHECK ((estimated_amount >= (0)::numeric)),
    CONSTRAINT procurement_plan_items_status_chk CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying, 'Cancelled'::character varying])::text[])))
);


--
-- Name: procurement_plans; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.procurement_plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_title character varying(255) NOT NULL,
    department character varying(150) NOT NULL,
    fiscal_year integer NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    total_budget numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    submitted_at timestamp without time zone,
    approved_at timestamp without time zone,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    yearly_app_id uuid,
    review_round integer DEFAULT 1 NOT NULL,
    CONSTRAINT procurement_plans_budget_chk CHECK ((total_budget >= (0)::numeric)),
    CONSTRAINT procurement_plans_dates_chk CHECK (((approved_at IS NULL) OR (submitted_at IS NULL) OR (approved_at >= submitted_at))),
    CONSTRAINT procurement_plans_dept_len_chk CHECK (((char_length((department)::text) >= 3) AND (char_length((department)::text) <= 150))),
    CONSTRAINT procurement_plans_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Submitted'::character varying, 'Under Review'::character varying, 'Approved'::character varying, 'Returned'::character varying, 'Rejected'::character varying, 'Cancelled'::character varying])::text[]))),
    CONSTRAINT procurement_plans_title_len_chk CHECK (((char_length((plan_title)::text) >= 5) AND (char_length((plan_title)::text) <= 255))),
    CONSTRAINT procurement_plans_year_chk CHECK (((fiscal_year >= 2000) AND (fiscal_year <= 2100)))
);


--
-- Name: requisition_app_unlinks; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.requisition_app_unlinks (
    unlink_id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid NOT NULL,
    previous_app_item_id uuid,
    reason text NOT NULL,
    unlinked_by character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: requisition_approval_tasks; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.requisition_approval_tasks (
    approval_task_id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid NOT NULL,
    sequence integer NOT NULL,
    stage_name character varying(255) NOT NULL,
    required_role character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    decision character varying(50),
    decision_comment text,
    actioned_by character varying(255),
    actioned_at timestamp without time zone,
    due_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: requisition_audit_events; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.requisition_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid NOT NULL,
    event_type character varying(100) NOT NULL,
    actor_email character varying(255) NOT NULL,
    detail text NOT NULL,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: requisition_line_items; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.requisition_line_items (
    line_item_id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid NOT NULL,
    item_code character varying(50),
    description text NOT NULL,
    unit character varying(40) NOT NULL,
    quantity numeric(18,2) NOT NULL,
    unit_cost numeric(18,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT requisition_line_items_cost_chk CHECK ((unit_cost > (0)::numeric)),
    CONSTRAINT requisition_line_items_qty_chk CHECK ((quantity > (0)::numeric))
);


--
-- Name: requisitions; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.requisitions (
    requisition_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    department character varying(150) NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    priority character varying(50),
    procurement_type character varying(50),
    funding_source character varying(120),
    budget_code character varying(60),
    project_code character varying(60),
    required_by timestamp without time zone,
    delivery_location text,
    justification text,
    risk_notes text,
    total_estimate numeric(18,2) DEFAULT 0 NOT NULL,
    current_stage character varying(60),
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    app_item_id uuid,
    unit_id uuid,
    CONSTRAINT requisitions_budget_code_len_chk CHECK (((budget_code IS NULL) OR (char_length((budget_code)::text) <= 60))),
    CONSTRAINT requisitions_department_len_chk CHECK (((char_length((department)::text) >= 3) AND (char_length((department)::text) <= 150))),
    CONSTRAINT requisitions_priority_chk CHECK (((priority IS NULL) OR ((priority)::text = ANY ((ARRAY['Normal'::character varying, 'Urgent'::character varying, 'Strategic'::character varying])::text[])))),
    CONSTRAINT requisitions_proc_type_chk CHECK (((procurement_type IS NULL) OR ((procurement_type)::text = ANY ((ARRAY['Goods'::character varying, 'Works'::character varying, 'Services'::character varying])::text[])))),
    CONSTRAINT requisitions_project_code_len_chk CHECK (((project_code IS NULL) OR (char_length((project_code)::text) <= 60))),
    CONSTRAINT requisitions_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Submitted'::character varying, 'Endorsed'::character varying, 'Initial'::character varying, 'Under Review'::character varying, 'Evaluation'::character varying, 'Board Review'::character varying, 'Approved'::character varying, 'Rejected'::character varying, 'Cancelled'::character varying])::text[]))),
    CONSTRAINT requisitions_title_len_chk CHECK (((char_length((title)::text) >= 5) AND (char_length((title)::text) <= 255))),
    CONSTRAINT requisitions_total_chk CHECK ((total_estimate >= (0)::numeric))
);


--
-- Name: tender_board_decisions; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.tender_board_decisions (
    decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    decision character varying(50) NOT NULL,
    comment text,
    recommended_bid_id uuid,
    recommended_vendor_id uuid,
    decided_by character varying(255) NOT NULL,
    decided_role character varying(100) NOT NULL,
    decided_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tender_documents; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.tender_documents (
    document_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    content_type character varying(100) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tender_evaluation_assignments; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.tender_evaluation_assignments (
    tender_id uuid NOT NULL,
    assignment_role character varying NOT NULL,
    internal_user_id uuid,
    assigned_by character varying,
    assigned_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_tender_evaluation_assignments_role CHECK (((assignment_role)::text = ANY ((ARRAY['technical_evaluator'::character varying, 'financial_evaluator'::character varying, 'evaluation_committee'::character varying])::text[])))
);


--
-- Name: tender_evaluation_financial_scores; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.tender_evaluation_financial_scores (
    score_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    bid_id uuid NOT NULL,
    evaluator_email character varying(255) NOT NULL,
    score numeric(5,2) NOT NULL,
    remarks text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT tender_evaluation_financial_scores_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))
);


--
-- Name: tender_evaluation_technical_scores; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.tender_evaluation_technical_scores (
    score_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    bid_id uuid NOT NULL,
    evaluator_email character varying(255) NOT NULL,
    score numeric(5,2) NOT NULL,
    remarks text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT tender_evaluation_technical_scores_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))
);


--
-- Name: tenders; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.tenders (
    tender_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    procurement_category character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    submission_deadline timestamp without time zone NOT NULL,
    opening_date timestamp without time zone,
    closing_date timestamp without time zone,
    budget numeric(18,2),
    specifications text,
    eligibility_criteria text,
    evaluation_criteria text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    published_at timestamp without time zone,
    advertisement_channel character varying(255),
    published_by character varying(255),
    awarded_bid_id uuid,
    awarded_vendor_id uuid,
    awarded_by character varying(255),
    awarded_at timestamp without time zone,
    award_decision_note text,
    procurement_method character varying(255) DEFAULT 'Open Competitive Bidding'::character varying
);


--
-- Name: workflow_instance_history; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.workflow_instance_history (
    history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid NOT NULL,
    from_stage_key character varying(80),
    to_stage_key character varying(80) NOT NULL,
    stage_status character varying(80),
    transition_source character varying(80) NOT NULL,
    transition_reason text,
    actor character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_instances; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.workflow_instances (
    instance_id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id uuid NOT NULL,
    current_stage_key character varying(80) NOT NULL,
    current_status character varying(80),
    record_title character varying(255),
    parent_entity_type character varying(80),
    parent_entity_id uuid,
    amount numeric(18,2),
    procurement_type character varying(50),
    threshold_id uuid,
    last_transition_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_role_tasks; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.workflow_role_tasks (
    role_task_id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_key character varying(80) NOT NULL,
    display_name character varying(120) NOT NULL,
    stage_key character varying(80) NOT NULL,
    task_description text NOT NULL,
    expected_outcome text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_stage_catalog; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.workflow_stage_catalog (
    stage_id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_key character varying(80) NOT NULL,
    phase_key character varying(80) NOT NULL,
    stage_title character varying(160) NOT NULL,
    stage_description text NOT NULL,
    sequence_no integer NOT NULL,
    is_decision_gate boolean DEFAULT false NOT NULL,
    is_start boolean DEFAULT false NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    primary_owner_role character varying(80) NOT NULL,
    ppa_reference character varying(120),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_stage_transitions; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.workflow_stage_transitions (
    transition_id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_stage_key character varying(80) NOT NULL,
    to_stage_key character varying(80) NOT NULL,
    transition_condition text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: yearly_apps; Type: TABLE; Schema: procurement_workflow; Owner: -
--

CREATE TABLE procurement_workflow.yearly_apps (
    yearly_app_id uuid DEFAULT gen_random_uuid() NOT NULL,
    fiscal_year integer NOT NULL,
    title character varying(150) NOT NULL,
    status character varying(50) DEFAULT 'Under Review'::character varying NOT NULL,
    notes text,
    submitted_at timestamp without time zone,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT yearly_apps_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Submitted'::character varying, 'Under Review'::character varying, 'Approved'::character varying, 'Rejected'::character varying, 'Cancelled'::character varying])::text[]))),
    CONSTRAINT yearly_apps_year_chk CHECK (((fiscal_year >= 2000) AND (fiscal_year <= 2100)))
);


--
-- Name: bid_opening_sessions; Type: TABLE; Schema: vendor_sourcing; Owner: -
--

CREATE TABLE vendor_sourcing.bid_opening_sessions (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    session_title character varying(300) NOT NULL,
    location character varying(255),
    scheduled_at timestamp without time zone NOT NULL,
    status character varying(30) DEFAULT 'Scheduled'::character varying NOT NULL,
    opened_at timestamp without time zone,
    closed_at timestamp without time zone,
    notes text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bid_opening_closed_chk CHECK (((closed_at IS NULL) OR (opened_at IS NULL) OR (closed_at >= opened_at))),
    CONSTRAINT bid_opening_opened_chk CHECK (((opened_at IS NULL) OR (opened_at >= scheduled_at))),
    CONSTRAINT bid_opening_state_chk CHECK (((((status)::text = 'Scheduled'::text) AND (opened_at IS NULL) AND (closed_at IS NULL)) OR (((status)::text = 'Open'::text) AND (opened_at IS NOT NULL) AND (closed_at IS NULL)) OR (((status)::text = 'Closed'::text) AND (opened_at IS NOT NULL) AND (closed_at IS NOT NULL) AND (closed_at >= opened_at)) OR (((status)::text = 'Cancelled'::text) AND (opened_at IS NULL) AND (closed_at IS NULL)))),
    CONSTRAINT bid_opening_status_chk CHECK (((status)::text = ANY ((ARRAY['Scheduled'::character varying, 'Open'::character varying, 'Closed'::character varying, 'Cancelled'::character varying])::text[])))
);


--
-- Name: bids; Type: TABLE; Schema: vendor_sourcing; Owner: -
--

CREATE TABLE vendor_sourcing.bids (
    bid_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    bid_amount numeric(18,2) NOT NULL,
    technical_proposal_url text,
    validity_period_days integer DEFAULT 90 NOT NULL,
    submission_date timestamp without time zone DEFAULT now(),
    status character varying(50) DEFAULT 'Submitted'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: compliance_documents; Type: TABLE; Schema: vendor_sourcing; Owner: -
--

CREATE TABLE vendor_sourcing.compliance_documents (
    document_id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    document_name character varying(255) NOT NULL,
    document_type character varying(100) NOT NULL,
    file_reference text NOT NULL,
    upload_date timestamp without time zone DEFAULT now(),
    expiry_date timestamp without time zone,
    document_status character varying(50) DEFAULT 'Pending Review'::character varying NOT NULL,
    reviewer_id uuid,
    review_date timestamp without time zone,
    rejection_reason text,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tenders; Type: TABLE; Schema: vendor_sourcing; Owner: -
--

CREATE TABLE vendor_sourcing.tenders (
    tender_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying,
    budget numeric(18,2),
    specifications text,
    eligibility_criteria text,
    evaluation_criteria text,
    publish_date timestamp without time zone,
    opening_date timestamp without time zone,
    closing_date timestamp without time zone,
    created_by character varying(255) DEFAULT CURRENT_USER,
    created_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255) DEFAULT CURRENT_USER,
    updated_at timestamp without time zone DEFAULT now(),
    department character varying(150),
    budget_code character varying(60),
    fiscal_year integer,
    CONSTRAINT tenders_budget_chk CHECK (((budget IS NULL) OR (budget >= (0)::numeric))),
    CONSTRAINT tenders_dates_chk CHECK (((closing_date IS NULL) OR (opening_date IS NULL) OR (closing_date >= opening_date))),
    CONSTRAINT tenders_status_chk CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Published'::character varying, 'Closed'::character varying, 'Awarded'::character varying, 'Cancelled'::character varying])::text[])))
);


--
-- Data for Name: compliance_document_history; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.compliance_document_history (history_id, document_id, vendor_id, document_type, document_url, expiry_date, verification_status, created_at) FROM stdin;
\.


--
-- Data for Name: compliance_documents; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.compliance_documents (document_id, vendor_id, document_type, document_url, expiry_date, verification_status, verified_by, verified_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: internal_module_grant_audit; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.internal_module_grant_audit (audit_id, target_type, role_id, internal_user_id, module_id, previous_state, new_state, changed_by, change_source, changed_at) FROM stdin;
\.


--
-- Data for Name: internal_module_grants; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.internal_module_grants (grant_id, role_id, internal_user_id, module_id, is_enabled, updated_by, created_at, updated_at) FROM stdin;
2c72a588-47e8-455d-bc3d-2b96164781ab	\N	d320d7b8-a33a-4f2e-9299-bbf44cb31706	procurement-planning-committee	t	8ba8eae1-9fa0-4e63-a713-9d5b4559ba1c	2026-03-26 06:03:24.74655+01	2026-03-26 06:03:45.399598+01
\.


--
-- Data for Name: internal_users; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.internal_users (internal_user_id, email, password_hash, role_id, status, last_login, is_active, created_by, created_at, updated_by, updated_at, username, first_name, middle_name, surname, service_number, unit_id) FROM stdin;
908ad566-2182-4e7b-bed2-347031b0d819	legalreviewer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	ffb68e92-9051-4bd3-9a4e-1b89059ef209	Active	2026-03-24 07:47:29.40322	t	postgres	2026-03-16 16:40:22.525114	postgres	2026-03-24 07:47:29.40322	legalreviewer	Legal	\N	Reviewer	NIS-00019	a5435fba-fb79-4d78-bb52-2e34a1459737
1fdccd64-0a00-4218-88de-88b8889f64e4	financialunitofficer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	636bc5ab-a728-4716-aea3-65de4049fc1f	Active	2026-03-24 17:16:17.109993	t	postgres	2026-03-16 16:40:22.525114	postgres	2026-03-24 17:16:17.109993	budget	Budget	\N	Officer	NIS-00018	5e166c02-f80b-4c9b-93c9-db8c26e6f431
3b4d42a7-3765-472c-94da-f64d1fcd713f	planningstatisticsofficer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	bd0353b9-3247-4695-af77-e59283ade0ef	Active	2026-03-24 10:48:32.794663	t	postgres	2026-03-16 16:40:22.525114	postgres	2026-03-24 10:48:32.794663	planningstatisticsofficer	Planning	\N	Statistics Officer	NIS-00017	db23d28a-e45b-4dbc-8f37-9563a7c9ff93
1eaed056-ada1-406c-9d31-4a76969b5a51	ict@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	8b11985c-7fab-4737-b585-36ff22fa91c1	Active	2026-03-16 12:19:04.728917	t	postgres	2026-02-28 04:34:36.405728	postgres	2026-03-16 12:19:04.728917	ict	ICT	\N	Administrator	NIS-00005	bee67539-897e-4f52-bdf0-42411936e50f
d320d7b8-a33a-4f2e-9299-bbf44cb31706	procurement@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	939a4029-4c49-4c6c-90da-4815a04bfdba	Active	2026-03-26 05:06:19.178404	t	postgres	2026-02-28 04:34:36.405728	postgres	2026-03-26 05:06:19.178404	procurement	Comptroller	\N	Procurement	NIS-00002	02e969cc-60ab-421f-beae-2687ad4e606b
c6da80a3-d254-4121-9d2e-b8be8d328de2	finance@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	52e3f3e4-e7dc-461a-97e0-af854da6785d	Active	2026-03-18 19:39:24.371356	t	postgres	2026-02-28 04:34:36.405728	postgres	2026-03-18 19:39:24.371356	finance	Finance	\N	Officer	NIS-00003	5e166c02-f80b-4c9b-93c9-db8c26e6f431
b912fbf4-fa7c-4a65-ad0d-4869149f36a6	dcghrm@nis.gov.ng	$2a$11$qy2Kml6wtmZsBaNze2sXdOrPorBLUvlifXJJMGBOPWWva6SYJaySK	46486eb0-7c7b-40eb-b669-bb99ef2aa0ad	Active	2026-03-26 06:14:55.755277	t	postgres	2026-03-26 06:14:35.701383	postgres	2026-03-26 06:14:55.755277	dcghrm	HRM	\N	DCG	nis1220	1ca4f218-f3a5-4c64-b1a3-e67732dae62e
88d5c71a-b39d-4ac5-aaa2-b63f65ec3aca	bppreviewer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	d2673d91-2b10-4361-bc93-202943a92826	Active	2026-03-26 12:18:41.336641	t	postgres	2026-03-16 16:40:22.525114	postgres	2026-03-26 12:18:41.336641	bppreviewer	BPP	\N	Reviewer	NIS-00020	02e969cc-60ab-421f-beae-2687ad4e606b
f64a030f-c3e3-4402-a96b-c93717ec4fc7	audit@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	6424c007-c5e7-4ef9-8915-a2225634b8d9	Active	2026-03-26 12:19:23.010119	t	postgres	2026-02-28 04:34:36.405728	postgres	2026-03-26 12:19:23.010119	audit	Audit	\N	Officer	NIS-00004	5d07c278-8d5f-4e4d-84ec-a9ae49fe651b
366c5434-0f55-44e3-83a5-d9caf78dbc8f	tendersboardmember@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	46486eb0-7c7b-40eb-b669-bb99ef2aa0ad	Active	2026-03-10 18:09:44.748209	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-15 06:09:40.611791	tendersboardmember	Tenders	\N	Board Member	NIS-00011	02e969cc-60ab-421f-beae-2687ad4e606b
25a513bf-3638-49ec-8426-603238d19a35	contractmanager@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	2cfe6e05-4c73-4148-b0dd-9ba7792e0434	Active	2026-03-10 17:22:08.410368	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-15 06:09:40.611791	contractmanager	Contract	\N	Manager	NIS-00015	b171b5cf-11b6-433d-a3f0-137f15e3a8ba
8ba8eae1-9fa0-4e63-a713-9d5b4559ba1c	admin@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	3ab2a1a2-c1bc-4fbb-aaa3-e938a35f0f6a	Active	2026-03-26 12:57:00.092169	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-26 12:57:00.092169	admin	System	\N	Administrator	NIS-00001	bee67539-897e-4f52-bdf0-42411936e50f
d8641acd-0da7-465d-b097-276eb4715868	procurementmanager@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	01bbb628-cc8f-4f96-8bb1-4d115341712f	Active	2026-03-24 12:32:14.727926	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-24 12:32:14.727926	procurementmanager	Procurement	\N	Manager	NIS-00008	02e969cc-60ab-421f-beae-2687ad4e606b
c99f1b3c-8d50-4589-a4d5-72f2fb5b1444	complaintsreviewofficer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	c0dcb657-758f-4300-846b-6c8ee8ad47e5	Active	\N	t	postgres	2026-03-16 16:40:22.525114	postgres	2026-03-16 16:40:22.551694	complaintsreviewofficer	Complaints	\N	Review Officer	NIS-00021	92018fbf-5934-48ad-b391-ebc976563e29
24d45219-14d9-4e9d-871e-64460a1a8ddd	requisitioningofficer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	3f62f6a8-6039-4452-adfd-8447a5644750	Active	2026-03-24 16:52:22.413975	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-24 16:52:22.413975	requisitioningofficer	Requisitioning	\N	Officer	NIS-00006	b171b5cf-11b6-433d-a3f0-137f15e3a8ba
587de7e9-586a-4925-ac71-093a9ebc4c27	inspectionofficer@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	45806255-44a0-4c6e-aa92-aa6001f6a3ce	Active	2026-03-27 08:41:12.244814	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-27 08:41:12.244814	inspectionofficer	Inspection	\N	Officer	NIS-00016	b171b5cf-11b6-433d-a3f0-137f15e3a8ba
5aa2e66c-8c4f-48b1-832f-004d6bc06675	cgis@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	9522798c-cb83-4d8b-9a38-716a131be973	Active	2026-03-26 12:11:21.888612	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-26 12:11:21.888612	cgis	Immigration	\N	CGIS	NIS-00013	abfaf89d-1428-4288-a0f2-06d096cf7c8d
546d6a88-1e49-4004-98ec-4564e0594ad7	technicalevaluator@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	4511603e-fe76-4601-8bee-7c0419b7364a	Active	2026-03-26 06:34:16.344657	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-26 06:34:16.344657	technicalevaluator	Technical	\N	Evaluator	NIS-00009	bee67539-897e-4f52-bdf0-42411936e50f
3a3e8640-61f7-4eb1-be58-48b867257fcf	bppliaison@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	6b8d0025-9a04-4253-a731-48c9dc086580	Active	2026-03-26 11:43:55.30498	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-26 11:43:55.30498	bppliaison	BPP	\N	Liaison	NIS-00014	02e969cc-60ab-421f-beae-2687ad4e606b
12aff36f-70de-4b3a-acce-f53b80f00674	financialevaluator@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	5dcdd477-66b2-4a7a-8559-718131ae030d	Active	2026-03-26 12:19:04.256817	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-26 12:19:04.256817	financialevaluator	Financial	\N	Evaluator	NIS-00010	5e166c02-f80b-4c9b-93c9-db8c26e6f431
e23ba2c4-b3de-49ce-9d06-6e065914a739	tendersboardsecretary@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	5c9c0ffe-9211-4641-9327-bf7ed6d87c89	Active	2026-03-11 09:51:39.83885	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-15 06:09:40.611791	tendersboardsecretary	Tenders	\N	Board Secretary	NIS-00012	02e969cc-60ab-421f-beae-2687ad4e606b
3fa4a9b7-ef7b-4bf0-b068-6ffc546cd2c4	departmenthead@nis.gov.ng	$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK	7a142faf-53b4-473c-a586-f162896ffb51	Active	2026-03-24 17:02:45.262719	t	postgres	2026-02-28 04:35:40.74119	postgres	2026-03-24 17:02:45.262719	departmenthead	Department	\N	Head	NIS-00007	b171b5cf-11b6-433d-a3f0-137f15e3a8ba
\.


--
-- Data for Name: organizational_positions; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.organizational_positions (position_id, position_code, position_title, unit_id, reports_to_position_id, is_executive, is_board_eligible, is_active, created_by, created_at, updated_by, updated_at) FROM stdin;
a608cdf3-a549-4fe0-911e-50e891e084f9	CGIS	Comptroller General, Nigeria Immigration Service	abfaf89d-1428-4288-a0f2-06d096cf7c8d	\N	t	f	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
6e2c326d-5d02-46de-8f7e-a38f3bb34eef	DCG_HRM	Deputy Comptroller General, Human Resources Management	1ca4f218-f3a5-4c64-b1a3-e67732dae62e	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
6726fa3d-b082-4290-b3c6-0883defed212	DCG_FINACC	Deputy Comptroller General, Finance and Accounts	5e166c02-f80b-4c9b-93c9-db8c26e6f431	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
6157c52a-6915-4db1-a535-5943f819ac2b	DCG_PRS	Deputy Comptroller General, Planning, Research and Statistics	db23d28a-e45b-4dbc-8f37-9563a7c9ff93	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
10c5a48e-7f77-462f-8035-6b80fc47ceb0	DCG_PPTD	Deputy Comptroller General, Passport and Other Travel Documents	5f328446-d15f-4f2c-826b-9fd5b0b88d1f	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
78bbc196-3256-4b56-b067-a6b2f85e2dca	DCG_INVCOMP	Deputy Comptroller General, Investigation and Compliance	d4614078-ad16-4479-972e-db658da3d0f2	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
feb22d3d-a179-4f91-942d-687ed4122ba7	DCG_BORDER	Deputy Comptroller General, Border Management	b5bb2dc3-3918-4774-98bc-8efa740278f0	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
7fe7ce64-a8e9-4219-b98f-ba1b65b3fc70	DCG_MIGRATION	Deputy Comptroller General, Migration	6e712830-b112-4641-84b2-3cff586f70f3	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
cb050d24-10f6-4e7c-8e1f-aad52f4f6115	DCG_VISA	Deputy Comptroller General, Visa and Residency	5d361709-c762-436a-9802-e627a3206037	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
9113d8db-4721-447b-8671-9e1e26ef84ca	DCG_WORKLOG	Deputy Comptroller General, Works and Logistics	b171b5cf-11b6-433d-a3f0-137f15e3a8ba	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
fcf59a23-bd4b-41ea-9825-edb88553d870	DCG_ICTCYBER	Deputy Comptroller General, ICT and Cyber Security	bee67539-897e-4f52-bdf0-42411936e50f	a608cdf3-a549-4fe0-911e-50e891e084f9	t	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
e89d11aa-7376-499b-8e5e-f5ed05425b8d	TENDERS_BOARD_SECRETARY	Tenders Board Secretary	02e969cc-60ab-421f-beae-2687ad4e606b	a608cdf3-a549-4fe0-911e-50e891e084f9	f	f	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
\.


--
-- Data for Name: organizational_units; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.organizational_units (unit_id, unit_code, unit_name, unit_type, parent_unit_id, sort_order, is_assignable, is_active, created_by, created_at, updated_by, updated_at) FROM stdin;
abfaf89d-1428-4288-a0f2-06d096cf7c8d	CGNIS	Comptroller General, NIS	Executive	\N	10	f	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
67f28d40-cb26-4e32-9269-593455b9d3ef	DIRECTORATES	Directorates	Group	\N	20	f	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
22b941e4-a020-4325-84d8-6460ac250362	SPECIALIZED_UNITS	Specialized Units	Group	\N	30	f	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
1ca4f218-f3a5-4c64-b1a3-e67732dae62e	HRM	Human Resources Management	Directorate	\N	100	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
5e166c02-f80b-4c9b-93c9-db8c26e6f431	FINACC	Finance and Accounts	Directorate	\N	110	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
db23d28a-e45b-4dbc-8f37-9563a7c9ff93	PRS	Planning, Research and Statistics	Directorate	\N	120	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
5f328446-d15f-4f2c-826b-9fd5b0b88d1f	PPTD	Passport and Other Travel Documents	Directorate	\N	130	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
d4614078-ad16-4479-972e-db658da3d0f2	INVCOMP	Investigation and Compliance	Directorate	\N	140	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
b5bb2dc3-3918-4774-98bc-8efa740278f0	BORDER	Border Management	Directorate	\N	150	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
6e712830-b112-4641-84b2-3cff586f70f3	MIGRATION	Migration	Directorate	\N	160	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
5d361709-c762-436a-9802-e627a3206037	VISA	Visa and Residency	Directorate	\N	170	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
b171b5cf-11b6-433d-a3f0-137f15e3a8ba	WORKLOG	Works and Logistics	Directorate	\N	180	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
bee67539-897e-4f52-bdf0-42411936e50f	ICTCYBER	ICT and Cyber Security	Directorate	\N	190	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
02e969cc-60ab-421f-beae-2687ad4e606b	PROC	Procurement	SpecializedUnit	\N	200	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
a5435fba-fb79-4d78-bb52-2e34a1459737	LEGAL	Legal	SpecializedUnit	\N	210	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
5d07c278-8d5f-4e4d-84ec-a9ae49fe651b	INTAUD	Internal Audits	SpecializedUnit	\N	220	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
92018fbf-5934-48ad-b391-ebc976563e29	SERVICOM	SERVICOM	SpecializedUnit	\N	230	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
2e2b7815-7ae0-4de3-8480-f8cb710cd18e	INTSEC	Internal Security	SpecializedUnit	\N	240	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
6573fd51-4cca-4b59-8e32-cc0332189a22	PRESSPR	Press and Public Relations	SpecializedUnit	\N	250	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
65df3084-e4cc-4f92-8dd3-dd935f2fe0ae	ACT	Anti-Corruption and Transparency	SpecializedUnit	\N	260	t	t	postgres	2026-03-15 06:09:40.611791	postgres	2026-03-15 06:09:40.611791
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.roles (role_id, role_name, description, is_active, created_by, created_at, updated_by, updated_at) FROM stdin;
3ab2a1a2-c1bc-4fbb-aaa3-e938a35f0f6a	Admin	System administrator	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
3f62f6a8-6039-4452-adfd-8447a5644750	RequisitioningOfficer	Initiates and tracks requisitions	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
7a142faf-53b4-473c-a586-f162896ffb51	DepartmentHead	Approves departmental requisitions	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
76ef5064-2be0-4f64-93f4-b5a74d82de33	ProcurementManager	Oversees procurement operations and compliance	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
4511603e-fe76-4601-8bee-7c0419b7364a	TechnicalEvaluator	Performs technical evaluation only	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
5dcdd477-66b2-4a7a-8559-718131ae030d	FinancialEvaluator	Performs financial evaluation only	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
46486eb0-7c7b-40eb-b669-bb99ef2aa0ad	TendersBoardMember	Reviews evaluation outcomes and approves/rejects	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
5c9c0ffe-9211-4641-9327-bf7ed6d87c89	TendersBoardSecretary	Manages board records and submissions	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
6b8d0025-9a04-4253-a731-48c9dc086580	BPPLiaison	Manages BPP No-Objection submissions	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
2cfe6e05-4c73-4148-b0dd-9ba7792e0434	ContractManager	Manages awards and contract administration	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
45806255-44a0-4c6e-aa92-aa6001f6a3ce	InspectionOfficer	Records inspection and acceptance	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
52e3f3e4-e7dc-461a-97e0-af854da6785d	PaymentOfficer	Tracks payment status post-acceptance	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
6424c007-c5e7-4ef9-8915-a2225634b8d9	AuditOfficer	Read-only audit and compliance access	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
8b11985c-7fab-4737-b585-36ff22fa91c1	SystemAdministrator	User, role, and system configuration management	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
bd0353b9-3247-4695-af77-e59283ade0ef	PlanningStatisticsOfficer	Reviews procurement planning assumptions and annual plan coherence	t	postgres	2026-03-10 16:38:17.559092	postgres	2026-03-10 16:38:17.559092
636bc5ab-a728-4716-aea3-65de4049fc1f	FinancialUnitOfficer	Validates budget readiness and financial control requirements	t	postgres	2026-03-10 16:38:17.559092	postgres	2026-03-10 16:38:17.559092
ffb68e92-9051-4bd3-9a4e-1b89059ef209	LegalReviewer	Reviews legal compliance, bidding documents, and contract terms	t	postgres	2026-03-10 16:38:17.559092	postgres	2026-03-10 16:38:17.559092
d2673d91-2b10-4361-bc93-202943a92826	BPPReviewer	Reviews no-objection submissions and regulatory escalations	t	postgres	2026-03-10 16:38:17.559092	postgres	2026-03-10 16:38:17.559092
c0dcb657-758f-4300-846b-6c8ee8ad47e5	ComplaintsReviewOfficer	Handles administrative review and bidder complaints	t	postgres	2026-03-10 16:38:17.559092	postgres	2026-03-10 16:38:17.559092
01bbb628-cc8f-4f96-8bb1-4d115341712f	ProcurementSecretary	Planning committee secretary who records decisions and minutes	t	postgres	2026-03-20 11:07:50.314505	postgres	2026-03-20 11:07:50.314505
939a4029-4c49-4c6c-90da-4815a04bfdba	ComptrollerProcurement	Head of the procurement unit who chairs planning committee review, approves the APP, and leads procurement execution controls.	t	postgres	2026-03-20 11:07:50.314505	postgres	2026-03-20 11:07:50.314505
9522798c-cb83-4d8b-9a38-716a131be973	CGIS	Comptroller General of Immigration Service approval authority for direct CGIS approval and related executive decisions.	t	postgres	2026-02-28 04:31:58.556036	postgres	2026-02-28 04:31:58.556036
\.


--
-- Data for Name: user_login_security; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at) FROM stdin;
1eaed056-ada1-406c-9d31-4a76969b5a51	0	\N	2026-03-16 12:19:04.728917
587de7e9-586a-4925-ac71-093a9ebc4c27	0	\N	2026-03-27 08:41:12.244814
e23ba2c4-b3de-49ce-9d06-6e065914a739	0	\N	2026-03-14 15:58:29.415487
25a513bf-3638-49ec-8426-603238d19a35	0	\N	2026-03-14 15:58:29.415487
366c5434-0f55-44e3-83a5-d9caf78dbc8f	0	\N	2026-03-14 15:58:29.415487
908ad566-2182-4e7b-bed2-347031b0d819	0	\N	2026-03-24 07:47:29.40322
d320d7b8-a33a-4f2e-9299-bbf44cb31706	0	\N	2026-03-26 05:06:19.178404
3b4d42a7-3765-472c-94da-f64d1fcd713f	0	\N	2026-03-24 10:48:32.794663
b912fbf4-fa7c-4a65-ad0d-4869149f36a6	0	\N	2026-03-26 06:14:55.755277
546d6a88-1e49-4004-98ec-4564e0594ad7	0	\N	2026-03-26 06:34:16.344657
c6da80a3-d254-4121-9d2e-b8be8d328de2	0	\N	2026-03-18 19:39:24.371356
d8641acd-0da7-465d-b097-276eb4715868	0	\N	2026-03-24 12:32:14.727926
3a3e8640-61f7-4eb1-be58-48b867257fcf	0	\N	2026-03-26 11:43:55.30498
5aa2e66c-8c4f-48b1-832f-004d6bc06675	0	\N	2026-03-26 12:11:21.888612
88d5c71a-b39d-4ac5-aaa2-b63f65ec3aca	0	\N	2026-03-26 12:18:41.336641
24d45219-14d9-4e9d-871e-64460a1a8ddd	0	\N	2026-03-24 16:52:22.413975
3fa4a9b7-ef7b-4bf0-b068-6ffc546cd2c4	0	\N	2026-03-24 17:02:45.262719
12aff36f-70de-4b3a-acce-f53b80f00674	0	\N	2026-03-26 12:19:04.256817
1fdccd64-0a00-4218-88de-88b8889f64e4	0	\N	2026-03-24 17:16:17.109993
f64a030f-c3e3-4402-a96b-c93717ec4fc7	0	\N	2026-03-26 12:19:23.010119
8ba8eae1-9fa0-4e63-a713-9d5b4559ba1c	0	\N	2026-03-26 12:57:00.092169
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: identity; Owner: -
--

COPY identity.vendors (vendor_id, company_name, registration_number, tax_id, company_address, contact_person, email, password_hash, registration_date, last_login, vendor_status, is_active, created_by, created_at, updated_by, updated_at, phone_number) FROM stdin;
a4340ae7-8cd3-4dd4-aedc-030b1bdaee8c	test company	BN12232	10000000000	adrs	Paul	test@test.com	$2a$11$C7jTvdT6y.7KVqfAYGHfwegnAz07eRvXMwF.LGL7LdnA8CixRPM0.	2026-03-26 13:06:03.730807	2026-03-27 08:41:29.393265	Active	t	postgres	2026-03-26 13:06:03.730807	admin@nis.gov.ng	2026-03-27 08:41:29.393265	090384039409
\.


--
-- Data for Name: contract_awards; Type: TABLE DATA; Schema: post_award; Owner: -
--

COPY post_award.contract_awards (award_id, award_code, tender_title, vendor_name, award_value, status, award_date, contract_start, contract_end, funding_source, notes, published_at, created_by, created_at, updated_by, updated_at) FROM stdin;
1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02	AWD-2026-0021	HQ Network Refresh	NetCore Technologies	90000000.00	Approved	2026-02-05 00:00:00	2026-03-01 00:00:00	2026-09-01 00:00:00	Capital Budget FY2026	Ready for publication to vendor portal.	\N	seed	2026-03-03 16:07:07.12834	seed	2026-03-03 16:07:07.12834
0d5f8f38-5f67-4a6d-a7f1-3f6af401c201	AWD-2026-0012	Border Surveillance Sensor Maintenance	Orion Security Systems Ltd	340000000.00	Pending Approval	2026-02-16 00:00:00	2026-03-15 00:00:00	2027-03-14 00:00:00	Security Operations	Awaiting accounting officer approval and BPP filing.	\N	seed	2026-03-03 16:07:07.12834	seed	2026-03-03 16:07:07.12834
2b3c4d5e-6f70-4b8c-9d0e-1f2a3b4c5d03	AWD-2026-0027	Training Simulation Labs	SimuEdge Learning	47000000.00	Published	2026-01-24 00:00:00	2026-02-20 00:00:00	2026-08-20 00:00:00	Training Budget FY2026	Mobilization underway; delivery kickoff scheduled.	2026-02-16 16:07:07.12834	seed	2026-03-03 16:07:07.12834	seed	2026-03-03 16:07:07.12834
3c4d5e6f-7081-4c9d-a0e1-2f3a4b5c6d04	AWD-2026-0033	Vehicle Fleet Maintenance	AutoShield Services	42000000.00	Draft	2026-02-27 00:00:00	2026-04-01 00:00:00	2027-04-01 00:00:00	Transport & Logistics	Draft award notice pending internal review.	\N	seed	2026-03-03 16:07:07.12834	seed	2026-03-03 16:07:07.12834
\.


--
-- Data for Name: contract_milestones; Type: TABLE DATA; Schema: post_award; Owner: -
--

COPY post_award.contract_milestones (milestone_id, contract_code, milestone_title, status_after, progress_after, notes, contract_manager, recorded_by, recorded_at, created_at) FROM stdin;
cd7f028c-9f52-45c8-9233-56fa4add99bb	CON-2026-0112	Baseline contract record	On Hold	22	Hold placed pending revised cabling scope approval.	Chinedu Okafor	seed	2026-03-03 16:07:07.136347	2026-03-03 16:07:07.136347
dd75834c-986e-41bc-b1b8-e76e76c4905f	CON-2026-0104	Baseline contract record	Active	38	Phase 1 hardware delivery completed; software licensing in progress.	Amina Yusuf	seed	2026-03-03 16:07:07.136347	2026-03-03 16:07:07.136347
b19cb904-b6dc-4b9b-a1c1-26ec32cec392	CON-2026-0127	Baseline contract record	Active	12	Mobilization underway; preventive maintenance schedule agreed.	Ibrahim Musa	seed	2026-03-03 16:07:07.136347	2026-03-03 16:07:07.136347
c2f91b35-59ab-4811-8c2d-dad1f9ffa4c6	CON-2026-0120	Baseline contract record	Completed	100	All service milestones completed and accepted.	Grace Udo	seed	2026-03-03 16:07:07.136347	2026-03-03 16:07:07.136347
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: post_award; Owner: -
--

COPY post_award.contracts (contract_id, contract_code, tender_title, vendor_name, contract_value, status, start_date, end_date, progress, contract_manager, notes, created_by, created_at, updated_by, updated_at, is_paid, payment_recorded_at) FROM stdin;
5e6f7081-92a3-4e1f-b2c3-4d5e6f708f06	CON-2026-0112	HQ Network Refresh	NetCore Technologies	90000000.00	On Hold	2026-03-01 00:00:00	2026-09-01 00:00:00	22	Chinedu Okafor	Hold placed pending revised cabling scope approval.	seed	2026-03-03 16:07:07.136347	seed	2026-03-03 16:07:07.136347	f	\N
4d5e6f70-8192-4d0e-b1f2-3a4b5c6d7e05	CON-2026-0104	Training Simulation Labs	SimuEdge Learning	47000000.00	Active	2026-02-20 00:00:00	2026-08-20 00:00:00	38	Amina Yusuf	Phase 1 hardware delivery completed; software licensing in progress.	seed	2026-03-03 16:07:07.136347	seed	2026-03-03 16:07:07.136347	f	\N
708192a3-b4c5-4021-b4e5-6f708192a308	CON-2026-0127	Border Surveillance Sensor Maintenance	Orion Security Systems Ltd	340000000.00	Active	2026-03-15 00:00:00	2027-03-14 00:00:00	12	Ibrahim Musa	Mobilization underway; preventive maintenance schedule agreed.	seed	2026-03-03 16:07:07.136347	seed	2026-03-03 16:07:07.136347	f	\N
6f708192-a3b4-4f20-b3d4-5e6f70819207	CON-2026-0120	Vehicle Fleet Maintenance	AutoShield Services	42000000.00	Completed	2025-04-01 00:00:00	2026-04-01 00:00:00	100	Grace Udo	All service milestones completed and accepted.	seed	2026-03-03 16:07:07.136347	seed	2026-03-03 16:07:07.136347	f	\N
\.


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: post_award; Owner: -
--

COPY post_award.inspections (inspection_id, inspection_code, contract_code, tender_title, vendor_name, status, scheduled_date, completed_date, inspector_name, outcome, location, notes, created_by, created_at, updated_by, updated_at) FROM stdin;
9b2c3d4e-5f60-4b7c-8d9e-1f2a3b4c5d02	INSP-2026-0014	CON-2026-0112	HQ Network Refresh	NetCore Technologies	In Progress	2026-03-04 00:00:00	\N	Chidi Nwankwo	Pending	HQ ICT Core Room	Physical site walk-through and cabling checks ongoing.	seed	2026-03-03 16:18:59.290315	seed	2026-03-03 16:18:59.290315
0c3d4e5f-6071-4c8d-9e0f-2a3b4c5d6e03	INSP-2026-0019	CON-2026-0120	Vehicle Fleet Maintenance	AutoShield Services	Accepted	2026-02-18 00:00:00	2026-02-20 00:00:00	Amina Yusuf	Accepted	Operations Fleet Yard	Service completion verified; documentation archived.	seed	2026-03-03 16:18:59.290315	seed	2026-03-03 16:18:59.290315
1d4e5f60-7182-4d9e-0f1a-3b4c5d6e7f04	INSP-2026-0023	CON-2026-0127	Border Surveillance Sensor Maintenance	Orion Security Systems Ltd	Rejected	2026-03-01 00:00:00	2026-03-02 00:00:00	Musa Ibrahim	Rejected	North Sector Surveillance Site	Calibration report missing; re-inspection required.	seed	2026-03-03 16:18:59.290315	seed	2026-03-03 16:18:59.290315
8a1b2c3d-4e5f-4a6b-9c7d-0e1f2a3b4c01	INSP-2026-0009	CON-2026-0104	Training Simulation Labs	SimuEdge Learning	Scheduled	2026-03-10 00:00:00	\N	Ifeoma Okoro	Pending	Training Directorate - Lab 2	Initial inspection planned with IT and training leads.	seed	2026-03-03 16:18:59.290315	seed	2026-03-03 16:18:59.290315
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: post_award; Owner: -
--

COPY post_award.payments (payment_id, payment_reference, contract_code, amount, status, payment_date, recorded_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: approval_thresholds; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.approval_thresholds (threshold_id, procurement_type, min_amount, max_amount, approval_route, requires_board, requires_bpp, status, notes, created_by, created_at, updated_by, updated_at, approval_authority_code, approval_authority_label, requires_cgis_approval, governance_body_id) FROM stdin;
5e30beac-19a0-43f9-8dcb-1d6ab1915bfe	Goods	0.00	50000000.00	CGIS Direct Approval	f	f	Active	Low-value goods procurement routed for direct CGIS approval.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	CGIS_DIRECT_APPROVAL	CGIS Direct Approval	t	\N
571a9d0e-1836-4e9d-adaf-40af1867f63f	Goods	50000000.01	100000000.00	NIS Tenders Board Review	t	f	Active	Mid-value goods procurement routed to the NIS Tenders Board.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	NIS_TENDERS_BOARD	NIS Tenders Board (Chair: CGIS)	f	62cadd07-64e4-4abd-af3e-b112c6a972b0
75c17f44-f9f8-4fef-888a-8cd5c877351a	Works	0.00	50000000.00	CGIS Direct Approval	f	f	Active	Low-value works procurement routed for direct CGIS approval.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	CGIS_DIRECT_APPROVAL	CGIS Direct Approval	t	\N
906c191f-a02a-4891-9c68-9129b61d7205	Works	50000000.01	100000000.00	NIS Tenders Board Review	t	f	Active	Mid-value works procurement routed to the NIS Tenders Board.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	NIS_TENDERS_BOARD	NIS Tenders Board (Chair: CGIS)	f	62cadd07-64e4-4abd-af3e-b112c6a972b0
b3265f83-1ffe-4861-a201-10a6e30460b9	Works	100000000.01	\N	NIS Tenders Board + BPP No Objection	t	t	Active	High-value works procurement requires board review and BPP no-objection.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	BPP_PRIOR_REVIEW	NIS Tenders Board + BPP No Objection	f	62cadd07-64e4-4abd-af3e-b112c6a972b0
cc08e99b-b410-4f65-ba1f-a9aa2ef545ec	Services	0.00	50000000.00	CGIS Direct Approval	f	f	Active	Low-value services procurement routed for direct CGIS approval.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	CGIS_DIRECT_APPROVAL	CGIS Direct Approval	t	\N
bcded13c-bbe7-4296-bf7a-f61b9252af8d	Services	50000000.01	100000000.00	NIS Tenders Board Review	t	f	Active	Mid-value services procurement routed to the NIS Tenders Board.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	NIS_TENDERS_BOARD	NIS Tenders Board (Chair: CGIS)	f	62cadd07-64e4-4abd-af3e-b112c6a972b0
a7e9594a-5ce0-4b28-a4d7-71d7590be33e	Services	100000000.01	\N	NIS Tenders Board + BPP No Objection	t	t	Active	High-value services procurement requires board review and BPP no-objection.	postgres	2026-03-26 08:55:08.282277	postgres	2026-03-26 08:55:08.282277	BPP_PRIOR_REVIEW	NIS Tenders Board + BPP No Objection	f	62cadd07-64e4-4abd-af3e-b112c6a972b0
052d49ff-857c-4b41-87ed-e65c36644fbd	Goods	100000000.01	\N	NIS Tenders Board + BPP No Objection	t	t	Active	High-value procurement requires NIS Tenders Board endorsement chaired by CGIS before BPP no-objection.	postgres	2026-03-14 04:49:52.045021	postgres	2026-03-26 08:41:11.954184	BPP_PRIOR_REVIEW	NIS Tenders Board + BPP No Objection	f	62cadd07-64e4-4abd-af3e-b112c6a972b0
\.


--
-- Data for Name: bids; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.bids (bid_id, tender_id, vendor_id, financial_bid, technical_proposal, validity_period_days, submission_date, bid_status, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: bpp_no_objections; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.bpp_no_objections (no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: budget_appropriations; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.budget_appropriations (appropriation_id, fiscal_year, department, budget_code, amount, status, notes, created_by, created_at, updated_by, updated_at) FROM stdin;
0a2f97af-dc65-4176-9783-65c9010d576a	2026	ICT and Cyber Security	CAP-ICT-001	1000000000.00	Active	\N	postgres	2026-03-18 22:09:32.987446	postgres	2026-03-18 22:09:32.987446
06743cfe-c46d-4d1f-9926-cfe4be81d209	2026	Human Resources Management	CAP-2026-001	1000000000.00	Active	\N	postgres	2026-03-23 19:02:20.642007	postgres	2026-03-23 19:02:20.642007
975ee548-d853-4831-a861-1c72ee88322b	2026	Border Management	CAP-2026-001	500000000.00	Active	\N	postgres	2026-03-24 17:17:40.761176	postgres	2026-03-24 17:17:40.761176
\.


--
-- Data for Name: budget_commitments; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.budget_commitments (commitment_id, requisition_id, tender_id, fiscal_year, department, budget_code, amount, status, committed_at, created_by, created_at, updated_by, updated_at, appropriation_id) FROM stdin;
b36a5431-9ed0-43b9-bed0-b08883e06338	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	\N	2026	ICT and Cyber Security	CAP-ICT-001	400000.00	Reserved	2026-03-19 19:13:39.898707	postgres	2026-03-19 19:13:39.898707	postgres	2026-03-20 11:29:05.351625	0a2f97af-dc65-4176-9783-65c9010d576a
0d4b690d-139e-4919-b2ec-3f9a3ebcf923	3d2755a0-165f-4be6-b3f8-963ea8c2390d	\N	2026	ICT and Cyber Security	CAP-ICT-001	1000.00	Reserved	2026-03-20 06:28:52.771849	postgres	2026-03-20 06:28:52.771849	postgres	2026-03-20 11:29:51.49925	0a2f97af-dc65-4176-9783-65c9010d576a
9548894f-78bd-4d60-875b-f448b00f4020	\N	\N	2026	ICT and Cyber Security	CAP-ICT-001	10000.00	Cancelled	2026-03-20 06:28:58.24491	postgres	2026-03-20 06:28:58.24491	postgres	2026-03-23 18:40:33.366418	0a2f97af-dc65-4176-9783-65c9010d576a
9627db9e-aa83-48cf-bda0-62af0f5cd7fb	c0af86ac-b94f-4a11-bfa2-278a86ab3158	\N	2026	Border Management	CAP-2026-001	10000.00	Reserved	2026-03-24 17:18:07.564902	postgres	2026-03-24 17:18:07.564902	postgres	2026-03-24 17:26:27.301462	975ee548-d853-4831-a861-1c72ee88322b
95f10907-795e-4e25-8120-fc37717e8fb1	\N	a10dbfa7-41f1-4754-930c-1d98d0932c70	2026	ICT and Cyber Security	CAP-ICT-001	1000.00	Reserved	2026-03-25 17:00:36.81967	postgres	2026-03-25 17:00:36.81967	postgres	2026-03-25 17:00:36.81967	\N
73ec7530-6a37-4ce9-a96f-b4a1e2b1f8e8	\N	cb828ae4-7598-4043-b67a-5dab858e84a0	2026	ICT and Cyber Security	CAP-ICT-001	1000.00	Reserved	2026-03-25 17:54:49.898965	postgres	2026-03-25 17:54:49.898965	postgres	2026-03-25 17:54:49.898965	\N
\.


--
-- Data for Name: budget_expenditures; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.budget_expenditures (expenditure_id, commitment_id, amount, spent_at, notes, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: budget_lines; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.budget_lines (budget_code, department, funding_source, allocated_amount, is_active) FROM stdin;
BUD-ICT-CAPEX-2026-04	ICT Directorate	Capital Expenditure	35000000.00	t
BUD-LOG-REC-2026-11	Logistics and Supply Chain	Recurrent	18000000.00	t
CAP-ICT-001	ICT and Cyber Security	Budget	0.00	t
\.


--
-- Data for Name: budget_releases; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.budget_releases (release_id, appropriation_id, amount, release_date, notes, created_by, created_at, updated_by, updated_at) FROM stdin;
00b08ed6-abe9-4e83-a363-60f0042bc862	0a2f97af-dc65-4176-9783-65c9010d576a	1000000.00	2026-03-18 00:00:00	\N	postgres	2026-03-18 22:37:44.608541	postgres	2026-03-18 22:37:44.608541
edf2df5d-4622-4d2a-9ca5-5d03d8c57a5d	0a2f97af-dc65-4176-9783-65c9010d576a	8000000.00	2026-03-19 00:00:00	\N	postgres	2026-03-18 23:36:04.015422	postgres	2026-03-18 23:36:04.015422
f9e96d91-2a8e-494b-aa2f-8194d3bf21cb	0a2f97af-dc65-4176-9783-65c9010d576a	10000000.00	2026-03-19 00:00:00	\N	postgres	2026-03-19 06:24:34.749672	postgres	2026-03-19 06:24:34.749672
2af2fb2b-8f56-4231-b669-bb9402635527	06743cfe-c46d-4d1f-9926-cfe4be81d209	1000000000.00	2026-03-23 00:00:00	\N	postgres	2026-03-23 19:08:05.833385	postgres	2026-03-23 19:08:05.833385
\.


--
-- Data for Name: evaluation_actions; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.evaluation_actions (action_id, action_type, report_code, tender_id, notes, reason, justification, recommendation, threshold_note, requested_by, created_at) FROM stdin;
01ea141d-2037-47f7-aa27-04d7c7e57fbc	StartEvaluation	EVR-2026-0051	0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06				Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:26:39.429101
b3439c50-a683-4d66-914f-94b21478361a	RequestClarification	EVR-2026-0051	0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06	Add more document			Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:27:15.511031
4d998346-bff6-4fd6-8dac-36ab07b014ad	RecordNonCompliance	EVR-2026-0051	0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06	Add more document	non compliant		Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:27:37.025149
ee876b82-a0fc-4725-bd35-4649a80815e7	RecordNonCompliance	EVR-2026-0051	0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06	Add more document	non compliant		Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:27:45.210133
8740191b-de8b-499d-a433-c4f224878b27	RecordNonCompliance	EVR-2026-0051	0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06	Add more document	non compliant		Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:27:50.649875
1bd9b61d-4a9d-4703-8d5a-e22c67b56359	RequestClarification	EVR-2026-0042	4e5c2a1f-8b5f-4c3a-9c2f-1a2b3c4d5e01	Add more document	non compliant		Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:27:57.528246
bb0ea322-1c96-43bf-878b-3fdb3ec9b7ba	RequestClarification	EVR-2026-0051	0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06	Add more document	non compliant		Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:28:05.058355
eb559763-d510-4c0b-866e-b2d97a299c16	RecommendReTender	EVR-2026-0048	7a6b5c4d-3e2f-4a1b-8c7d-6e5f4a3b2c03	Add more document	non compliant	add	ConditionallyQualified		financialevaluator@nis.gov.ng	2026-03-18 11:28:38.934832
c00863b7-5f63-4d93-ac99-8609d6da63cf	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10	Add more document	non compliant	add	ConditionallyQualified		financialevaluator@nis.gov.ng	2026-03-18 11:28:46.925037
58d8d583-a5d8-4da2-88b4-90fd408df433	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10				Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:29:03.581507
9b27828d-5109-454c-ad58-e22cd0fdef22	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10				Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:29:19.930081
97f74e86-ab82-467b-9f7e-3d07a756a1b8	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10				Qualified		financialevaluator@nis.gov.ng	2026-03-18 11:29:28.229777
78c60fff-8706-4444-a9de-10f93f063f4f	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10				Qualified		technicalevaluator@nis.gov.ng	2026-03-18 11:32:06.36455
b06b6a28-3498-4c5d-b806-be6992278c4c	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10				Qualified		technicalevaluator@nis.gov.ng	2026-03-18 11:32:12.237814
b4470ac4-3c90-4e3c-a301-6eb0d8fee4bc	StartEvaluation	EVR-2026-0054	4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10				Qualified		technicalevaluator@nis.gov.ng	2026-03-18 11:32:24.039483
\.


--
-- Data for Name: evaluation_reports; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.evaluation_reports (report_id, report_code, tender_id, tender_title, committee_lead, recommendation, score_summary, status, submitted_at, notes, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: governance_bodies; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.governance_bodies (body_id, body_code, body_name, body_type, description, is_active, created_by, created_at, updated_by, updated_at) FROM stdin;
62cadd07-64e4-4abd-af3e-b112c6a972b0	NIS_TENDERS_BOARD	NIS Tenders Board	TendersBoard	NIS Tenders Board chaired by CGIS, with the Procurement unit serving board secretariat support.	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
\.


--
-- Data for Name: governance_body_memberships; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.governance_body_memberships (membership_id, body_id, position_id, membership_role, voting_order, is_voting_member, is_active, created_by, created_at, updated_by, updated_at) FROM stdin;
680a15da-ae4f-4ffb-9ba5-785801f38640	62cadd07-64e4-4abd-af3e-b112c6a972b0	6e2c326d-5d02-46de-8f7e-a38f3bb34eef	Member	10	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
fd75f640-073b-4ed2-bb7a-bd1a68244f94	62cadd07-64e4-4abd-af3e-b112c6a972b0	6726fa3d-b082-4290-b3c6-0883defed212	Member	20	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
22c5d00d-fcff-4ace-88eb-17ac87e6361a	62cadd07-64e4-4abd-af3e-b112c6a972b0	6157c52a-6915-4db1-a535-5943f819ac2b	Member	30	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
f6ee3147-41a7-4860-bd8c-331f0f1dd499	62cadd07-64e4-4abd-af3e-b112c6a972b0	10c5a48e-7f77-462f-8035-6b80fc47ceb0	Member	40	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
2a7b2aee-94e6-4d7c-bbf8-dd5703ff1d13	62cadd07-64e4-4abd-af3e-b112c6a972b0	78bbc196-3256-4b56-b067-a6b2f85e2dca	Member	50	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
8751ef03-e86d-4730-86f2-b14e0511568f	62cadd07-64e4-4abd-af3e-b112c6a972b0	feb22d3d-a179-4f91-942d-687ed4122ba7	Member	60	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
0457b628-6b2e-4936-a056-db7df32e0d71	62cadd07-64e4-4abd-af3e-b112c6a972b0	7fe7ce64-a8e9-4219-b98f-ba1b65b3fc70	Member	70	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
dee613a6-5089-407e-a71f-efcef13c64f0	62cadd07-64e4-4abd-af3e-b112c6a972b0	cb050d24-10f6-4e7c-8e1f-aad52f4f6115	Member	80	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
e2c40c76-cdd4-4817-b82b-ffc1681b1af0	62cadd07-64e4-4abd-af3e-b112c6a972b0	9113d8db-4721-447b-8671-9e1e26ef84ca	Member	90	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
0f45278e-0d17-4d46-bf07-4e102374c825	62cadd07-64e4-4abd-af3e-b112c6a972b0	fcf59a23-bd4b-41ea-9825-edb88553d870	Member	100	t	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
53a0c247-296b-4ec6-87ac-c96327cc49d3	62cadd07-64e4-4abd-af3e-b112c6a972b0	e89d11aa-7376-499b-8e5e-f5ed05425b8d	Secretary	999	f	t	postgres	2026-03-15 07:12:40.954569	postgres	2026-03-16 16:47:06.339019
\.


--
-- Data for Name: internal_requisitions; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.internal_requisitions (requisition_id, title, department, procurement_category, app_reference, budget_code, estimated_cost, justification, scope_summary, urgency, required_by, procurement_method, bpp_no_objection_required, status, created_by, submitted_at) FROM stdin;
\.


--
-- Data for Name: planning_committee_configuration; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.planning_committee_configuration (committee_code, chairman_internal_user_id, assigned_by, assigned_at, updated_at) FROM stdin;
planning_committee	d320d7b8-a33a-4f2e-9299-bbf44cb31706	admin@nis.gov.ng	2026-03-26 06:03:45.399598	2026-03-26 06:03:45.399598
\.


--
-- Data for Name: planning_committee_decisions; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.planning_committee_decisions (decision_id, plan_id, chairman_user_id, secretary_user_id, overall_decision, committee_remarks, meeting_date, created_at, updated_at, requisition_id) FROM stdin;
f12378ad-b96a-4621-9ec2-99d1df250a58	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement@nis.gov.ng	procurement@nis.gov.ng	Recommended	Recommended for APP Approvsl	2026-03-24	2026-03-21 20:53:24.240486	2026-03-24 10:54:07.69863	3d2755a0-165f-4be6-b3f8-963ea8c2390d
ab9e7562-0191-441d-b281-4a2a5d198a5f	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement@nis.gov.ng	procurement@nis.gov.ng	Recommended	Committee aprroved	2026-03-24	2026-03-21 21:30:27.214778	2026-03-24 12:00:17.670783	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee
\.


--
-- Data for Name: planning_committee_member_reviews; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.planning_committee_member_reviews (review_id, plan_id, reviewer_role, reviewer_user_id, decision, remarks, created_at, updated_at, requisition_id, review_round) FROM stdin;
5bde63b5-68b4-408b-88dc-8d0f9db529d5	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_secretary	procurementmanager@nis.gov.ng	Cleared	Justified	2026-03-24 10:53:15.023107	2026-03-24 10:53:15.023107	3d2755a0-165f-4be6-b3f8-963ea8c2390d	2
91d43396-ec68-435b-ae9c-ae4a85bf3f49	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	department_head	departmenthead@nis.gov.ng	Cleared	aprrove	2026-03-20 15:04:24.121496	2026-03-20 15:04:24.121496	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
7785ce2f-310d-44f7-860d-b0852894a64a	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	department_head	departmenthead@nis.gov.ng	Cleared	Approve	2026-03-20 15:13:40.441417	2026-03-20 15:13:40.441417	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	1
619fe878-1c56-42ad-bed2-97cd8350a9dc	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	planning_statistics_officer	planningstatisticsofficer@nis.gov.ng	Cleared	Approve	2026-03-21 05:16:18.518243	2026-03-21 05:16:18.518243	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
2be41992-bb5d-4f3c-a8be-6837237d18aa	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	legal_reviewer	legalreviewer@nis.gov.ng	Cleared	No legal rejection	2026-03-21 05:29:39.499381	2026-03-21 05:29:39.499381	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
c82e3ce0-719b-4088-a299-dbeb661037fe	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer	financialunitofficer@nis.gov.ng	Cleared	Approved	2026-03-21 14:07:19.142524	2026-03-21 14:07:19.142524	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
230947a4-80ff-468e-8a3e-d1f667ada143	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_manager	procurementmanager@nis.gov.ng	Cleared	Approve	2026-03-21 14:08:43.606876	2026-03-21 14:08:43.606876	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
9b9d20e6-7fb8-4921-bbbd-f95b92e88233	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_secretary	procurementmanager@nis.gov.ng	Cleared	Approve	2026-03-21 15:43:57.668016	2026-03-21 15:43:57.668016	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
0ecb6e91-e225-41f4-881a-fe5afc44ab80	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_secretary	procurementmanager@nis.gov.ng	Cleared	Approved	2026-03-21 15:44:54.189366	2026-03-21 15:44:54.189366	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	1
c4f03f1d-8221-4bb0-8ec0-76f39629bccb	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer	financialunitofficer@nis.gov.ng	Cleared	Approve	2026-03-21 21:28:08.399681	2026-03-21 21:28:08.399681	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	1
4cd3e1c1-4332-49b9-bfb2-6680643cb9bb	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	planning_statistics_officer	planningstatisticsofficer@nis.gov.ng	Cleared	Approve	2026-03-21 21:28:53.576623	2026-03-21 21:28:53.576623	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	1
8fcd7a47-9f5f-4dc6-9bdc-ffee4d7d6336	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	legal_reviewer	legalreviewer@nis.gov.ng	Cleared	Approve	2026-03-21 21:29:27.979112	2026-03-21 21:29:27.979112	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	1
c032186f-cd76-4e28-a004-ac01a984281b	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer		Cleared	Recommend for Approval	2026-03-24 06:20:56.986376	2026-03-24 06:20:56.986376	3d2755a0-165f-4be6-b3f8-963ea8c2390d	1
96c68d50-4c7b-47c7-9e1b-80478a768fa5	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_secretary	procurementmanager@nis.gov.ng	Cleared	Recommended	2026-03-24 10:53:33.170148	2026-03-24 10:53:33.170148	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	2
f349ab86-5a5b-4231-8b23-9ea208c744c6	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer		Cleared	recommed	2026-03-24 06:36:08.7659	2026-03-24 06:37:24.401257	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	1
a743c71a-90d4-4a40-933e-144a43dcb304	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	legal_reviewer	legalreviewer@nis.gov.ng	Cleared	Recommended for aprroval	2026-03-24 07:48:02.59345	2026-03-24 07:48:02.59345	3d2755a0-165f-4be6-b3f8-963ea8c2390d	2
90ba89ca-2bb5-4664-a384-c27b7b0890e6	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	legal_reviewer	legalreviewer@nis.gov.ng	Cleared	Recommended	2026-03-24 07:48:31.766407	2026-03-24 07:48:31.766407	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	2
fcd8601f-505b-4a7b-94ba-82e6fb682d71	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	planning_statistics_officer	planningstatisticsofficer@nis.gov.ng	Cleared	Approved	2026-03-24 07:53:32.528776	2026-03-24 07:53:32.528776	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	2
018a7990-56db-49bd-9bed-c4bf4f6db8a5	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	planning_statistics_officer	planningstatisticsofficer@nis.gov.ng	Cleared	recommend	2026-03-24 07:53:56.480562	2026-03-24 07:53:56.480562	3d2755a0-165f-4be6-b3f8-963ea8c2390d	2
4cb22a52-26f5-4300-93ea-bc267ac7a47a	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer	financialunitofficer@nis.gov.ng	Cleared	Requisition is justified	2026-03-24 10:50:41.505237	2026-03-24 10:50:41.505237	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	2
9261a2ae-9fe1-4421-8dc6-67e2ac82ef82	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer	financialunitofficer@nis.gov.ng	Queried	Justification not enough	2026-03-24 10:51:47.192	2026-03-24 10:51:47.192	3d2755a0-165f-4be6-b3f8-963ea8c2390d	2
6b926038-2c30-4f63-9598-1b0da1bc0a19	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	department_head	departmenthead@nis.gov.ng	Cleared	Approve	2026-03-24 10:52:33.479297	2026-03-24 10:52:33.479297	3d2755a0-165f-4be6-b3f8-963ea8c2390d	2
70d48600-538e-4f2b-82e2-522be4c81ef6	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	department_head	departmenthead@nis.gov.ng	Cleared	Justified	2026-03-24 10:52:51.403888	2026-03-24 10:52:51.403888	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	2
\.


--
-- Data for Name: planning_committee_member_status; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.planning_committee_member_status (status_id, plan_id, role_key, status_label, decision, updated_by, updated_at, requisition_id) FROM stdin;
17a29b7c-fe47-48b4-aace-44e3a5f1f344	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	legal_reviewer	Legal Reviewed	Cleared	legalreviewer@nis.gov.ng	2026-03-24 07:48:02.59345	3d2755a0-165f-4be6-b3f8-963ea8c2390d
818f90b4-c84a-4d83-8429-4997d84c7d3d	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	legal_reviewer	Legal Reviewed	Cleared	legalreviewer@nis.gov.ng	2026-03-24 07:48:31.766407	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee
069b95ed-be36-485f-973e-8db6c367e5d0	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	planning_statistics_officer	PSO Reviewed	Cleared	planningstatisticsofficer@nis.gov.ng	2026-03-24 07:53:32.528776	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee
0d1c9d58-77ca-4bd0-8fe8-4f49a0b064d6	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	planning_statistics_officer	PSO Reviewed	Cleared	planningstatisticsofficer@nis.gov.ng	2026-03-24 07:53:56.480562	3d2755a0-165f-4be6-b3f8-963ea8c2390d
9c7b72d0-a34b-47dc-b180-5f79fa17292f	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer	Finance Reviewed	Cleared	financialunitofficer@nis.gov.ng	2026-03-24 10:50:41.505237	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee
ca614a30-2bb7-4fe6-930c-69ba0e8dff1c	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	financial_unit_officer	Finance Reviewed	Queried	financialunitofficer@nis.gov.ng	2026-03-24 10:51:47.192	3d2755a0-165f-4be6-b3f8-963ea8c2390d
72461f4c-dc43-4f58-9cb3-170d54e9587a	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	department_head	Technical Reviewed	Cleared	departmenthead@nis.gov.ng	2026-03-24 10:52:33.479297	3d2755a0-165f-4be6-b3f8-963ea8c2390d
7b10e58a-79fd-4263-983d-69df1b279d6c	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	department_head	Technical Reviewed	Cleared	departmenthead@nis.gov.ng	2026-03-24 10:52:51.403888	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee
1795cd4c-5273-486d-a2dc-00704b347a75	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_secretary	Secretary Recorded	Cleared	procurementmanager@nis.gov.ng	2026-03-24 10:53:15.023107	3d2755a0-165f-4be6-b3f8-963ea8c2390d
6f1023b9-d4fc-4395-bdc1-242080943469	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	procurement_secretary	Secretary Recorded	Cleared	procurementmanager@nis.gov.ng	2026-03-24 10:53:33.170148	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee
\.


--
-- Data for Name: planning_committee_plan_links; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.planning_committee_plan_links (requisition_id, plan_id, linked_by, linked_at) FROM stdin;
3d2755a0-165f-4be6-b3f8-963ea8c2390d	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	system_data_fix	2026-03-24 11:46:10.102799
c0af86ac-b94f-4a11-bfa2-278a86ab3158	fad0d2f9-690d-4f38-acd3-f4d8774b67e9	procurement@nis.gov.ng	2026-03-24 18:59:02.120951
\.


--
-- Data for Name: procurement_closeouts; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.procurement_closeouts (closeout_id, closeout_reference, entity_type, entity_id, status, record_title, summary, archive_location, final_acceptance_completed, final_payment_completed, archived_by, archived_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: procurement_complaints; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.procurement_complaints (complaint_id, complaint_reference, entity_type, entity_id, stage_key_at_filing, status, subject, summary, details, complaint_channel, requested_remedy, filed_by, assigned_to, reviewed_by, resolution_outcome, resolution_stage_key, resolution_notes, filed_at, reviewed_at, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: procurement_plan_cycles; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.procurement_plan_cycles (plan_cycle_id, fiscal_year, cycle_code, title, department, status, created_by, created_at, submitted_at, approved_by, approved_at, rejection_reason) FROM stdin;
8ad1c925-c82e-4a12-b122-97ed1e490f71	2026	NIS-APP-2026	NIS Annual Procurement Plan 2026	Procurement Unit	Approved	procurement.officer@nis.gov.ng	2026-01-20 09:58:07.738286	2026-01-22 09:58:07.738286	accounting.officer@nis.gov.ng	2026-01-26 09:58:07.738286	\N
93c84ec1-a2f5-4862-a1f0-7dd296c51cdd	2026	fe3e0ec9077e495a	ICT and Cyber Security Procurement Plan	ICT and Cyber Security	Draft	postgres	2026-03-20 06:17:14.492052	\N	\N	\N	\N
\.


--
-- Data for Name: procurement_plan_items; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.procurement_plan_items (plan_item_id, plan_cycle_id, fiscal_year, app_code, title, department, procurement_category, budget_code, funding_source, estimated_cost, procurement_method, bpp_no_objection_required, budget_verified, budget_verified_by, budget_verified_at, status, created_by, created_at, plan_id, item_code, description, procurement_type, estimated_amount, notes, updated_by, updated_at) FROM stdin;
1e28c68f-7390-402b-9cce-db2aeb14eb66	93c84ec1-a2f5-4862-a1f0-7dd296c51cdd	2026	APP-4774046e3dca4bd3	Network Connectivity	ICT and Cyber Security	Services	CAP-ICT-001	Budget	1000.00	Open Competitive Bidding	f	f	\N	\N	Active	postgres	2026-03-20 11:29:51.454773	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	\N	Network Connectivity	Services	1000.00	Created from requisition approval.	postgres	2026-03-20 11:29:51.454773
025139d5-eb31-4bea-bfaa-b96fc38b6984	93c84ec1-a2f5-4862-a1f0-7dd296c51cdd	2026	APP-ed81467ec9154774	MIDAS Installation	ICT and Cyber Security	Goods	CAP-ICT-001	Budget	400000.00	Open Competitive Bidding	f	f	\N	\N	Active	postgres	2026-03-21 21:30:27.214778	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	\N	MIDAS Installation	Goods	400000.00	Created after finalized planning committee review.	postgres	2026-03-21 21:30:27.214778
\.


--
-- Data for Name: procurement_plans; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.procurement_plans (plan_id, plan_title, department, fiscal_year, status, total_budget, notes, submitted_at, approved_at, created_by, created_at, updated_by, updated_at, yearly_app_id, review_round) FROM stdin;
fad0d2f9-690d-4f38-acd3-f4d8774b67e9	Border Management Procurement Plan	Border Management	2026	Under Review	10000.00	Created by planning committee workspace.	\N	\N	postgres	2026-03-24 18:59:02.120951	postgres	2026-03-24 18:59:02.120951	4f23c3eb-febe-455c-9959-6a14d292b2d5	1
ca3ac856-1a11-4707-b4ff-148e03bfdf1e	ICT and Cyber Security Procurement Plan	ICT and Cyber Security	2026	Approved	401000.00	[2026-03-24 04:38:23 UTC] APP approval return: No note supplied. (actor: procurement@nis.gov.ng)\n\n[2026-03-24 11:51:39 UTC] APP recommended by Procurement Secretary for Comptroller Procurement approval. (actor: procurementmanager@nis.gov.ng)\r\nRecommendation Note: Its has been review by the committee and it recommend for 2026 App procurement plan\n\n[2026-03-24 12:01:20 UTC] APP approval approve: No note supplied. (actor: procurement@nis.gov.ng)\n\n[2026-03-24 12:41:27 UTC] APP approval approve: No note supplied. (actor: procurement@nis.gov.ng)\n\n[2026-03-24 13:04:57 UTC] APP approval approve: No note supplied. (actor: procurement@nis.gov.ng)	2026-03-24 11:51:39.816722	2026-03-24 13:04:57.358155	postgres	2026-03-20 11:54:12.186843	postgres	2026-03-24 14:04:57.350818	4f23c3eb-febe-455c-9959-6a14d292b2d5	2
\.


--
-- Data for Name: requisition_app_unlinks; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.requisition_app_unlinks (unlink_id, requisition_id, previous_app_item_id, reason, unlinked_by, created_at) FROM stdin;
\.


--
-- Data for Name: requisition_approval_tasks; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.requisition_approval_tasks (approval_task_id, requisition_id, sequence, stage_name, required_role, status, decision, decision_comment, actioned_by, actioned_at, due_at, created_at) FROM stdin;
\.


--
-- Data for Name: requisition_audit_events; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.requisition_audit_events (id, requisition_id, event_type, actor_email, detail, occurred_at) FROM stdin;
\.


--
-- Data for Name: requisition_line_items; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.requisition_line_items (line_item_id, requisition_id, item_code, description, unit, quantity, unit_cost, created_at, updated_at) FROM stdin;
1e80a3f3-25ae-4b6f-9c7e-5b2d9f3eeaea	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	\N	Lenovo Thinkpad X1 Laptop	2	2.00	200000.00	2026-03-19 19:12:45.827441	2026-03-19 19:12:45.827441
d49b4117-e4be-4696-8ec4-529c06547eda	3d2755a0-165f-4be6-b3f8-963ea8c2390d	\N	5G Broadband	1	1.00	1000.00	2026-03-19 21:46:06.229283	2026-03-19 21:46:06.229283
fc563c29-acad-4568-b171-e7a3f1b17734	c0af86ac-b94f-4a11-bfa2-278a86ab3158	\N	Boot Devices	1	10.00	1000.00	2026-03-24 17:00:59.455954	2026-03-24 17:00:59.455954
\.


--
-- Data for Name: requisitions; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.requisitions (requisition_id, title, department, status, priority, procurement_type, funding_source, budget_code, project_code, required_by, delivery_location, justification, risk_notes, total_estimate, current_stage, created_by, created_at, updated_by, updated_at, app_item_id, unit_id) FROM stdin;
3d2755a0-165f-4be6-b3f8-963ea8c2390d	Network Connectivity	ICT and Cyber Security	Approved	Normal	Services	Capital Budget	CAP-ICT-001	\N	2026-03-16 00:00:00	SHQ Abuja	\N	[Department Head Review | 2026-03-19T21:00:45.766Z | departmenthead@nis.gov.ng] Approve	1000.00	planning_committee_review	postgres	2026-03-19 21:36:39.052358	postgres	2026-03-24 10:54:07.69863	1e28c68f-7390-402b-9cce-db2aeb14eb66	bee67539-897e-4f52-bdf0-42411936e50f
4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	MIDAS Installation	ICT and Cyber Security	Approved	Normal	Goods	Capital Budget	CAP-ICT-001	\N	2026-03-19 00:00:00	SHQ Abuja	\N	[Department Head Review | 2026-03-19T18:15:00.122Z | departmenthead@nis.gov.ng] Approve\n\n[Department Head Review | 2026-03-19T19:45:00.017Z | departmenthead@nis.gov.ng] Department head confirmed the requisition is ready for downstream processing.\n\n[Department Head Review | 2026-03-19T19:45:10.640Z | departmenthead@nis.gov.ng] Approve	400000.00	planning_committee_review	postgres	2026-03-19 19:12:45.827441	postgres	2026-03-24 12:00:17.670783	025139d5-eb31-4bea-bfaa-b96fc38b6984	bee67539-897e-4f52-bdf0-42411936e50f
c0af86ac-b94f-4a11-bfa2-278a86ab3158	Border Boot	Border Management	Under Review	Normal	Goods	Capital Budget	CAP-2026-001	\N	2026-03-24 00:00:00	SHQ	god	[Department Head Review | 2026-03-24T16:03:26.763Z | departmenthead@nis.gov.ng] This items are in dare need, please	10000.00	planning_committee_review	postgres	2026-03-24 17:00:59.455954	postgres	2026-03-24 17:26:27.301462	\N	b5bb2dc3-3918-4774-98bc-8efa740278f0
\.


--
-- Data for Name: tender_board_decisions; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.tender_board_decisions (decision_id, tender_id, decision, comment, recommended_bid_id, recommended_vendor_id, decided_by, decided_role, decided_at) FROM stdin;
\.


--
-- Data for Name: tender_documents; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.tender_documents (document_id, tender_id, name, content_type, content, created_at) FROM stdin;
\.


--
-- Data for Name: tender_evaluation_assignments; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.tender_evaluation_assignments (tender_id, assignment_role, internal_user_id, assigned_by, assigned_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tender_evaluation_financial_scores; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.tender_evaluation_financial_scores (score_id, tender_id, bid_id, evaluator_email, score, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tender_evaluation_technical_scores; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.tender_evaluation_technical_scores (score_id, tender_id, bid_id, evaluator_email, score, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tenders; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.tenders (tender_id, title, description, procurement_category, status, submission_deadline, opening_date, closing_date, budget, specifications, eligibility_criteria, evaluation_criteria, created_by, created_at, updated_by, updated_at, published_at, advertisement_channel, published_by, awarded_bid_id, awarded_vendor_id, awarded_by, awarded_at, award_decision_note, procurement_method) FROM stdin;
\.


--
-- Data for Name: workflow_instance_history; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.workflow_instance_history (history_id, instance_id, from_stage_key, to_stage_key, stage_status, transition_source, transition_reason, actor, created_at) FROM stdin;
1c80ffec-39a2-49cb-9e2a-4770722f8ad2	f170d07c-8411-4c9d-9302-a4581d297f1f	app_approval	comptroller_procurement_review	Returned	app_approval_decision	[2026-03-24 04:38:23 UTC] APP approval return: No note supplied. (actor: procurement@nis.gov.ng)	procurement@nis.gov.ng	2026-03-24 05:38:23.440089
f47a2b7e-f78b-48b7-b196-98f3da242cbf	ee353305-72d9-4d9b-b548-7029b7a7fa0e	\N	planning_committee_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-19 21:15:31.772755
b9cc4d34-07af-4b78-922b-4c552f79d945	372cc4dd-bfb4-4f2c-8a06-8f1bdcc275e3	\N	department_need_capture	Draft	controller_sync	Requisition created.	\N	2026-03-19 21:36:39.052358
6076c99d-6e74-4ca9-878e-961d134a84ba	372cc4dd-bfb4-4f2c-8a06-8f1bdcc275e3	department_need_capture	department_head_endorsement	Endorsed	controller_sync	Requisition updated.	\N	2026-03-19 22:00:45.806006
250f9c05-2d98-4bb0-8bf2-929cce7bd6bf	30362961-2bf7-491b-b02e-d77f5e0e8e15	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:05:01.537951
25f97d63-eb59-4c92-a138-df012a73b819	c267b5ba-3d7f-483c-b35e-804c7d22610c	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:10:34.198308
f12f485d-5ae5-4684-8be3-f6e8486a7bdd	c039f4b7-1a00-447b-b902-1c94809c8538	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:11:28.507975
914ff48b-a7cc-4762-ad1a-7ee903b40334	87d38558-0873-476d-8da3-f64c861ece83	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:15:31.046806
1cdad33c-624a-448e-9f05-917e7294b86e	a310953a-da3c-4e9e-bd3c-49ee49384f79	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:17:14.436382
57953fa0-9c38-40cf-9141-23c32b9daa9a	c0ab3088-d0c5-4bad-9863-9ff75b5b857a	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:30:49.339338
89f1356a-c06b-4c80-92af-24634e0f75b8	4cb9fc96-bc39-4b9f-a33d-bee6ad141901	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:32:34.91879
b6051a79-13ee-4cb8-a92e-b8a70fa9703c	1bb53e22-5823-4551-93ac-c11a787796a8	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:35:55.011374
175f2bb7-1ad2-4e69-bab8-1b825df16a67	58d8fe70-151c-4c20-9f82-fda6314bc709	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:37:29.634183
9eb8c526-eb08-4a5a-a936-ebe9025322c2	f9cc4b23-adcf-4390-8dbe-a6632de8188e	\N	comptroller_procurement_review	Submitted	controller_sync	Procurement plan created.	\N	2026-03-20 06:37:41.248273
c33c4692-adbf-4380-a4a0-4a50f6a036c3	a1ebdd07-f6f3-4e37-b187-98075e32d87c	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 06:43:12.476626
a63374c2-19c3-494f-ba5f-96b2d6fa4874	5ededcb7-4c7b-4ead-981e-4a4d75df7842	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 06:43:14.53661
08edd39f-a0ae-4812-87ae-4a5b5ea86767	d422f0d1-c1dd-467a-a41d-64b560bb22de	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 06:43:19.166117
815bb8a1-8b93-4be9-b033-270a6c2f9a0e	22fea365-fe16-4f27-96da-fe1cc7eb4035	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 06:43:54.37135
d3c97997-0b3c-4fa3-924b-dca4dafe96da	22fea365-fe16-4f27-96da-fe1cc7eb4035	planning_committee_review	planning_committee_review	Submitted	controller_sync	Approve	financialunitofficer@nis.gov.ng	2026-03-20 06:44:14.812473
ec376783-93ed-40d8-9e8b-c4c19875a53e	77645e5b-a7f1-4422-9990-8ca74b5c5fdb	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 06:44:28.326334
1f96017f-5ea0-4e33-9933-333513421b64	a1ebdd07-f6f3-4e37-b187-98075e32d87c	planning_committee_review	planning_committee_review	Submitted	controller_sync	Approved	financialunitofficer@nis.gov.ng	2026-03-20 06:47:07.393386
1f472b58-b33e-4fbb-8c58-171131018fd4	77645e5b-a7f1-4422-9990-8ca74b5c5fdb	planning_committee_review	planning_committee_review	Submitted	controller_sync	Approved	financialunitofficer@nis.gov.ng	2026-03-20 06:51:30.855645
c02f4ceb-6742-4d37-b803-9bf2a8b1b8d4	a3b0c220-964d-4e9f-962a-3903305eab1b	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 11:29:51.369657
909da4cb-9504-4aa3-986a-b8bdaf8aa772	a3b0c220-964d-4e9f-962a-3903305eab1b	planning_committee_review	planning_committee_review	Submitted	controller_sync	Approve	departmenthead@nis.gov.ng	2026-03-20 11:30:00.371206
df897aff-931b-4e82-8624-9cc6c8246ffc	f170d07c-8411-4c9d-9302-a4581d297f1f	\N	planning_committee_review	Under Review	controller_sync	Procurement plan created.	\N	2026-03-20 11:54:12.186843
eb70aac1-c661-4c1c-91a6-e77fd1c9d995	f170d07c-8411-4c9d-9302-a4581d297f1f	planning_committee_review	planning_committee_review	Submitted	controller_sync	Approve	departmenthead@nis.gov.ng	2026-03-20 13:12:33.902978
a6c60409-019a-4a83-a8a6-13d80d590016	ec3afd02-041b-4668-bebf-fd9b5f02d1ae	planning_committee_review	app_approval	Under Review	controller_sync	Requisition updated.	\N	2026-03-19 19:15:00.15082
3849dfc4-b629-4305-bb6d-5a35434e59e2	ec3afd02-041b-4668-bebf-fd9b5f02d1ae	\N	app_approval	Initial	controller_sync	Requisition created.	\N	2026-03-19 19:12:45.827441
7194e9c7-9946-4b45-8972-5259412cf360	372cc4dd-bfb4-4f2c-8a06-8f1bdcc275e3	department_need_capture	app_approval	Submitted	controller_sync	Requisition updated.	\N	2026-03-19 21:37:23.680135
a6faa9cc-6903-4ca8-a7b0-d5a6a69a7ba4	372cc4dd-bfb4-4f2c-8a06-8f1bdcc275e3	budget_allocation_and_confirmation	planning_committee_review	Under Review	controller_sync	Requisition updated.	\N	2026-03-20 06:30:21.795346
84eb7252-4544-4b5d-b05e-d7724e99c7d0	f170d07c-8411-4c9d-9302-a4581d297f1f	planning_committee_review	app_approval	Submitted	controller_sync	a	procurement@nis.gov.ng	2026-03-21 20:53:24.240486
eaf547f9-53a0-4c0e-8b79-bc94671acf2c	f170d07c-8411-4c9d-9302-a4581d297f1f	app_approval	planning_committee_review	Submitted	controller_sync	Approve	financialunitofficer@nis.gov.ng	2026-03-21 21:28:08.399681
2b0d222f-b7cf-44f5-9f24-deff6c604e8a	f170d07c-8411-4c9d-9302-a4581d297f1f	planning_committee_review	app_approval	Submitted	controller_sync	Approve	procurement@nis.gov.ng	2026-03-21 21:30:27.214778
da3cf3e8-aa58-47de-b048-ab52aaa2dead	f170d07c-8411-4c9d-9302-a4581d297f1f	planning_committee_review	planning_committee_review	Submitted	controller_sync	Recommend for Approval	\N	2026-03-24 06:20:56.986376
ff1018bd-a860-4676-89f5-065f363ef96a	f170d07c-8411-4c9d-9302-a4581d297f1f	planning_committee_review	planning_committee_review	Under Review	controller_sync	Committee finalized requisition, created APP item, and approved the requisition into the departmental plan.	procurement@nis.gov.ng	2026-03-24 10:54:07.69863
59d8b76a-d6d7-446b-b88e-8c166e904be4	372cc4dd-bfb4-4f2c-8a06-8f1bdcc275e3	department_head_endorsement	budget_allocation_and_confirmation	Initial	controller_sync	Requisition updated.	\N	2026-03-20 06:28:52.771849
90a498ba-76f6-48ab-b2ab-bf6b19c21ef4	f170d07c-8411-4c9d-9302-a4581d297f1f	app_approval	accounting_officer_review	Approved	app_approval_decision	[2026-03-24 13:04:57 UTC] APP approval approve: No note supplied. (actor: procurement@nis.gov.ng)	procurement@nis.gov.ng	2026-03-24 14:04:57.350818
2999b18d-34b3-412a-b9cd-acda145c5773	bb1d1294-7394-4c54-807a-1a2514d28077	\N	department_need_capture	Draft	controller_sync	Requisition created.	\N	2026-03-24 17:00:59.455954
cba74ccf-86ad-48e3-9496-6ca68f7dbf2c	bb1d1294-7394-4c54-807a-1a2514d28077	department_need_capture	department_head_endorsement	Submitted	controller_sync	Requisition updated.	\N	2026-03-24 17:01:27.818113
c296debe-219a-4eb3-b5f0-a4b8b5c9a7f0	bb1d1294-7394-4c54-807a-1a2514d28077	comptroller_procurement_review	planning_committee_review	Under Review	controller_sync	Requisition updated.	\N	2026-03-24 17:26:27.301462
d3866e47-d44e-49c9-9803-3963cb882c83	5ea426dc-d50a-426b-9afc-867596288747	\N	planning_committee_review	Under Review	controller_sync	Planning committee workspace created plan.	\N	2026-03-24 18:59:02.120951
c836fb8a-5e74-4e8e-b2cf-3a11cecb1cee	f170d07c-8411-4c9d-9302-a4581d297f1f	accounting_officer_review	award_and_publication	Approved	cgis_approval	Award approved by CGIS. Rationale: APPROVED	accountingofficer@nis.gov.ng	2026-03-24 19:27:42.137772
e75b82cb-dcb5-4fa2-b3fe-7169e24877d6	c564ce34-4876-44d0-8708-1bcc5ecab549	\N	method_validation	Draft	controller_sync	Tender created.	\N	2026-03-25 15:06:57.402363
46e076ac-150c-443e-91d4-6a8681b570f8	551907fd-039e-4be8-a554-b53fb986d24c	\N	method_validation	Draft	controller_sync	Tender created.	\N	2026-03-25 16:27:55.336613
966b2ea3-5866-4f1d-a1ad-0a20b8651a8e	551907fd-039e-4be8-a554-b53fb986d24c	method_validation	solicitation	Published	controller_sync	Tender published.	\N	2026-03-25 17:00:36.81967
49922d04-d4ac-45ff-9dd2-bb43158e8875	930201d0-ba88-4bbf-b2ff-709d85294091	\N	method_validation	Draft	controller_sync	Tender created.	\N	2026-03-25 17:54:04.886671
aa5fd77c-381b-4924-ae4b-59be331cf9c6	930201d0-ba88-4bbf-b2ff-709d85294091	method_validation	solicitation	Published	controller_sync	Tender published.	\N	2026-03-25 17:54:49.898965
f5828623-0735-48fb-bdf5-fe1f9782f350	bb1d1294-7394-4c54-807a-1a2514d28077	budget_allocation_and_confirmation	comptroller_procurement_review	Initial	controller_sync	Requisition updated.	\N	2026-03-24 17:18:07.564902
b5248133-eaa5-45b9-bb8a-08e0d639bc90	bb1d1294-7394-4c54-807a-1a2514d28077	department_head_endorsement	budget_allocation_and_confirmation	Endorsed	controller_sync	Requisition updated.	\N	2026-03-24 17:03:26.802391
\.


--
-- Data for Name: workflow_instances; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.workflow_instances (instance_id, entity_type, entity_id, current_stage_key, current_status, record_title, parent_entity_type, parent_entity_id, amount, procurement_type, threshold_id, last_transition_reason, created_at, updated_at) FROM stdin;
58d8fe70-151c-4c20-9f82-fda6314bc709	procurement_plan	cd17d78d-562d-4123-a6ae-dc500cfd83ae	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	10000.00	\N	\N	Procurement plan created.	2026-03-20 06:37:29.634183	2026-03-20 06:37:29.634183
ee353305-72d9-4d9b-b548-7029b7a7fa0e	procurement_plan	42f30716-e42e-4b19-8dce-0c4ecd190fa8	planning_committee_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-19 21:15:31.772755	2026-03-19 21:15:31.772755
f9cc4b23-adcf-4390-8dbe-a6632de8188e	procurement_plan	55b8f713-8a4e-4f83-8a4c-059968e641db	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	10000.00	\N	\N	Procurement plan created.	2026-03-20 06:37:41.248273	2026-03-20 06:37:41.248273
5ededcb7-4c7b-4ead-981e-4a4d75df7842	procurement_plan	49bd657e-e25d-4ca1-b832-7f98c6d9358d	planning_committee_review	Under Review	ICT and Cyber Security Procurement Plan	\N	\N	10000.00	\N	\N	Procurement plan created.	2026-03-20 06:43:14.53661	2026-03-20 06:43:14.53661
d422f0d1-c1dd-467a-a41d-64b560bb22de	procurement_plan	c08646d6-e16d-4e77-ae1e-5fbf13f07139	planning_committee_review	Under Review	ICT and Cyber Security Procurement Plan	\N	\N	10000.00	\N	\N	Procurement plan created.	2026-03-20 06:43:19.166117	2026-03-20 06:43:19.166117
22fea365-fe16-4f27-96da-fe1cc7eb4035	procurement_plan	7f5d4ec1-3b78-4ae4-87c1-2cdeafd59a7c	planning_committee_review	Submitted	Member Review: Cleared	\N	\N	\N	\N	\N	Approve	2026-03-20 06:43:54.37135	2026-03-20 06:44:14.812473
30362961-2bf7-491b-b02e-d77f5e0e8e15	procurement_plan	ff591a0c-b02c-486f-9ffc-41c058aec1c9	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:05:01.537951	2026-03-20 06:05:01.537951
c267b5ba-3d7f-483c-b35e-804c7d22610c	procurement_plan	bd9aabaa-291c-457c-854e-f7545bbc8263	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:10:34.198308	2026-03-20 06:10:34.198308
c039f4b7-1a00-447b-b902-1c94809c8538	procurement_plan	f9087925-f3bf-4038-aa9f-71d35fd287d4	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:11:28.507975	2026-03-20 06:11:28.507975
87d38558-0873-476d-8da3-f64c861ece83	procurement_plan	5b7a5304-01f4-4efa-af2d-cd6a5ade7601	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:15:31.046806	2026-03-20 06:15:31.046806
a310953a-da3c-4e9e-bd3c-49ee49384f79	procurement_plan	6b088c90-3157-417f-9171-79fda2070f91	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:17:14.436382	2026-03-20 06:17:14.436382
a1ebdd07-f6f3-4e37-b187-98075e32d87c	procurement_plan	0b58fae1-600a-4af0-854e-2f68b8c3341e	planning_committee_review	Submitted	Member Review: Cleared	\N	\N	\N	\N	\N	Approved	2026-03-20 06:43:12.476626	2026-03-20 06:47:07.393386
c0ab3088-d0c5-4bad-9863-9ff75b5b857a	procurement_plan	3af1ea3b-7e94-48a9-8c6b-4ed920e49ee9	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:30:49.339338	2026-03-20 06:30:49.339338
4cb9fc96-bc39-4b9f-a33d-bee6ad141901	procurement_plan	ee0b4887-6dbb-4a66-a2a2-181ece97d05a	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:32:34.91879	2026-03-20 06:32:34.91879
1bb53e22-5823-4551-93ac-c11a787796a8	procurement_plan	9e14c71d-8890-4f4d-be5f-68670f8283bd	comptroller_procurement_review	Submitted	ICT and Cyber Security Procurement Plan	\N	\N	400000.00	\N	\N	Procurement plan created.	2026-03-20 06:35:55.011374	2026-03-20 06:35:55.011374
77645e5b-a7f1-4422-9990-8ca74b5c5fdb	procurement_plan	38632aa5-6070-43fa-a4b8-4b699875358f	planning_committee_review	Submitted	Member Review: Cleared	\N	\N	\N	\N	\N	Approve	2026-03-20 06:44:28.326334	2026-03-20 11:29:10.696864
a3b0c220-964d-4e9f-962a-3903305eab1b	procurement_plan	8d3a909d-65fc-4faf-9070-e01f66be5e34	planning_committee_review	Submitted	Member Review: Cleared	\N	\N	\N	\N	\N	Approve	2026-03-20 11:29:51.369657	2026-03-20 11:30:00.371206
5ea426dc-d50a-426b-9afc-867596288747	procurement_plan	fad0d2f9-690d-4f38-acd3-f4d8774b67e9	planning_committee_review	Under Review	Border Management Procurement Plan	\N	\N	\N	\N	\N	Planning committee workspace created plan.	2026-03-24 18:59:02.120951	2026-03-24 18:59:02.120951
f170d07c-8411-4c9d-9302-a4581d297f1f	procurement_plan	ca3ac856-1a11-4707-b4ff-148e03bfdf1e	award_and_publication	Approved	ICT and Cyber Security Procurement Plan	\N	\N	401000.00	\N	\N	Award approved by CGIS. Rationale: APPROVED	2026-03-20 11:54:12.186843	2026-03-24 19:27:42.137772
bb1d1294-7394-4c54-807a-1a2514d28077	requisition	c0af86ac-b94f-4a11-bfa2-278a86ab3158	planning_committee_review	Under Review	Border Boot	\N	\N	10000.00	Goods	\N	Requisition updated.	2026-03-24 17:00:59.455954	2026-03-24 17:26:27.301462
ec3afd02-041b-4668-bebf-fd9b5f02d1ae	requisition	4193318f-a6af-4dec-99ed-cfbbc8f5d9ee	planning_committee_review	Under Review	MIDAS Installation	procurement_plan_item	0de8314f-31f0-4c01-abc7-0fdc6c664f61	400000.00	Goods	\N	APP planning workflow alignment migration 079.	2026-03-19 19:12:45.827441	2026-03-21 18:26:51.314803
372cc4dd-bfb4-4f2c-8a06-8f1bdcc275e3	requisition	3d2755a0-165f-4be6-b3f8-963ea8c2390d	planning_committee_review	Under Review	Network Connectivity	procurement_plan_item	1e28c68f-7390-402b-9cce-db2aeb14eb66	1000.00	Services	\N	APP planning workflow alignment migration 079.	2026-03-19 21:36:39.052358	2026-03-21 18:26:51.314803
c564ce34-4876-44d0-8708-1bcc5ecab549	tender	eab0d51a-acd7-48d6-83a0-b810254c83b8	method_validation	Draft	MIDAS Installation	\N	\N	400000.00	Goods	\N	Tender created.	2026-03-25 15:06:57.402363	2026-03-25 15:06:57.402363
551907fd-039e-4be8-a554-b53fb986d24c	tender	a10dbfa7-41f1-4754-930c-1d98d0932c70	solicitation	Published	Network Connectivity	\N	\N	1000.00	Goods	\N	Tender published.	2026-03-25 16:27:55.336613	2026-03-25 17:00:36.81967
930201d0-ba88-4bbf-b2ff-709d85294091	tender	cb828ae4-7598-4043-b67a-5dab858e84a0	solicitation	Published	Network Connectivity	\N	\N	1000.00	Services	\N	Tender published.	2026-03-25 17:54:04.886671	2026-03-25 17:54:49.898965
\.


--
-- Data for Name: workflow_role_tasks; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.workflow_role_tasks (role_task_id, role_key, display_name, stage_key, task_description, expected_outcome, created_at) FROM stdin;
04f8f0f6-7e61-4c5a-a4c8-e19f1d7e1e03	bpp_reviewer	BPP Reviewer	bpp_no_objection	Record BPP review result and remarks.	No-objection outcome is captured.	2026-03-13 19:35:18.809143
d79b4171-1a44-416a-9dba-5a64e8febea8	bpp_liaison	BPP Liaison	bpp_no_objection	Prepare and submit prior-review pack.	BPP request is complete and traceable.	2026-03-13 19:35:18.809143
68b05609-2ea6-433f-9092-c031d3798a2e	evaluation_committee	Evaluation Committee	evaluation	Consolidate evaluation findings into report.	Recommendation is ready for approval.	2026-03-13 19:35:18.809143
7d28c809-542c-4c26-8897-b56c8c114c8d	contract_manager	Contract Manager	contract_execution	Manage milestones, guarantees, and variations.	Contract is executed under control.	2026-03-13 19:35:18.809143
353e0451-bbcc-4479-9224-77ca5de8d36f	planning_statistics_officer	Planning, Research and Statistics	planning_committee_review	Review demand timing and aggregation logic.	APP package is planning-compliant.	2026-03-13 19:35:18.809143
a540c532-b29d-41b1-af76-00ed19b302b5	complaints_review_officer	Administrative Review Officer	administrative_review	Handle complaint and record remedy path.	Section 54 review path is tracked.	2026-03-13 19:35:18.809143
92daffa3-7fe4-4e15-a54b-8a55fe2614e6	inspection_officer	Inspection Officer	inspection_and_payment	Verify delivery and acceptance evidence.	Payment readiness is supported by inspection.	2026-03-13 19:35:18.809143
c9db3e96-b297-43e3-ba23-5293296e878a	audit_oversight	Audit and Oversight	closeout_and_audit	Review closeout pack and audit trail.	Procurement file is ready for oversight.	2026-03-13 19:35:18.809143
fbbd771e-08ce-4bee-b215-c8555fae323e	legal_reviewer	Legal Reviewer	method_validation	Confirm lawful procurement method and exceptions.	Method is compliant with the Act.	2026-03-13 19:35:18.809143
fa15fd6e-edc3-4e96-94c6-641fb3355bf9	payment_officer	Payment Officer	inspection_and_payment	Track payment readiness and release path.	Disbursement is tied to acceptance.	2026-03-13 19:35:18.809143
e07df3d9-5132-4934-afc2-4cdb7e42297f	comptroller_procurement	Comptroller Procurement	comptroller_procurement_review	Approve the request for Planning Committee review.	Request is approved for committee consideration.	2026-03-19 18:19:00.424274
0607e8be-c4e9-469e-971d-6eb6c2185210	tenders_board	NIS Tenders Board	tenders_board_review	Approve, reject, or endorse recommendation for BPP prior review under the chairmanship of CGIS.	Board decision is recorded with governance rationale.	2026-03-13 19:35:18.809143
f8264949-a92a-492a-be6e-8f74ae567a45	tenders_board_secretary	Tenders Board Secretary	tenders_board_review	Prepare board papers and record the decision log for the NIS Tenders Board chaired by CGIS.	Board traceability is complete.	2026-03-13 19:35:18.809143
3e025c5d-e1f2-46c2-a8f8-d0a5eb72c9a3	technical_evaluator	Technical Evaluator	bid_opening	Review opening records and confirm bid packages received for technical evaluation.	Technical evaluation starts from a complete opening record.	2026-03-17 16:28:47.254887
963c6b0d-a215-451a-85e2-618c6c795679	financial_evaluator	Financial Evaluator	bid_opening	Review opening records and declared bid figures for downstream financial evaluation.	Financial evaluation starts from the official opening record.	2026-03-17 16:28:47.254887
523b0c34-fe32-4191-a43b-4835a43847af	procurement_manager	Procurement Manager	bid_opening	Supervise bid opening readiness and validate opening records.	Bid opening oversight is exercised before evaluation proceeds.	2026-03-17 16:28:47.254887
24385351-c418-4c73-9034-f9dd5d4f9769	admin	Admin	bid_opening	Provide administrative oversight for bid opening access and control.	Administrative oversight is available for exceptional bid opening cases.	2026-03-17 16:28:47.254887
c6bf6a97-d626-405f-96ca-030884219702	evaluation_committee	Evaluation Committee	bid_opening	Inspect the opening minutes, attendance, and submission record before evaluation.	Committee evaluation begins from a verified opening session.	2026-03-17 16:28:47.254887
a86074ad-3891-4b3e-bbde-cc91bc4ae12a	ict_admin	System Administrator	bid_opening	Maintain controlled access and operational support for bid opening sessions.	System access issues do not block compliant bid opening operations.	2026-03-17 16:28:47.254887
4c8f6bbf-d068-4bf9-8478-8f9829a4da2d	department_head	Department Head	department_head_endorsement	Endorse the departmental request.	Department endorsement is recorded.	2026-03-19 18:19:00.424274
f1a285ad-c855-4d7c-9926-1a7302ec0d28	financial_unit_officer	Budget Officer	budget_allocation_and_confirmation	Allocate budget code and confirm funds for the request.	Budget allocation and confirmation are recorded.	2026-03-19 18:19:00.424274
c01b5621-0873-4253-8187-af2d5342b6fd	comptroller_procurement	Comptroller Procurement	bid_opening	Schedule, open, and record public bid opening sessions.	Bid opening records are complete and ready for evaluation.	2026-03-17 16:28:47.254887
bec2a84a-adc6-4905-9a25-5da001b7c9f3	financial_evaluator	Financial Evaluator	evaluation	Perform arithmetic and financial review.	Commercial comparison is accurate.	2026-03-18 11:17:07.988626
9a949b62-e133-4e99-8399-b7ed6d9c24a8	technical_evaluator	Technical Evaluator	evaluation	Perform technical scoring.	Technical responsiveness is assessed.	2026-03-18 11:17:07.988626
69755a67-e7eb-4425-ace5-853291e34924	accounting_officer	CGIS	accounting_officer_review	Exercise direct low-value approval authority.	CGIS decision is recorded before award publication.	2026-03-19 18:19:00.424274
bb1918cf-947a-42bd-b159-28e75f33050b	comptroller_procurement	Comptroller Procurement	solicitation	Publish advert, invitation, EOI, or RFP using the required route.	Competition is opened lawfully through the approved publication route.	2026-03-13 19:35:18.809143
cf75693d-35e5-491c-9304-09687a7d49ed	requisitioning_officer	Requisitioning Officer	department_need_capture	Create and submit the departmental request.	Department request is logged for endorsement.	2026-03-19 18:19:00.424274
583ea2c3-4ddb-4fc4-8403-457a85a1135f	comptroller_procurement	Comptroller Procurement	procurement_initiation	Open procurement package from approved APP line.	Execution begins only from approved APP entries.	2026-03-13 19:35:18.809143
5dc6d92d-783f-4739-90ce-349d90bb877c	comptroller_procurement	Comptroller Procurement	app_approval	Approve the annual procurement plan as head of the procurement unit.	APP is approved for execution.	2026-03-21 16:03:04.819136
530aee89-f987-4843-9f9a-fe0ae9e6346a	comptroller_procurement	Comptroller Procurement	threshold_resolution	Resolve threshold band and approval route as head of the procurement unit.	Approval path and BPP gate are explicit.	2026-03-21 16:09:05.537221
ad16c9f6-be6f-46cb-bf29-5e6727e2a93f	procurement_secretary	Procurement Secretary	planning_committee_review	Record committee deliberations and maintain the planning committee trail.	Committee proceedings are properly recorded.	2026-03-21 18:26:51.314803
88a00d9d-0e00-47ee-9183-123134edc735	financial_unit_officer	Financial Unit Officer	planning_committee_review	Review funding alignment and confirm budget integrity within the committee.	Funding position is confirmed for committee review.	2026-03-21 18:26:51.314803
4901776b-13a2-4024-9947-2e79963ff2de	legal_reviewer	Legal Reviewer	planning_committee_review	Review legal compliance of the requisition package before APP approval.	Committee record includes legal compliance view.	2026-03-21 18:26:51.314803
9eed85bd-79c8-4cd9-86e9-ea5f1ec7df2a	department_head	Department Head	planning_committee_review	Confirm the originating department's operational justification during committee review.	Department need remains justified at committee stage.	2026-03-21 18:26:51.314803
fadadbb1-d8fe-44d1-8cfb-d7a141c6333f	comptroller_procurement	Comptroller Procurement	method_validation	Approve the validated procurement method and authorize movement to solicitation.	Method validation is accepted and the tender can proceed to publication.	2026-03-25 15:35:11.837163
7a1c7c86-a1dd-4b5a-b764-267355757119	accounting_officer	CGIS	app_approval	Provide Comptroller General of Immigration Service concurrence before the APP is released for execution.	APP approval includes CGIS control.	2026-03-21 18:26:51.314803
\.


--
-- Data for Name: workflow_stage_catalog; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.workflow_stage_catalog (stage_id, stage_key, phase_key, stage_title, stage_description, sequence_no, is_decision_gate, is_start, is_terminal, primary_owner_role, ppa_reference, created_at, updated_at) FROM stdin;
1dc12199-fc9f-4d2f-b3a6-a33b2eb9875d	planning_committee_review	app_planning	Planning Committee Review	Validate need, packaging, aggregation, and cost assumptions.	5	f	f	f	comptroller_procurement	PPA 2007 s.18, s.21	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
22581a61-e9bd-4ebb-891a-d941d63e9eab	department_need_capture	app_planning	Department Need Capture	Requisitioning Officer drafts and submits the departmental need.	1	f	t	f	requisitioning_officer	PPA 2007 s.18	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
169af693-67fe-472b-a9e3-72ffd9d32b26	department_head_endorsement	app_planning	Department Head Endorsement	Department Head endorses the departmental need before budget coding.	2	f	f	f	department_head	PPA 2007 s.18	2026-03-19 18:19:00.414658	2026-03-19 18:22:54.829986
8157c757-0e99-4963-956f-9c34b5902e68	comptroller_procurement_review	app_planning	Comptroller Procurement Review	Comptroller Procurement approves the request for Planning Committee review.	4	f	f	f	comptroller_procurement	PPA 2007 s.18, s.21	2026-03-19 18:19:00.414658	2026-03-19 18:22:54.829986
ffe74a58-515b-4040-88d5-886adac4355d	app_approval	app_planning	APP Approval	Approve the annual procurement plan for execution.	6	t	f	f	comptroller_procurement	PPA 2007 s.16, s.18	2026-03-13 19:35:18.790439	2026-03-26 05:52:09.154993
04acb062-24f4-4823-a255-796c57d4ad18	solicitation	procurement_execution	Advert / Invitation / EOI / RFP	Publish advert, invitation, EOI, or RFP in the lawful format.	10	f	f	f	comptroller_procurement	PPA 2007 s.19, s.25, s.44-s.48	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
292aa930-c41c-42ec-86fc-655fb2c9aa68	procurement_initiation	threshold_control	Procurement Initiation	Activate an approved APP line for execution.	7	f	f	f	comptroller_procurement	PPA 2007 s.16, s.19	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
0b795667-a0d5-43f3-82cd-03bb9b3c4c71	method_validation	threshold_control	Method Validation	Confirm the lawful procurement method and route.	9	t	f	f	legal_reviewer	PPA 2007 s.24-s.52	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
78ee54fd-ffb6-4a3e-8dc6-2b70a98426c1	evaluation	procurement_execution	Evaluation	Evaluate against published criteria only.	12	f	f	f	evaluation_committee	PPA 2007 s.31-s.33, s.49-s.52	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
b0779bd7-51bd-48ef-854f-ad27a17d27c9	tenders_board_review	procurement_execution	Tenders Board Review	NIS Tenders Board review chaired by CGIS, with the board secretary maintaining the decision record.	13	t	f	f	tenders_board	PPA 2007 s.17, s.19, s.22	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
0da22c3a-7df9-4443-9cde-9b129472f222	bid_opening	procurement_execution	Bid Opening	Record public opening and attendance.	11	f	f	f	comptroller_procurement	PPA 2007 s.30	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
fa576e9e-8112-4dcb-bbc5-3fdcbd3b09b8	threshold_resolution	threshold_control	Threshold Resolution	Resolve approval route, board gate, and BPP need.	8	t	f	f	comptroller_procurement	PPA 2007 s.16, s.17	2026-03-13 19:35:18.790439	2026-03-21 16:09:05.537221
27c2d770-e3d0-48ba-bf4b-c53e366b8a2c	budget_allocation_and_confirmation	app_planning	Budget Allocation and Confirmation	Assign budget code and confirm funding readiness before committee review.	3	t	f	f	financial_unit_officer	PPA 2007 s.16, s.18	2026-03-26 05:52:09.154993	2026-03-26 05:52:09.154993
ae50ce8f-fb39-4559-99b7-b56f06bb99ab	bpp_no_objection	procurement_execution	BPP No Objection	Prior review and no-objection gate for applicable thresholds.	15	t	f	f	bpp_liaison	PPA 2007 s.16, s.19	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
7acf428b-720c-48d2-acbc-319d249f78b6	contract_execution	post_award	Contract Execution	Manage contract signing, security, mobilisation, and milestones.	17	f	f	f	contract_manager	PPA 2007 s.35-s.37	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
1ca22cf1-1f3d-4677-80ed-f84189c4488e	inspection_and_payment	post_award	Inspection and Payment	Record inspection, acceptance, and payment readiness.	18	f	f	f	inspection_officer	PPA 2007 s.19, s.37	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
ef95bab2-59fa-4bb2-8839-557359d99071	closeout_and_audit	review_and_oversight	Closeout and Audit	Archive records, complete closeout, and preserve audit trace.	19	f	f	t	audit_oversight	PPA 2007 s.16, s.38	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
51d8b6a0-462c-4320-aa2f-ceff4d397d0a	administrative_review	review_and_oversight	Administrative Review	Handle bidder complaint and statutory review path.	20	f	f	f	complaints_review_officer	PPA 2007 s.54	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
cf69efa0-f114-47d0-a055-80f5896a0262	accounting_officer_review	procurement_execution	CGIS Approval	CGIS exercises the direct low-value approval authority before award publication.	14	t	f	f	accounting_officer	PPA 2007 s.16, s.20	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
bd98b7ac-f110-4e88-a385-0adcf47d2ede	award_and_publication	post_award	Award and Publication	Issue award notice and publish award record.	16	f	f	f	comptroller_procurement	PPA 2007 s.19, s.33	2026-03-13 19:35:18.790439	2026-03-19 18:22:54.829986
\.


--
-- Data for Name: workflow_stage_transitions; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.workflow_stage_transitions (transition_id, from_stage_key, to_stage_key, transition_condition, created_at) FROM stdin;
229beed6-368d-4bbc-a2ca-c5e24e267d10	contract_execution	inspection_and_payment	Milestone or delivery ready for inspection.	2026-03-13 19:35:18.802025
2c1334c7-2026-4187-a102-ef43ab8ed6b9	solicitation	administrative_review	Complaint filed.	2026-03-13 19:35:18.802025
a7ba812f-e563-40e7-8275-645dbd5c9d75	evaluation	administrative_review	Complaint filed.	2026-03-13 19:35:18.802025
43468dae-c513-48db-8822-1d981533a8c6	procurement_initiation	threshold_resolution	Procurement request created.	2026-03-13 19:35:18.802025
fbd39a62-4656-4757-87d7-e14478062559	threshold_resolution	method_validation	Threshold route resolved.	2026-03-13 19:35:18.802025
23d48853-92dd-4779-8874-f354c6437d3f	award_and_publication	administrative_review	Complaint filed.	2026-03-13 19:35:18.802025
6a59feb0-316e-4c4b-a05e-0ec496900dcc	inspection_and_payment	closeout_and_audit	Final acceptance and payment complete.	2026-03-13 19:35:18.802025
f24bfa9f-98ee-44d9-bbb1-dc92d8105d50	method_validation	solicitation	Method validated and approved.	2026-03-13 19:35:18.802025
d37cdf4d-7d91-4fe6-b426-efb70f7e9d6c	bid_opening	evaluation	Opening completed and minutes recorded.	2026-03-13 19:35:18.802025
c3ffcc1a-5c3c-4b21-8889-193cc018fd79	award_and_publication	contract_execution	Contract signed.	2026-03-13 19:35:18.802025
5444b39c-707f-4ab2-b705-74245e47d9a4	bpp_no_objection	award_and_publication	No-objection issued.	2026-03-13 19:35:18.802025
e5795cba-5e20-43aa-bebc-fb43adcded21	administrative_review	closeout_and_audit	Complaint outcome terminates procurement and archives the file.	2026-03-13 19:59:23.354097
ebb36977-4223-40fa-a8ea-090d198c5076	administrative_review	award_and_publication	Complaint resolved and procurement returns to award stage.	2026-03-13 19:59:23.354097
09cc4fc7-1136-4e59-a721-9b5721baf1c8	administrative_review	evaluation	Complaint resolved and procurement returns to evaluation.	2026-03-13 19:59:23.354097
756e1100-2447-424a-bb49-619820fc4790	administrative_review	bpp_no_objection	Complaint outcome escalates case for BPP prior review.	2026-03-13 19:59:23.354097
5241e01c-85fb-4aef-b377-a4d560775176	evaluation	accounting_officer_review	CGIS direct approval applies within low-value threshold.	2026-03-15 07:12:40.954569
6a76fc93-99ec-424e-aa24-d4b62b6cc56c	tenders_board_review	bpp_no_objection	BPP prior review applies after board endorsement.	2026-03-15 07:12:40.954569
06e1520e-dd74-4bda-b454-3816838cefb0	department_need_capture	department_head_endorsement	Submitted requisition moves to Department Head endorsement.	2026-03-19 18:19:00.421286
dcab24d3-24e3-417d-83b6-4a31edb3591e	department_head_endorsement	budget_allocation_and_confirmation	Department Head endorsement completed.	2026-03-19 18:19:00.421286
e7718053-99cf-4dc7-8afb-d725aba53362	budget_allocation_and_confirmation	comptroller_procurement_review	Budget allocation and confirmation completed for planning review.	2026-03-19 18:19:00.421286
99d8fc85-ab55-43f2-803e-9f5c8f2e7985	planning_committee_review	department_head_endorsement	Committee returns the request to the department for rework.	2026-03-26 09:53:57.899457
ac25cc20-1bbf-4748-bd61-faa3d966ceed	app_approval	planning_committee_review	APP approval returns the plan for committee rework.	2026-03-26 09:53:57.899457
e7beb173-6f8a-4c0d-a617-37e20ba353c9	app_approval	accounting_officer_review	Comptroller Procurement forwards the committee-approved plan to CGIS for approval.	2026-03-26 09:53:57.899457
a9251ba9-6f4a-469b-b689-278b9bd0743f	accounting_officer_review	procurement_initiation	CGIS approves the plan and procurement may now be initiated.	2026-03-26 09:53:57.899457
dca72634-9b38-401c-8e08-22faa14e4214	administrative_review	solicitation	Complaint resolved and procurement resumes from advert / invitation / EOI / RFP stage.	2026-03-13 19:59:23.354097
66a2b4b1-a9a8-49cb-b3cc-57b475db444d	comptroller_procurement_review	planning_committee_review	Comptroller Procurement approves for committee review.	2026-03-19 18:19:00.421286
1fa284ef-3289-4f08-937a-0add25ab0fd3	accounting_officer_review	bpp_no_objection	BPP prior review required.	2026-03-19 18:19:00.421286
32495ab1-e8c4-4a89-bccf-25476f47aabd	accounting_officer_review	award_and_publication	CGIS direct approval is complete.	2026-03-13 19:35:18.802025
07257e7f-7c65-483f-9027-81cd75b1d655	evaluation	tenders_board_review	Board review applies within board or BPP threshold.	2026-03-13 19:35:18.802025
574220a0-1d4d-4a3e-a710-1f8c57dda7ae	solicitation	bid_opening	Submission period closes.	2026-03-13 19:35:18.802025
caaada00-7401-4fe4-a56a-c6bcc77088ff	tenders_board_review	award_and_publication	Board approval is final within threshold.	2026-03-13 19:35:18.802025
\.


--
-- Data for Name: yearly_apps; Type: TABLE DATA; Schema: procurement_workflow; Owner: -
--

COPY procurement_workflow.yearly_apps (yearly_app_id, fiscal_year, title, status, notes, submitted_at, approved_at, created_at, updated_at) FROM stdin;
4f23c3eb-febe-455c-9959-6a14d292b2d5	2026	2026 APP	Under Review	Backfilled from procurement plans.	\N	\N	2026-03-23 15:43:53.659537	2026-03-24 18:59:02.120951
\.


--
-- Data for Name: bid_opening_sessions; Type: TABLE DATA; Schema: vendor_sourcing; Owner: -
--

COPY vendor_sourcing.bid_opening_sessions (session_id, tender_id, session_title, location, scheduled_at, status, opened_at, closed_at, notes, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: bids; Type: TABLE DATA; Schema: vendor_sourcing; Owner: -
--

COPY vendor_sourcing.bids (bid_id, tender_id, vendor_id, bid_amount, technical_proposal_url, validity_period_days, submission_date, status, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: compliance_documents; Type: TABLE DATA; Schema: vendor_sourcing; Owner: -
--

COPY vendor_sourcing.compliance_documents (document_id, vendor_id, document_name, document_type, file_reference, upload_date, expiry_date, document_status, reviewer_id, review_date, rejection_reason, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: tenders; Type: TABLE DATA; Schema: vendor_sourcing; Owner: -
--

COPY vendor_sourcing.tenders (tender_id, title, description, category, status, budget, specifications, eligibility_criteria, evaluation_criteria, publish_date, opening_date, closing_date, created_by, created_at, updated_by, updated_at, department, budget_code, fiscal_year) FROM stdin;
3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f09	Mobile Patrol Boats	Procurement of patrol boats for coastal border security.	Marine	Published	210000000.00	Shallow-water patrol boats, navigation kits	Maritime safety certification and OEM support	65% technical, 35% financial	2026-02-21 07:56:54.514978	2026-02-24 07:56:54.514978	2026-03-26 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
9d8c7b6a-5f4e-4d3c-8b2a-1c0d9e8f7a05	Data Center UPS Upgrade	Procurement of UPS systems for data center resilience.	ICT	Awarded	68000000.00	Tier III UPS, battery banks	Certified OEM partners	70% technical, 30% financial	2025-10-02 07:56:54.514978	2025-10-12 07:56:54.514978	2025-11-21 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
7a6b5c4d-3e2f-4a1b-8c7d-6e5f4a3b2c03	Passport Printing Supplies	Supply of secure passport printing materials and consumables.	Logistics	Published	120000000.00	Secure paper, holograms, inks	Security clearance and compliance with ISO 14298	65% technical, 35% financial	2026-01-30 07:56:54.514978	2026-02-04 07:56:54.514978	2026-03-06 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10	Training Simulation Labs	Design and setup of simulation labs for officer training.	Training	Published	47000000.00	Simulation hardware, training software licenses	Prior gov training lab deployments	60% technical, 40% financial	2026-02-13 07:56:54.514978	2026-02-17 07:56:54.514978	2026-03-19 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
8c9d0e1f-2a3b-4c5d-8e9f-0a1b2c3d4e04	Vehicle Fleet Maintenance	Comprehensive maintenance and servicing for operational vehicles.	Transport	Closed	42000000.00	OEM spare parts, scheduled servicing	Authorized service centers and OEM parts	50% technical, 50% financial	2025-11-01 07:56:54.514978	2025-11-11 07:56:54.514978	2025-12-21 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e08	Facility Energy Optimization	Energy efficiency retrofit for HQ and regional offices.	Facilities	Cancelled	26000000.00	LED retrofits, smart meters	Energy audit certification	50% technical, 50% financial	2025-08-13 07:56:54.514978	2025-08-23 07:56:54.514978	2025-09-22 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06	Border Post Renovation	Renovation of priority border post facilities.	Infrastructure	Published	310000000.00	Structural upgrades, power backup	Registered construction firms with Class A rating	60% technical, 40% financial	2026-02-17 07:56:54.514978	2026-02-22 07:56:54.514978	2026-03-29 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
4e5c2a1f-8b5f-4c3a-9c2f-1a2b3c4d5e01	Border Surveillance Upgrade	Supply and installation of border surveillance systems, sensors, and command dashboards.	Security	Published	250000000.00	Thermal cameras, UAVs, perimeter sensors	ISO 27001 certified, prior government deployments	70% technical, 30% financial	2026-02-09 07:56:54.514978	2026-02-14 07:56:54.514978	2026-03-16 07:56:54.514978	seed	2026-03-01 07:56:54.514978	seed	2026-03-01 07:56:54.514978	\N	\N	\N
b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22	Supply of 50 High-Performance Laptops	Procurement of 50 laptops for the new ICT center.	Goods	Published	15000000.00	\N	\N	\N	\N	\N	\N	postgres	2026-03-13 05:58:28.029599	postgres	2026-03-18 05:58:28.029599	ICT Department	\N	\N
eab0d51a-acd7-48d6-83a0-b810254c83b8	MIDAS Installation	Tender for MIDAS Installation	Goods	Draft	400000.00	\N	\N	\N	\N	\N	\N	postgres	2026-03-25 15:06:57.402363	postgres	2026-03-25 15:06:57.402363	ICT and Cyber Security	CAP-ICT-001	2026
a10dbfa7-41f1-4754-930c-1d98d0932c70	Network Connectivity	Tender for Network Connectivity	Goods	Published	1000.00	\N	\N	\N	2026-03-25 00:00:00	2026-03-25 00:00:00	2026-08-25 00:00:00	postgres	2026-03-25 16:27:55.336613	postgres	2026-03-25 17:00:36.81967	ICT and Cyber Security	CAP-ICT-001	2026
cb828ae4-7598-4043-b67a-5dab858e84a0	Network Connectivity	Tender for Network Connectivity	Services	Published	1000.00	1. 1 1 5G Broadband	Valid CAC registration or equivalent business registration document.\nCurrent Tax Clearance Certificate.\nPENCOM compliance certificate where applicable.\nITF compliance certificate where applicable.\nNSITF compliance evidence where applicable.\nEvidence of similar contract experience.\nRelevant professional, technical, or regulatory licenses where applicable.\nSigned bid declaration and conflict-of-interest disclosure.	Preliminary examination: responsiveness to mandatory submission requirements.\nTechnical evaluation: understanding of assignment, methodology, team composition, and relevant experience.\nFinancial evaluation: comparison of financial proposals for technically responsive bidders.\nFinal recommendation based on the applicable quality and cost assessment method.	2026-03-25 00:00:00	2026-03-25 00:00:00	2026-06-25 00:00:00	postgres	2026-03-25 17:54:04.886671	postgres	2026-03-25 17:54:49.898965	ICT and Cyber Security	CAP-ICT-001	2026
\.


--
-- Name: compliance_document_history compliance_document_history_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.compliance_document_history
    ADD CONSTRAINT compliance_document_history_pkey PRIMARY KEY (history_id);


--
-- Name: compliance_documents compliance_documents_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.compliance_documents
    ADD CONSTRAINT compliance_documents_pkey PRIMARY KEY (document_id);


--
-- Name: internal_module_grant_audit internal_module_grant_audit_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grant_audit
    ADD CONSTRAINT internal_module_grant_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: internal_module_grants internal_module_grants_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grants
    ADD CONSTRAINT internal_module_grants_pkey PRIMARY KEY (grant_id);


--
-- Name: internal_users internal_users_email_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_users
    ADD CONSTRAINT internal_users_email_key UNIQUE (email);


--
-- Name: internal_users internal_users_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_users
    ADD CONSTRAINT internal_users_pkey PRIMARY KEY (internal_user_id);


--
-- Name: organizational_positions organizational_positions_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_positions
    ADD CONSTRAINT organizational_positions_pkey PRIMARY KEY (position_id);


--
-- Name: organizational_positions organizational_positions_position_code_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_positions
    ADD CONSTRAINT organizational_positions_position_code_key UNIQUE (position_code);


--
-- Name: organizational_units organizational_units_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_units
    ADD CONSTRAINT organizational_units_pkey PRIMARY KEY (unit_id);


--
-- Name: organizational_units organizational_units_unit_code_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_units
    ADD CONSTRAINT organizational_units_unit_code_key UNIQUE (unit_code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: user_login_security user_login_security_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_login_security
    ADD CONSTRAINT user_login_security_pkey PRIMARY KEY (internal_user_id);


--
-- Name: vendors vendors_email_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.vendors
    ADD CONSTRAINT vendors_email_key UNIQUE (email);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: vendors vendors_registration_number_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.vendors
    ADD CONSTRAINT vendors_registration_number_key UNIQUE (registration_number);


--
-- Name: vendors vendors_tax_id_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.vendors
    ADD CONSTRAINT vendors_tax_id_key UNIQUE (tax_id);


--
-- Name: contract_awards contract_awards_award_code_key; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.contract_awards
    ADD CONSTRAINT contract_awards_award_code_key UNIQUE (award_code);


--
-- Name: contract_awards contract_awards_pkey; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.contract_awards
    ADD CONSTRAINT contract_awards_pkey PRIMARY KEY (award_id);


--
-- Name: contract_milestones contract_milestones_pkey; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.contract_milestones
    ADD CONSTRAINT contract_milestones_pkey PRIMARY KEY (milestone_id);


--
-- Name: contracts contracts_contract_code_key; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.contracts
    ADD CONSTRAINT contracts_contract_code_key UNIQUE (contract_code);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (contract_id);


--
-- Name: inspections inspections_inspection_code_key; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.inspections
    ADD CONSTRAINT inspections_inspection_code_key UNIQUE (inspection_code);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (inspection_id);


--
-- Name: payments payments_payment_reference_key; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.payments
    ADD CONSTRAINT payments_payment_reference_key UNIQUE (payment_reference);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: approval_thresholds approval_thresholds_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.approval_thresholds
    ADD CONSTRAINT approval_thresholds_pkey PRIMARY KEY (threshold_id);


--
-- Name: bids bids_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.bids
    ADD CONSTRAINT bids_pkey PRIMARY KEY (bid_id);


--
-- Name: bpp_no_objections bpp_no_objections_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.bpp_no_objections
    ADD CONSTRAINT bpp_no_objections_pkey PRIMARY KEY (no_objection_id);


--
-- Name: budget_appropriations budget_appropriations_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_appropriations
    ADD CONSTRAINT budget_appropriations_pkey PRIMARY KEY (appropriation_id);


--
-- Name: budget_commitments budget_commitments_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_commitments
    ADD CONSTRAINT budget_commitments_pkey PRIMARY KEY (commitment_id);


--
-- Name: budget_expenditures budget_expenditures_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_expenditures
    ADD CONSTRAINT budget_expenditures_pkey PRIMARY KEY (expenditure_id);


--
-- Name: budget_lines budget_lines_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_lines
    ADD CONSTRAINT budget_lines_pkey PRIMARY KEY (budget_code);


--
-- Name: budget_releases budget_releases_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_releases
    ADD CONSTRAINT budget_releases_pkey PRIMARY KEY (release_id);


--
-- Name: evaluation_actions evaluation_actions_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.evaluation_actions
    ADD CONSTRAINT evaluation_actions_pkey PRIMARY KEY (action_id);


--
-- Name: evaluation_reports evaluation_reports_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.evaluation_reports
    ADD CONSTRAINT evaluation_reports_pkey PRIMARY KEY (report_id);


--
-- Name: evaluation_reports evaluation_reports_report_code_key; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.evaluation_reports
    ADD CONSTRAINT evaluation_reports_report_code_key UNIQUE (report_code);


--
-- Name: governance_bodies governance_bodies_body_code_key; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.governance_bodies
    ADD CONSTRAINT governance_bodies_body_code_key UNIQUE (body_code);


--
-- Name: governance_bodies governance_bodies_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.governance_bodies
    ADD CONSTRAINT governance_bodies_pkey PRIMARY KEY (body_id);


--
-- Name: governance_body_memberships governance_body_membership_ux; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.governance_body_memberships
    ADD CONSTRAINT governance_body_membership_ux UNIQUE (body_id, position_id);


--
-- Name: governance_body_memberships governance_body_memberships_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.governance_body_memberships
    ADD CONSTRAINT governance_body_memberships_pkey PRIMARY KEY (membership_id);


--
-- Name: internal_requisitions internal_requisitions_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.internal_requisitions
    ADD CONSTRAINT internal_requisitions_pkey PRIMARY KEY (requisition_id);


--
-- Name: tender_evaluation_assignments pk_tender_evaluation_assignments; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_assignments
    ADD CONSTRAINT pk_tender_evaluation_assignments PRIMARY KEY (tender_id, assignment_role);


--
-- Name: planning_committee_configuration planning_committee_configuration_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_configuration
    ADD CONSTRAINT planning_committee_configuration_pkey PRIMARY KEY (committee_code);


--
-- Name: planning_committee_decisions planning_committee_decisions_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT planning_committee_decisions_pkey PRIMARY KEY (decision_id);


--
-- Name: planning_committee_member_reviews planning_committee_member_reviews_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT planning_committee_member_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: planning_committee_member_status planning_committee_member_status_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT planning_committee_member_status_pkey PRIMARY KEY (status_id);


--
-- Name: planning_committee_plan_links planning_committee_plan_links_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_plan_links
    ADD CONSTRAINT planning_committee_plan_links_pkey PRIMARY KEY (requisition_id);


--
-- Name: procurement_closeouts procurement_closeouts_closeout_reference_key; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_closeouts
    ADD CONSTRAINT procurement_closeouts_closeout_reference_key UNIQUE (closeout_reference);


--
-- Name: procurement_closeouts procurement_closeouts_entity_ux; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_closeouts
    ADD CONSTRAINT procurement_closeouts_entity_ux UNIQUE (entity_type, entity_id);


--
-- Name: procurement_closeouts procurement_closeouts_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_closeouts
    ADD CONSTRAINT procurement_closeouts_pkey PRIMARY KEY (closeout_id);


--
-- Name: procurement_complaints procurement_complaints_complaint_reference_key; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_complaints
    ADD CONSTRAINT procurement_complaints_complaint_reference_key UNIQUE (complaint_reference);


--
-- Name: procurement_complaints procurement_complaints_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_complaints
    ADD CONSTRAINT procurement_complaints_pkey PRIMARY KEY (complaint_id);


--
-- Name: procurement_plan_cycles procurement_plan_cycles_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_cycles
    ADD CONSTRAINT procurement_plan_cycles_pkey PRIMARY KEY (plan_cycle_id);


--
-- Name: procurement_plan_items procurement_plan_items_app_code_key; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_items
    ADD CONSTRAINT procurement_plan_items_app_code_key UNIQUE (app_code);


--
-- Name: procurement_plan_items procurement_plan_items_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_items
    ADD CONSTRAINT procurement_plan_items_pkey PRIMARY KEY (plan_item_id);


--
-- Name: procurement_plans procurement_plans_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plans
    ADD CONSTRAINT procurement_plans_pkey PRIMARY KEY (plan_id);


--
-- Name: requisition_app_unlinks requisition_app_unlinks_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_app_unlinks
    ADD CONSTRAINT requisition_app_unlinks_pkey PRIMARY KEY (unlink_id);


--
-- Name: requisition_approval_tasks requisition_approval_tasks_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_approval_tasks
    ADD CONSTRAINT requisition_approval_tasks_pkey PRIMARY KEY (approval_task_id);


--
-- Name: requisition_audit_events requisition_audit_events_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_audit_events
    ADD CONSTRAINT requisition_audit_events_pkey PRIMARY KEY (id);


--
-- Name: requisition_line_items requisition_line_items_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_line_items
    ADD CONSTRAINT requisition_line_items_pkey PRIMARY KEY (line_item_id);


--
-- Name: requisitions requisitions_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisitions
    ADD CONSTRAINT requisitions_pkey PRIMARY KEY (requisition_id);


--
-- Name: tender_board_decisions tender_board_decisions_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_board_decisions
    ADD CONSTRAINT tender_board_decisions_pkey PRIMARY KEY (decision_id);


--
-- Name: tender_documents tender_documents_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_documents
    ADD CONSTRAINT tender_documents_pkey PRIMARY KEY (document_id);


--
-- Name: tender_evaluation_financial_scores tender_evaluation_financial_scores_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_financial_scores
    ADD CONSTRAINT tender_evaluation_financial_scores_pkey PRIMARY KEY (score_id);


--
-- Name: tender_evaluation_technical_scores tender_evaluation_technical_scores_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_technical_scores
    ADD CONSTRAINT tender_evaluation_technical_scores_pkey PRIMARY KEY (score_id);


--
-- Name: tenders tenders_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tenders
    ADD CONSTRAINT tenders_pkey PRIMARY KEY (tender_id);


--
-- Name: tender_evaluation_financial_scores uq_financial_scores_tender_bid_evaluator; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_financial_scores
    ADD CONSTRAINT uq_financial_scores_tender_bid_evaluator UNIQUE (tender_id, bid_id, evaluator_email);


--
-- Name: planning_committee_member_reviews uq_member_review_req_role_user_round; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT uq_member_review_req_role_user_round UNIQUE (requisition_id, reviewer_role, reviewer_user_id, review_round);


--
-- Name: planning_committee_member_status uq_member_status_req_role; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT uq_member_status_req_role UNIQUE (requisition_id, role_key);


--
-- Name: planning_committee_decisions uq_planning_committee_decisions_requisition; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT uq_planning_committee_decisions_requisition UNIQUE (requisition_id);


--
-- Name: tender_evaluation_technical_scores uq_technical_scores_tender_bid_evaluator; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_technical_scores
    ADD CONSTRAINT uq_technical_scores_tender_bid_evaluator UNIQUE (tender_id, bid_id, evaluator_email);


--
-- Name: procurement_plan_cycles ux_procurement_plan_cycles_fiscal_cycle_code; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_cycles
    ADD CONSTRAINT ux_procurement_plan_cycles_fiscal_cycle_code UNIQUE (fiscal_year, cycle_code);


--
-- Name: workflow_instance_history workflow_instance_history_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instance_history
    ADD CONSTRAINT workflow_instance_history_pkey PRIMARY KEY (history_id);


--
-- Name: workflow_instances workflow_instances_entity_ux; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instances
    ADD CONSTRAINT workflow_instances_entity_ux UNIQUE (entity_type, entity_id);


--
-- Name: workflow_instances workflow_instances_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instances
    ADD CONSTRAINT workflow_instances_pkey PRIMARY KEY (instance_id);


--
-- Name: workflow_role_tasks workflow_role_tasks_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_role_tasks
    ADD CONSTRAINT workflow_role_tasks_pkey PRIMARY KEY (role_task_id);


--
-- Name: workflow_stage_catalog workflow_stage_catalog_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_stage_catalog
    ADD CONSTRAINT workflow_stage_catalog_pkey PRIMARY KEY (stage_id);


--
-- Name: workflow_stage_catalog workflow_stage_catalog_stage_key_key; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_stage_catalog
    ADD CONSTRAINT workflow_stage_catalog_stage_key_key UNIQUE (stage_key);


--
-- Name: workflow_stage_transitions workflow_stage_transitions_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_stage_transitions
    ADD CONSTRAINT workflow_stage_transitions_pkey PRIMARY KEY (transition_id);


--
-- Name: yearly_apps yearly_apps_fiscal_year_ux; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.yearly_apps
    ADD CONSTRAINT yearly_apps_fiscal_year_ux UNIQUE (fiscal_year);


--
-- Name: yearly_apps yearly_apps_pkey; Type: CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.yearly_apps
    ADD CONSTRAINT yearly_apps_pkey PRIMARY KEY (yearly_app_id);


--
-- Name: bid_opening_sessions bid_opening_sessions_pkey; Type: CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.bid_opening_sessions
    ADD CONSTRAINT bid_opening_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: bids bids_pkey; Type: CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.bids
    ADD CONSTRAINT bids_pkey PRIMARY KEY (bid_id);


--
-- Name: bids bids_tender_vendor_unique; Type: CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.bids
    ADD CONSTRAINT bids_tender_vendor_unique UNIQUE (tender_id, vendor_id);


--
-- Name: compliance_documents compliance_documents_pkey; Type: CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.compliance_documents
    ADD CONSTRAINT compliance_documents_pkey PRIMARY KEY (document_id);


--
-- Name: tenders tenders_pkey; Type: CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.tenders
    ADD CONSTRAINT tenders_pkey PRIMARY KEY (tender_id);


--
-- Name: compliance_document_history_vendor_idx; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX compliance_document_history_vendor_idx ON identity.compliance_document_history USING btree (vendor_id, document_type, created_at DESC);


--
-- Name: ix_internal_module_grant_audit_changed_at; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_internal_module_grant_audit_changed_at ON identity.internal_module_grant_audit USING btree (changed_at DESC);


--
-- Name: ix_internal_module_grant_audit_role; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_internal_module_grant_audit_role ON identity.internal_module_grant_audit USING btree (role_id);


--
-- Name: ix_internal_module_grant_audit_user; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_internal_module_grant_audit_user ON identity.internal_module_grant_audit USING btree (internal_user_id);


--
-- Name: ix_internal_module_grants_module; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_internal_module_grants_module ON identity.internal_module_grants USING btree (module_id);


--
-- Name: ix_internal_users_unit_id; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_internal_users_unit_id ON identity.internal_users USING btree (unit_id);


--
-- Name: ix_organizational_positions_unit_id; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_organizational_positions_unit_id ON identity.organizational_positions USING btree (unit_id);


--
-- Name: ix_organizational_units_parent_unit_id; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_organizational_units_parent_unit_id ON identity.organizational_units USING btree (parent_unit_id);


--
-- Name: ix_vendors_email; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_vendors_email ON identity.vendors USING btree (email);


--
-- Name: ix_vendors_registration_number; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_vendors_registration_number ON identity.vendors USING btree (registration_number);


--
-- Name: ix_vendors_tax_id; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX ix_vendors_tax_id ON identity.vendors USING btree (tax_id);


--
-- Name: ux_internal_module_grants_role; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX ux_internal_module_grants_role ON identity.internal_module_grants USING btree (role_id, module_id) WHERE (role_id IS NOT NULL);


--
-- Name: ux_internal_module_grants_user; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX ux_internal_module_grants_user ON identity.internal_module_grants USING btree (internal_user_id, module_id) WHERE (internal_user_id IS NOT NULL);


--
-- Name: ux_internal_users_service_number_lower; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX ux_internal_users_service_number_lower ON identity.internal_users USING btree (lower((service_number)::text));


--
-- Name: ux_internal_users_username_lower; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX ux_internal_users_username_lower ON identity.internal_users USING btree (lower((username)::text));


--
-- Name: ux_organizational_units_name_ci; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX ux_organizational_units_name_ci ON identity.organizational_units USING btree (lower((unit_name)::text));


--
-- Name: contract_milestones_contract_idx; Type: INDEX; Schema: post_award; Owner: -
--

CREATE INDEX contract_milestones_contract_idx ON post_award.contract_milestones USING btree (contract_code, recorded_at DESC);


--
-- Name: idx_payments_contract_code; Type: INDEX; Schema: post_award; Owner: -
--

CREATE INDEX idx_payments_contract_code ON post_award.payments USING btree (contract_code, payment_date DESC);


--
-- Name: approval_thresholds_governance_body_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX approval_thresholds_governance_body_idx ON procurement_workflow.approval_thresholds USING btree (governance_body_id, status);


--
-- Name: approval_thresholds_lookup_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX approval_thresholds_lookup_idx ON procurement_workflow.approval_thresholds USING btree (procurement_type, min_amount, max_amount, status);


--
-- Name: bpp_no_objections_requisition_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX bpp_no_objections_requisition_idx ON procurement_workflow.bpp_no_objections USING btree (requisition_id);


--
-- Name: bpp_no_objections_status_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX bpp_no_objections_status_idx ON procurement_workflow.bpp_no_objections USING btree (status);


--
-- Name: bpp_no_objections_tender_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX bpp_no_objections_tender_idx ON procurement_workflow.bpp_no_objections USING btree (tender_id);


--
-- Name: budget_appropriations_lookup_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX budget_appropriations_lookup_idx ON procurement_workflow.budget_appropriations USING btree (fiscal_year, department, budget_code, status);


--
-- Name: budget_commitments_appropriation_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX budget_commitments_appropriation_idx ON procurement_workflow.budget_commitments USING btree (appropriation_id);


--
-- Name: budget_commitments_lookup_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX budget_commitments_lookup_idx ON procurement_workflow.budget_commitments USING btree (fiscal_year, department, budget_code, status);


--
-- Name: budget_commitments_requisition_active_ux; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE UNIQUE INDEX budget_commitments_requisition_active_ux ON procurement_workflow.budget_commitments USING btree (requisition_id) WHERE ((requisition_id IS NOT NULL) AND ((status)::text = ANY ((ARRAY['Reserved'::character varying, 'Committed'::character varying])::text[])));


--
-- Name: budget_commitments_tender_active_ux; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE UNIQUE INDEX budget_commitments_tender_active_ux ON procurement_workflow.budget_commitments USING btree (tender_id) WHERE ((tender_id IS NOT NULL) AND ((status)::text = ANY ((ARRAY['Reserved'::character varying, 'Committed'::character varying])::text[])));


--
-- Name: budget_releases_appropriation_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX budget_releases_appropriation_idx ON procurement_workflow.budget_releases USING btree (appropriation_id);


--
-- Name: idx_evaluation_actions_tender; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_evaluation_actions_tender ON procurement_workflow.evaluation_actions USING btree (tender_id);


--
-- Name: idx_evaluation_actions_type; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_evaluation_actions_type ON procurement_workflow.evaluation_actions USING btree (action_type);


--
-- Name: idx_member_review_plan; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_member_review_plan ON procurement_workflow.planning_committee_member_reviews USING btree (plan_id);


--
-- Name: idx_member_review_requisition; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_member_review_requisition ON procurement_workflow.planning_committee_member_reviews USING btree (requisition_id);


--
-- Name: idx_member_status_requisition; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_member_status_requisition ON procurement_workflow.planning_committee_member_status USING btree (requisition_id);


--
-- Name: idx_procurement_closeouts_status; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_procurement_closeouts_status ON procurement_workflow.procurement_closeouts USING btree (status, archived_at DESC);


--
-- Name: idx_procurement_complaints_entity; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_procurement_complaints_entity ON procurement_workflow.procurement_complaints USING btree (entity_type, entity_id, filed_at DESC);


--
-- Name: idx_procurement_complaints_status; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_procurement_complaints_status ON procurement_workflow.procurement_complaints USING btree (status, filed_at DESC);


--
-- Name: idx_procurement_plans_yearly_app; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_procurement_plans_yearly_app ON procurement_workflow.procurement_plans USING btree (yearly_app_id);


--
-- Name: idx_workflow_instance_history_instance; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_workflow_instance_history_instance ON procurement_workflow.workflow_instance_history USING btree (instance_id, created_at DESC);


--
-- Name: idx_workflow_instances_parent; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_workflow_instances_parent ON procurement_workflow.workflow_instances USING btree (parent_entity_type, parent_entity_id);


--
-- Name: idx_workflow_instances_stage; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_workflow_instances_stage ON procurement_workflow.workflow_instances USING btree (current_stage_key, entity_type);


--
-- Name: idx_workflow_role_tasks_role_stage; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_workflow_role_tasks_role_stage ON procurement_workflow.workflow_role_tasks USING btree (role_key, stage_key);


--
-- Name: idx_workflow_stage_catalog_phase_sequence; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_workflow_stage_catalog_phase_sequence ON procurement_workflow.workflow_stage_catalog USING btree (phase_key, sequence_no);


--
-- Name: idx_workflow_stage_transitions_from_stage; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX idx_workflow_stage_transitions_from_stage ON procurement_workflow.workflow_stage_transitions USING btree (from_stage_key);


--
-- Name: ix_bids_tender_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_bids_tender_id ON procurement_workflow.bids USING btree (tender_id);


--
-- Name: ix_bids_vendor_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_bids_vendor_id ON procurement_workflow.bids USING btree (vendor_id);


--
-- Name: ix_financial_scores_bid_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_financial_scores_bid_id ON procurement_workflow.tender_evaluation_financial_scores USING btree (bid_id);


--
-- Name: ix_financial_scores_tender_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_financial_scores_tender_id ON procurement_workflow.tender_evaluation_financial_scores USING btree (tender_id);


--
-- Name: ix_governance_body_memberships_body_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_governance_body_memberships_body_id ON procurement_workflow.governance_body_memberships USING btree (body_id, is_active, voting_order);


--
-- Name: ix_internal_requisitions_app_reference; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_internal_requisitions_app_reference ON procurement_workflow.internal_requisitions USING btree (app_reference);


--
-- Name: ix_internal_requisitions_budget_code; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_internal_requisitions_budget_code ON procurement_workflow.internal_requisitions USING btree (budget_code);


--
-- Name: ix_planning_committee_plan_links_plan_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_planning_committee_plan_links_plan_id ON procurement_workflow.planning_committee_plan_links USING btree (plan_id);


--
-- Name: ix_procurement_plan_items_budget_code; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_procurement_plan_items_budget_code ON procurement_workflow.procurement_plan_items USING btree (budget_code);


--
-- Name: ix_procurement_plan_items_plan_cycle_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_procurement_plan_items_plan_cycle_id ON procurement_workflow.procurement_plan_items USING btree (plan_cycle_id);


--
-- Name: ix_requisition_approval_tasks_requisition; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_requisition_approval_tasks_requisition ON procurement_workflow.requisition_approval_tasks USING btree (requisition_id, sequence);


--
-- Name: ix_requisition_approval_tasks_status_role; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_requisition_approval_tasks_status_role ON procurement_workflow.requisition_approval_tasks USING btree (status, required_role, due_at);


--
-- Name: ix_requisition_audit_events_requisition; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_requisition_audit_events_requisition ON procurement_workflow.requisition_audit_events USING btree (requisition_id, occurred_at DESC);


--
-- Name: ix_requisitions_unit_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_requisitions_unit_id ON procurement_workflow.requisitions USING btree (unit_id);


--
-- Name: ix_technical_scores_bid_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_technical_scores_bid_id ON procurement_workflow.tender_evaluation_technical_scores USING btree (bid_id);


--
-- Name: ix_technical_scores_tender_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_technical_scores_tender_id ON procurement_workflow.tender_evaluation_technical_scores USING btree (tender_id);


--
-- Name: ix_tender_board_decisions_tender_id_decided_at; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_tender_board_decisions_tender_id_decided_at ON procurement_workflow.tender_board_decisions USING btree (tender_id, decided_at DESC);


--
-- Name: ix_tender_documents_tender_id; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_tender_documents_tender_id ON procurement_workflow.tender_documents USING btree (tender_id);


--
-- Name: ix_tenders_status_deadline; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX ix_tenders_status_deadline ON procurement_workflow.tenders USING btree (status, submission_deadline);


--
-- Name: procurement_plan_items_budget_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX procurement_plan_items_budget_idx ON procurement_workflow.procurement_plan_items USING btree (budget_code);


--
-- Name: procurement_plan_items_code_ux; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE UNIQUE INDEX procurement_plan_items_code_ux ON procurement_workflow.procurement_plan_items USING btree (plan_id, item_code) WHERE (item_code IS NOT NULL);


--
-- Name: procurement_plan_items_plan_idx; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE INDEX procurement_plan_items_plan_idx ON procurement_workflow.procurement_plan_items USING btree (plan_id);


--
-- Name: procurement_plan_items_unique_detail_ux; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE UNIQUE INDEX procurement_plan_items_unique_detail_ux ON procurement_workflow.procurement_plan_items USING btree (plan_id, lower(TRIM(BOTH FROM description)), lower(TRIM(BOTH FROM budget_code)), lower(TRIM(BOTH FROM COALESCE(procurement_type, ''::character varying))));


--
-- Name: procurement_plans_unique_title_ux; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE UNIQUE INDEX procurement_plans_unique_title_ux ON procurement_workflow.procurement_plans USING btree (lower(TRIM(BOTH FROM plan_title)), lower(TRIM(BOTH FROM department)), fiscal_year);


--
-- Name: requisitions_app_item_id_ux; Type: INDEX; Schema: procurement_workflow; Owner: -
--

CREATE UNIQUE INDEX requisitions_app_item_id_ux ON procurement_workflow.requisitions USING btree (app_item_id) WHERE (app_item_id IS NOT NULL);


--
-- Name: ix_compliance_documents_vendor_id; Type: INDEX; Schema: vendor_sourcing; Owner: -
--

CREATE INDEX ix_compliance_documents_vendor_id ON vendor_sourcing.compliance_documents USING btree (vendor_id);


--
-- Name: compliance_document_history compliance_document_history_vendor_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.compliance_document_history
    ADD CONSTRAINT compliance_document_history_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE;


--
-- Name: compliance_documents compliance_documents_vendor_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.compliance_documents
    ADD CONSTRAINT compliance_documents_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE;


--
-- Name: internal_module_grant_audit internal_module_grant_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grant_audit
    ADD CONSTRAINT internal_module_grant_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL;


--
-- Name: internal_module_grant_audit internal_module_grant_audit_internal_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grant_audit
    ADD CONSTRAINT internal_module_grant_audit_internal_user_id_fkey FOREIGN KEY (internal_user_id) REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL;


--
-- Name: internal_module_grant_audit internal_module_grant_audit_role_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grant_audit
    ADD CONSTRAINT internal_module_grant_audit_role_id_fkey FOREIGN KEY (role_id) REFERENCES identity.roles(role_id) ON DELETE SET NULL;


--
-- Name: internal_module_grants internal_module_grants_internal_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grants
    ADD CONSTRAINT internal_module_grants_internal_user_id_fkey FOREIGN KEY (internal_user_id) REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE;


--
-- Name: internal_module_grants internal_module_grants_role_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grants
    ADD CONSTRAINT internal_module_grants_role_id_fkey FOREIGN KEY (role_id) REFERENCES identity.roles(role_id) ON DELETE CASCADE;


--
-- Name: internal_module_grants internal_module_grants_updated_by_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_module_grants
    ADD CONSTRAINT internal_module_grants_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL;


--
-- Name: internal_users internal_users_role_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_users
    ADD CONSTRAINT internal_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES identity.roles(role_id);


--
-- Name: internal_users internal_users_unit_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.internal_users
    ADD CONSTRAINT internal_users_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL;


--
-- Name: organizational_positions organizational_positions_reports_to_position_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_positions
    ADD CONSTRAINT organizational_positions_reports_to_position_id_fkey FOREIGN KEY (reports_to_position_id) REFERENCES identity.organizational_positions(position_id) ON DELETE SET NULL;


--
-- Name: organizational_positions organizational_positions_unit_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_positions
    ADD CONSTRAINT organizational_positions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL;


--
-- Name: organizational_units organizational_units_parent_unit_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.organizational_units
    ADD CONSTRAINT organizational_units_parent_unit_id_fkey FOREIGN KEY (parent_unit_id) REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL;


--
-- Name: user_login_security user_login_security_internal_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_login_security
    ADD CONSTRAINT user_login_security_internal_user_id_fkey FOREIGN KEY (internal_user_id) REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE;


--
-- Name: contract_milestones contract_milestones_contract_code_fkey; Type: FK CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.contract_milestones
    ADD CONSTRAINT contract_milestones_contract_code_fkey FOREIGN KEY (contract_code) REFERENCES post_award.contracts(contract_code) ON DELETE CASCADE;


--
-- Name: payments fk_payments_contract; Type: FK CONSTRAINT; Schema: post_award; Owner: -
--

ALTER TABLE ONLY post_award.payments
    ADD CONSTRAINT fk_payments_contract FOREIGN KEY (contract_code) REFERENCES post_award.contracts(contract_code) ON DELETE RESTRICT;


--
-- Name: approval_thresholds approval_thresholds_governance_body_fk; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.approval_thresholds
    ADD CONSTRAINT approval_thresholds_governance_body_fk FOREIGN KEY (governance_body_id) REFERENCES procurement_workflow.governance_bodies(body_id) ON DELETE SET NULL;


--
-- Name: bpp_no_objections bpp_no_objections_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.bpp_no_objections
    ADD CONSTRAINT bpp_no_objections_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE SET NULL;


--
-- Name: bpp_no_objections bpp_no_objections_tender_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.bpp_no_objections
    ADD CONSTRAINT bpp_no_objections_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE SET NULL;


--
-- Name: budget_commitments budget_commitments_appropriation_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_commitments
    ADD CONSTRAINT budget_commitments_appropriation_id_fkey FOREIGN KEY (appropriation_id) REFERENCES procurement_workflow.budget_appropriations(appropriation_id);


--
-- Name: budget_commitments budget_commitments_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_commitments
    ADD CONSTRAINT budget_commitments_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE SET NULL;


--
-- Name: budget_commitments budget_commitments_tender_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_commitments
    ADD CONSTRAINT budget_commitments_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE SET NULL;


--
-- Name: budget_expenditures budget_expenditures_commitment_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_expenditures
    ADD CONSTRAINT budget_expenditures_commitment_id_fkey FOREIGN KEY (commitment_id) REFERENCES procurement_workflow.budget_commitments(commitment_id) ON DELETE CASCADE;


--
-- Name: budget_releases budget_releases_appropriation_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.budget_releases
    ADD CONSTRAINT budget_releases_appropriation_id_fkey FOREIGN KEY (appropriation_id) REFERENCES procurement_workflow.budget_appropriations(appropriation_id) ON DELETE CASCADE;


--
-- Name: bids fk_bids_tenders; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.bids
    ADD CONSTRAINT fk_bids_tenders FOREIGN KEY (tender_id) REFERENCES procurement_workflow.tenders(tender_id);


--
-- Name: bids fk_bids_vendors; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.bids
    ADD CONSTRAINT fk_bids_vendors FOREIGN KEY (vendor_id) REFERENCES identity.vendors(vendor_id);


--
-- Name: planning_committee_decisions fk_committee_decision_plan; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT fk_committee_decision_plan FOREIGN KEY (plan_id) REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE;


--
-- Name: planning_committee_decisions fk_committee_decision_requisition; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT fk_committee_decision_requisition FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: planning_committee_member_reviews fk_member_review_plan; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT fk_member_review_plan FOREIGN KEY (plan_id) REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE;


--
-- Name: planning_committee_member_reviews fk_member_review_requisition; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT fk_member_review_requisition FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: planning_committee_member_status fk_member_status_requisition; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT fk_member_status_requisition FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: procurement_complaints fk_procurement_complaints_resolution_stage; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_complaints
    ADD CONSTRAINT fk_procurement_complaints_resolution_stage FOREIGN KEY (resolution_stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE SET NULL;


--
-- Name: procurement_complaints fk_procurement_complaints_stage; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_complaints
    ADD CONSTRAINT fk_procurement_complaints_stage FOREIGN KEY (stage_key_at_filing) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE RESTRICT;


--
-- Name: procurement_plans fk_procurement_plans_yearly_app; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plans
    ADD CONSTRAINT fk_procurement_plans_yearly_app FOREIGN KEY (yearly_app_id) REFERENCES procurement_workflow.yearly_apps(yearly_app_id) ON DELETE RESTRICT;


--
-- Name: tenders fk_tenders_awarded_bid; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tenders
    ADD CONSTRAINT fk_tenders_awarded_bid FOREIGN KEY (awarded_bid_id) REFERENCES procurement_workflow.bids(bid_id) ON DELETE SET NULL;


--
-- Name: tenders fk_tenders_awarded_vendor; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tenders
    ADD CONSTRAINT fk_tenders_awarded_vendor FOREIGN KEY (awarded_vendor_id) REFERENCES identity.vendors(vendor_id) ON DELETE SET NULL;


--
-- Name: workflow_instance_history fk_workflow_history_from_stage; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instance_history
    ADD CONSTRAINT fk_workflow_history_from_stage FOREIGN KEY (from_stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE SET NULL;


--
-- Name: workflow_instance_history fk_workflow_history_instance; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instance_history
    ADD CONSTRAINT fk_workflow_history_instance FOREIGN KEY (instance_id) REFERENCES procurement_workflow.workflow_instances(instance_id) ON DELETE CASCADE;


--
-- Name: workflow_instance_history fk_workflow_history_to_stage; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instance_history
    ADD CONSTRAINT fk_workflow_history_to_stage FOREIGN KEY (to_stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE RESTRICT;


--
-- Name: workflow_instances fk_workflow_instances_stage; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instances
    ADD CONSTRAINT fk_workflow_instances_stage FOREIGN KEY (current_stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE RESTRICT;


--
-- Name: workflow_instances fk_workflow_instances_threshold; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_instances
    ADD CONSTRAINT fk_workflow_instances_threshold FOREIGN KEY (threshold_id) REFERENCES procurement_workflow.approval_thresholds(threshold_id) ON DELETE SET NULL;


--
-- Name: workflow_role_tasks fk_workflow_role_tasks_stage; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_role_tasks
    ADD CONSTRAINT fk_workflow_role_tasks_stage FOREIGN KEY (stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE CASCADE;


--
-- Name: workflow_stage_transitions fk_workflow_transition_from; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_stage_transitions
    ADD CONSTRAINT fk_workflow_transition_from FOREIGN KEY (from_stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE CASCADE;


--
-- Name: workflow_stage_transitions fk_workflow_transition_to; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.workflow_stage_transitions
    ADD CONSTRAINT fk_workflow_transition_to FOREIGN KEY (to_stage_key) REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE CASCADE;


--
-- Name: governance_body_memberships governance_body_memberships_body_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.governance_body_memberships
    ADD CONSTRAINT governance_body_memberships_body_id_fkey FOREIGN KEY (body_id) REFERENCES procurement_workflow.governance_bodies(body_id) ON DELETE CASCADE;


--
-- Name: governance_body_memberships governance_body_memberships_position_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.governance_body_memberships
    ADD CONSTRAINT governance_body_memberships_position_id_fkey FOREIGN KEY (position_id) REFERENCES identity.organizational_positions(position_id) ON DELETE CASCADE;


--
-- Name: planning_committee_configuration planning_committee_configuration_chairman_internal_user_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_configuration
    ADD CONSTRAINT planning_committee_configuration_chairman_internal_user_id_fkey FOREIGN KEY (chairman_internal_user_id) REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL;


--
-- Name: planning_committee_member_status planning_committee_member_status_plan_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT planning_committee_member_status_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE;


--
-- Name: planning_committee_plan_links planning_committee_plan_links_plan_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_plan_links
    ADD CONSTRAINT planning_committee_plan_links_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE;


--
-- Name: planning_committee_plan_links planning_committee_plan_links_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.planning_committee_plan_links
    ADD CONSTRAINT planning_committee_plan_links_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: procurement_plan_items procurement_plan_items_budget_code_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_items
    ADD CONSTRAINT procurement_plan_items_budget_code_fkey FOREIGN KEY (budget_code) REFERENCES procurement_workflow.budget_lines(budget_code);


--
-- Name: procurement_plan_items procurement_plan_items_plan_cycle_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_items
    ADD CONSTRAINT procurement_plan_items_plan_cycle_id_fkey FOREIGN KEY (plan_cycle_id) REFERENCES procurement_workflow.procurement_plan_cycles(plan_cycle_id);


--
-- Name: procurement_plan_items procurement_plan_items_plan_fk; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.procurement_plan_items
    ADD CONSTRAINT procurement_plan_items_plan_fk FOREIGN KEY (plan_id) REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE;


--
-- Name: requisition_app_unlinks requisition_app_unlinks_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_app_unlinks
    ADD CONSTRAINT requisition_app_unlinks_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: requisition_approval_tasks requisition_approval_tasks_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_approval_tasks
    ADD CONSTRAINT requisition_approval_tasks_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.internal_requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: requisition_audit_events requisition_audit_events_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_audit_events
    ADD CONSTRAINT requisition_audit_events_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.internal_requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: requisition_line_items requisition_line_items_requisition_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisition_line_items
    ADD CONSTRAINT requisition_line_items_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE;


--
-- Name: requisitions requisitions_app_item_fk; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisitions
    ADD CONSTRAINT requisitions_app_item_fk FOREIGN KEY (app_item_id) REFERENCES procurement_workflow.procurement_plan_items(plan_item_id) ON DELETE SET NULL;


--
-- Name: requisitions requisitions_unit_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.requisitions
    ADD CONSTRAINT requisitions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL;


--
-- Name: tender_board_decisions tender_board_decisions_recommended_bid_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_board_decisions
    ADD CONSTRAINT tender_board_decisions_recommended_bid_id_fkey FOREIGN KEY (recommended_bid_id) REFERENCES procurement_workflow.bids(bid_id) ON DELETE SET NULL;


--
-- Name: tender_board_decisions tender_board_decisions_recommended_vendor_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_board_decisions
    ADD CONSTRAINT tender_board_decisions_recommended_vendor_id_fkey FOREIGN KEY (recommended_vendor_id) REFERENCES identity.vendors(vendor_id) ON DELETE SET NULL;


--
-- Name: tender_board_decisions tender_board_decisions_tender_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_board_decisions
    ADD CONSTRAINT tender_board_decisions_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES procurement_workflow.tenders(tender_id) ON DELETE CASCADE;


--
-- Name: tender_documents tender_documents_tender_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_documents
    ADD CONSTRAINT tender_documents_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES procurement_workflow.tenders(tender_id) ON DELETE CASCADE;


--
-- Name: tender_evaluation_assignments tender_evaluation_assignments_internal_user_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_assignments
    ADD CONSTRAINT tender_evaluation_assignments_internal_user_id_fkey FOREIGN KEY (internal_user_id) REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL;


--
-- Name: tender_evaluation_financial_scores tender_evaluation_financial_scores_bid_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_financial_scores
    ADD CONSTRAINT tender_evaluation_financial_scores_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES procurement_workflow.bids(bid_id) ON DELETE CASCADE;


--
-- Name: tender_evaluation_financial_scores tender_evaluation_financial_scores_tender_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_financial_scores
    ADD CONSTRAINT tender_evaluation_financial_scores_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES procurement_workflow.tenders(tender_id) ON DELETE CASCADE;


--
-- Name: tender_evaluation_technical_scores tender_evaluation_technical_scores_bid_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_technical_scores
    ADD CONSTRAINT tender_evaluation_technical_scores_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES procurement_workflow.bids(bid_id) ON DELETE CASCADE;


--
-- Name: tender_evaluation_technical_scores tender_evaluation_technical_scores_tender_id_fkey; Type: FK CONSTRAINT; Schema: procurement_workflow; Owner: -
--

ALTER TABLE ONLY procurement_workflow.tender_evaluation_technical_scores
    ADD CONSTRAINT tender_evaluation_technical_scores_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES procurement_workflow.tenders(tender_id) ON DELETE CASCADE;


--
-- Name: bid_opening_sessions bid_opening_sessions_tender_id_fkey; Type: FK CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.bid_opening_sessions
    ADD CONSTRAINT bid_opening_sessions_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE CASCADE;


--
-- Name: bids bids_tender_id_fkey; Type: FK CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.bids
    ADD CONSTRAINT bids_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE CASCADE;


--
-- Name: bids bids_vendor_id_fkey; Type: FK CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.bids
    ADD CONSTRAINT bids_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE;


--
-- Name: compliance_documents fk_compliance_documents_vendors; Type: FK CONSTRAINT; Schema: vendor_sourcing; Owner: -
--

ALTER TABLE ONLY vendor_sourcing.compliance_documents
    ADD CONSTRAINT fk_compliance_documents_vendors FOREIGN KEY (vendor_id) REFERENCES identity.vendors(vendor_id);


--
-- PostgreSQL database dump complete
--

\unrestrict vINDmwy9D46dp7MnOXGoUm7Qjb7G9k3rN3W4bkzZYH1glRICjwbrHGZdbDdZt3S

