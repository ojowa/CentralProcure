-- Function for Vendor Profile Update (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.update_vendor_profile(
    p_vendor_id UUID,
    p_company_name VARCHAR(255),
    p_company_address TEXT,
    p_contact_person VARCHAR(255),
    p_email VARCHAR(255)
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
    UPDATE identity.vendors v
    SET
        company_name = COALESCE(p_company_name, v.company_name),
        company_address = COALESCE(p_company_address, v.company_address),
        contact_person = COALESCE(p_contact_person, v.contact_person),
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
        v.email,
        v.registration_date,
        v.last_login,
        v.vendor_status;
END;
$$;

-- Procedure wrapper for update_vendor_profile (PostgreSQL)
CREATE OR REPLACE PROCEDURE identity.update_vendor_profile_sp(
    IN p_vendor_id UUID,
    IN p_company_name VARCHAR(255),
    IN p_company_address TEXT,
    IN p_contact_person VARCHAR(255),
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
        p_email
    );
END;
$$;
