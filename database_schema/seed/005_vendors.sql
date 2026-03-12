-- Seed Vendors (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123' + 'NIS_EPROC_SUPER_SECRET_PEPPER_2026'
    v_password_hash TEXT := '$2a$12$BS9Cmmeh4buLAz.ICDrPN.7Qd60wL0Abb6e8d3Gn/dYMwMJ3tEmNu'; 
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
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
END;
$$;
