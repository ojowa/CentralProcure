-- Vendor Registration Approval Stored Procedure (PL/pgSQL)
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
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE vendor_id = p_vendor_id;

    -- Note: If we had a workflow_audit or review_notes table, we would insert p_notes there.
    -- For now, we fulfill the requirement of using a SP for write operations.
END;
$$ LANGUAGE plpgsql;
