-- Migration 012: Fix Identity Vendor Functions/Procedures (PostgreSQL)
BEGIN;

-- Drop vendor functions/procedures to align return types
DROP PROCEDURE IF EXISTS identity.register_vendor_sp(
    VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, refcursor
);
DROP FUNCTION IF EXISTS identity.register_vendor(
    VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR
);

DROP PROCEDURE IF EXISTS identity.login_vendor_sp(VARCHAR, VARCHAR, refcursor);
DROP FUNCTION IF EXISTS identity.login_vendor(VARCHAR, VARCHAR);

DROP PROCEDURE IF EXISTS identity.get_vendor_profile_sp(UUID, refcursor);
DROP FUNCTION IF EXISTS identity.get_vendor_profile(UUID);

DROP PROCEDURE IF EXISTS identity.upload_compliance_document_sp(UUID, VARCHAR, TEXT, DATE, refcursor);
DROP FUNCTION IF EXISTS identity.upload_compliance_document(UUID, VARCHAR, TEXT, DATE);

DROP PROCEDURE IF EXISTS identity.get_vendor_compliance_documents_sp(UUID, refcursor);
DROP FUNCTION IF EXISTS identity.get_vendor_compliance_documents(UUID);

-- Recreate functions and procedures
CREATE OR REPLACE FUNCTION identity.register_vendor(
    p_company_name VARCHAR(255),
    p_registration_number VARCHAR(100),
    p_tax_id VARCHAR(100),
    p_company_address TEXT,
    p_contact_person VARCHAR(255),
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
        p_email,
        p_password_hash
    );
END;
$$;

CREATE OR REPLACE FUNCTION identity.login_vendor(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255)
)
RETURNS TABLE (
    vendor_id UUID,
    company_name VARCHAR(255),
    email VARCHAR(255),
    vendor_status VARCHAR(50),
    error_message TEXT
)
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

CREATE OR REPLACE PROCEDURE identity.login_vendor_sp(
    IN p_email VARCHAR(255),
    IN p_password_hash VARCHAR(255),
    OUT p_result refcursor
)
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

CREATE OR REPLACE FUNCTION identity.upload_compliance_document(
    p_vendor_id UUID,
    p_document_type VARCHAR(100),
    p_document_url TEXT,
    p_expiry_date DATE DEFAULT NULL
)
RETURNS TABLE (
    document_id UUID,
    vendor_id UUID,
    document_type VARCHAR(100),
    document_url TEXT,
    verification_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.compliance_documents WHERE vendor_id = p_vendor_id AND document_type = p_document_type) THEN
        RETURN QUERY
        UPDATE identity.compliance_documents
        SET
            document_url = p_document_url,
            expiry_date = p_expiry_date,
            verification_status = 'Pending',
            verified_by = NULL,
            verified_at = NULL,
            updated_at = NOW()
        WHERE
            vendor_id = p_vendor_id AND document_type = p_document_type
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status;
    ELSE
        RETURN QUERY
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
                  compliance_documents.verification_status;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE identity.upload_compliance_document_sp(
    IN p_vendor_id UUID,
    IN p_document_type VARCHAR(100),
    IN p_document_url TEXT,
    IN p_expiry_date DATE,
    OUT p_result refcursor
)
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

CREATE OR REPLACE FUNCTION identity.get_vendor_compliance_documents(
    p_vendor_id UUID
)
RETURNS TABLE (
    document_id UUID,
    vendor_id UUID,
    document_type VARCHAR(100),
    document_url TEXT,
    expiry_date DATE,
    verification_status VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE
)
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

CREATE OR REPLACE PROCEDURE identity.get_vendor_compliance_documents_sp(
    IN p_vendor_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_compliance_documents(p_vendor_id);
END;
$$;

COMMIT;
