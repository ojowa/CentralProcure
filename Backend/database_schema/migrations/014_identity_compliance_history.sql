-- Migration 014: Compliance document history
BEGIN;

CREATE TABLE IF NOT EXISTS identity.compliance_document_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    expiry_date DATE,
    verification_status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_document_history_vendor_idx
    ON identity.compliance_document_history (vendor_id, document_type, created_at DESC);

-- Update upload function to record history
CREATE OR REPLACE FUNCTION identity.upload_compliance_document(
    p_vendor_id UUID,
    p_document_type VARCHAR(100),
    p_document_url TEXT,
    p_expiry_date DATE DEFAULT NULL
)
RETURNS TABLE (
    document_id UUID,
    vendor_id UUID,
    document_type VARCHAR(100),
    document_url TEXT,
    verification_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_document_id UUID;
    v_vendor_id UUID;
    v_document_type VARCHAR(100);
    v_document_url TEXT;
    v_status VARCHAR(50);
BEGIN
    IF EXISTS (
        SELECT 1 FROM identity.compliance_documents
        WHERE vendor_id = p_vendor_id AND document_type = p_document_type
    ) THEN
        UPDATE identity.compliance_documents
        SET
            document_url = p_document_url,
            expiry_date = p_expiry_date,
            verification_status = 'Pending',
            verified_by = NULL,
            verified_at = NULL,
            updated_at = NOW()
        WHERE vendor_id = p_vendor_id AND document_type = p_document_type
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status;
    ELSE
        INSERT INTO identity.compliance_documents (
            vendor_id,
            document_type,
            document_url,
            expiry_date,
            verification_status
        )
        VALUES (
            p_vendor_id,
            p_document_type,
            p_document_url,
            p_expiry_date,
            'Pending'
        )
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status;
    END IF;

    INSERT INTO identity.compliance_document_history (
        document_id,
        vendor_id,
        document_type,
        document_url,
        expiry_date,
        verification_status,
        created_at
    )
    VALUES (
        v_document_id,
        v_vendor_id,
        v_document_type,
        v_document_url,
        p_expiry_date,
        v_status,
        NOW()
    );

    RETURN QUERY SELECT v_document_id, v_vendor_id, v_document_type, v_document_url, v_status;
END;
$$;

CREATE OR REPLACE PROCEDURE identity.upload_compliance_document_sp(
    IN p_vendor_id UUID,
    IN p_document_type VARCHAR(100),
    IN p_document_url TEXT,
    IN p_expiry_date DATE,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.upload_compliance_document(
        p_vendor_id,
        p_document_type,
        p_document_url,
        p_expiry_date
    );
END;
$$;

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

COMMIT;
