-- Function for Registering a New Vendor (PostgreSQL)
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

-- Procedure wrapper for register_vendor (PostgreSQL)
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
