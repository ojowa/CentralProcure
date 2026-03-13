-- Function for Getting Compliance Document History (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.get_vendor_compliance_document_history(
    p_vendor_id UUID,
    p_document_type VARCHAR(100)
)
RETURNS TABLE (
    history_id UUID,
    document_id UUID,
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
        h.history_id,
        h.document_id,
        h.document_type,
        h.document_url,
        h.expiry_date,
        h.verification_status,
        h.created_at
    FROM identity.compliance_document_history h
    WHERE h.vendor_id = p_vendor_id
      AND h.document_type = p_document_type
    ORDER BY h.created_at DESC;
END;
$$;

-- Procedure wrapper for get_vendor_compliance_document_history (PostgreSQL)
CREATE OR REPLACE PROCEDURE identity.get_vendor_compliance_document_history_sp(
    IN p_vendor_id UUID,
    IN p_document_type VARCHAR(100),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_vendor_compliance_document_history(p_vendor_id, p_document_type);
END;
$$;
