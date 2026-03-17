CREATE OR REPLACE FUNCTION identity.approve_vendor_registration(
    p_vendor_id UUID,
    p_vendor_status VARCHAR(50),
    p_updated_by VARCHAR(255),
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
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
