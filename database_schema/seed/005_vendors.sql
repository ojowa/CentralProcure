-- Seed Vendors (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
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
    VALUES
        ('Global Supplies Ltd', 'RC123456', 'TIN987654', '123 Business Way, Lagos', 'John Doe', 'vendor1@example.com', v_password_hash, 'Active'),
        ('Tech Solutions Inc', 'RC654321', 'TIN456789', '45 Tech Plaza, Abuja', 'Jane Smith', 'vendor2@example.com', v_password_hash, 'Active')
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        vendor_status = 'Active';
END;
$$;
