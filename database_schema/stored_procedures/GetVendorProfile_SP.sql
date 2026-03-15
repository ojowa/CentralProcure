-- Function for Getting Vendor Profile (PostgreSQL)
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
    FROM
        identity.vendors v
    WHERE
        v.vendor_id = p_vendor_id;
END;
$$;

-- Procedure wrapper for get_vendor_profile (PostgreSQL)
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
