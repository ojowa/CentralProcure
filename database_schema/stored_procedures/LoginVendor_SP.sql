-- Function for Vendor Login (PostgreSQL)
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

-- Procedure wrapper for login_vendor (PostgreSQL)
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
