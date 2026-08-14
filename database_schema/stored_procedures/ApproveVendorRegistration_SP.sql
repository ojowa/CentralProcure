-- Vendor Registration Approval Stored Procedure (PL/pgSQL)
-- Updated to persist review notes in the vendors table
CREATE OR REPLACE FUNCTION identity.approve_vendor_registration(
    p_vendor_id UUID,
    p_vendor_status VARCHAR(50),
    p_updated_by VARCHAR(255),
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE identity.vendors
    SET
        vendor_status = p_vendor_status,
        is_active = CASE WHEN p_vendor_status = 'Active' THEN TRUE ELSE FALSE END,
        updated_by = COALESCE(NULLIF(BTRIM(p_updated_by), ''), CURRENT_USER),
        updated_at = NOW()
    WHERE vendor_id = p_vendor_id;

    -- Persist review notes if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'identity' AND table_name = 'vendors' AND column_name = 'review_notes'
    ) THEN
        UPDATE identity.vendors SET review_notes = p_notes WHERE vendor_id = p_vendor_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
