BEGIN;

ALTER TABLE identity.vendors
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);

UPDATE identity.vendors
SET
    phone_number = CASE lower(email)
        WHEN 'vendor1@example.com' THEN '+2348012345678'
        WHEN 'vendor2@example.com' THEN '+2348098765432'
        ELSE phone_number
    END,
    updated_at = NOW()
WHERE phone_number IS NULL
   OR lower(email) IN ('vendor1@example.com', 'vendor2@example.com');

DROP PROCEDURE IF EXISTS identity.register_vendor_sp(VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, refcursor);
DROP FUNCTION IF EXISTS identity.register_vendor(VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION identity.register_vendor(
    p_company_name VARCHAR(255),
    p_registration_number VARCHAR(100),
    p_tax_id VARCHAR(100),
    p_company_address TEXT,
    p_contact_person VARCHAR(255),
    p_phone_number VARCHAR(50),
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255)
)
RETURNS TABLE (
    vendor_id UUID,
    company_name VARCHAR(255),
    email VARCHAR(255)
)
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

CREATE OR REPLACE PROCEDURE identity.register_vendor_sp(
    IN p_company_name VARCHAR(255),
    IN p_registration_number VARCHAR(100),
    IN p_tax_id VARCHAR(100),
    IN p_company_address TEXT,
    IN p_contact_person VARCHAR(255),
    IN p_phone_number VARCHAR(50),
    IN p_email VARCHAR(255),
    IN p_password_hash VARCHAR(255),
    OUT p_result refcursor
)
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

DROP PROCEDURE IF EXISTS identity.get_vendor_profile_sp(UUID, refcursor);
DROP FUNCTION IF EXISTS identity.get_vendor_profile(UUID);

CREATE OR REPLACE FUNCTION identity.get_vendor_profile(
    p_vendor_id UUID
)
RETURNS TABLE (
    vendor_id UUID,
    company_name VARCHAR(255),
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    company_address TEXT,
    contact_person VARCHAR(255),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    registration_date TIMESTAMP WITHOUT TIME ZONE,
    last_login TIMESTAMP WITHOUT TIME ZONE,
    vendor_status VARCHAR(50)
)
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

CREATE OR REPLACE PROCEDURE identity.get_vendor_profile_sp(
    IN p_vendor_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_profile(p_vendor_id);
END;
$$;

DROP PROCEDURE IF EXISTS identity.update_vendor_profile_sp(UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, refcursor);
DROP FUNCTION IF EXISTS identity.update_vendor_profile(UUID, VARCHAR, TEXT, VARCHAR, VARCHAR);
DROP PROCEDURE IF EXISTS identity.update_vendor_profile_sp(UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, refcursor);
DROP FUNCTION IF EXISTS identity.update_vendor_profile(UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION identity.update_vendor_profile(
    p_vendor_id UUID,
    p_company_name VARCHAR(255),
    p_company_address TEXT,
    p_contact_person VARCHAR(255),
    p_phone_number VARCHAR(50),
    p_email VARCHAR(255)
)
RETURNS TABLE (
    vendor_id UUID,
    company_name VARCHAR(255),
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    company_address TEXT,
    contact_person VARCHAR(255),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    registration_date TIMESTAMP WITHOUT TIME ZONE,
    last_login TIMESTAMP WITHOUT TIME ZONE,
    vendor_status VARCHAR(50)
)
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

CREATE OR REPLACE PROCEDURE identity.update_vendor_profile_sp(
    IN p_vendor_id UUID,
    IN p_company_name VARCHAR(255),
    IN p_company_address TEXT,
    IN p_contact_person VARCHAR(255),
    IN p_phone_number VARCHAR(50),
    IN p_email VARCHAR(255),
    OUT p_result refcursor
)
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

COMMIT;
