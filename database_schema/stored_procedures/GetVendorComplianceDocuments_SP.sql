-- Function for Getting Vendor Compliance Documents (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.get_vendor_compliance_documents(
    p_vendor_id UUID
)
RETURNS TABLE (
    document_id UUID,
    vendor_id UUID,
    document_type VARCHAR(100),
    document_url TEXT,
    expiry_date DATE,
    verification_status VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.document_id,
        cd.vendor_id,
        cd.document_type,
        cd.document_url,
        cd.expiry_date,
        cd.verification_status,
        cd.created_at
    FROM
        identity.compliance_documents cd
    WHERE
        cd.vendor_id = p_vendor_id
    ORDER BY
        cd.created_at DESC;
END;
$$;

-- Procedure wrapper for get_vendor_compliance_documents (PostgreSQL)
CREATE OR REPLACE PROCEDURE identity.get_vendor_compliance_documents_sp(
    IN p_vendor_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_compliance_documents(p_vendor_id);
END;
$$;
