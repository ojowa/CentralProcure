-- Migration 153: Soft-delete vendor accounts
-- Adds delete_vendor() stored procedure and vendor deletion audit table

CREATE TABLE IF NOT EXISTS identity.vendor_deletion_audit (
    deletion_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id     UUID NOT NULL REFERENCES identity.vendors(vendor_id),
    company_name  VARCHAR(255) NOT NULL,
    deleted_by    VARCHAR(255),
    deleted_at    TIMESTAMPTZ DEFAULT now(),
    reason        TEXT
);

CREATE OR REPLACE FUNCTION identity.delete_vendor(
    p_vendor_id UUID,
    p_deleted_by VARCHAR(255),
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_company_name VARCHAR(255);
BEGIN
    SELECT company_name INTO v_company_name
    FROM identity.vendors WHERE vendor_id = p_vendor_id;

    IF v_company_name IS NULL THEN
        RAISE EXCEPTION 'Vendor not found';
    END IF;

    UPDATE identity.vendors
    SET
        vendor_status = 'Deleted',
        is_active = FALSE,
        updated_by = COALESCE(NULLIF(BTRIM(p_deleted_by), ''), CURRENT_USER),
        updated_at = NOW()
    WHERE vendor_id = p_vendor_id;

    INSERT INTO identity.vendor_deletion_audit (vendor_id, company_name, deleted_by, reason)
    VALUES (p_vendor_id, v_company_name, p_deleted_by, p_reason);
END;
$$ LANGUAGE plpgsql;
