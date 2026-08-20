-- Migration 155: Fix upload_compliance_document SP
-- Issues fixed:
--   1. Ambiguous column reference (vendor_id) in EXISTS subquery
--   2. History INSERT happens AFTER update — logs new values, not old ones
--   3. History table missing document_content — can't recover replaced files
--   4. History table missing rejection_reason, verified_by, verified_at

-- 1. Add columns to history table so it captures the full old document state
ALTER TABLE identity.compliance_document_history
  ADD COLUMN IF NOT EXISTS document_content TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 2. Drop and recreate the SP
DROP FUNCTION IF EXISTS identity.upload_compliance_document(UUID, VARCHAR, TEXT, DATE, VARCHAR, TEXT);
DROP PROCEDURE IF EXISTS identity.upload_compliance_document_sp(UUID, VARCHAR, TEXT, DATE, refcursor);

CREATE OR REPLACE FUNCTION identity.upload_compliance_document(
    p_vendor_id UUID,
    p_document_type VARCHAR(100),
    p_document_url TEXT,
    p_expiry_date DATE DEFAULT NULL,
    p_file_name VARCHAR(255) DEFAULT NULL,
    p_file_content TEXT DEFAULT NULL
)
RETURNS TABLE (
    document_id UUID,
    vendor_id UUID,
    document_type VARCHAR(100),
    document_url TEXT,
    verification_status VARCHAR(50),
    file_name VARCHAR(255),
    document_content TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_document_id UUID;
    v_vendor_id UUID;
    v_document_type VARCHAR(100);
    v_document_url TEXT;
    v_status VARCHAR(50);
    v_created_at TIMESTAMPTZ;
BEGIN
    IF EXISTS (
        SELECT 1 FROM identity.compliance_documents cd
        WHERE cd.vendor_id = p_vendor_id AND cd.document_type = p_document_type
    ) THEN
        INSERT INTO identity.compliance_document_history (
            document_id, vendor_id, document_type, document_url,
            expiry_date, verification_status, file_name,
            document_content, rejection_reason, verified_by, verified_at,
            created_at
        )
        SELECT
            d.document_id, d.vendor_id, d.document_type, d.document_url,
            d.expiry_date, d.verification_status, d.file_name,
            d.document_content, d.rejection_reason, d.verified_by, d.verified_at,
            NOW()
        FROM identity.compliance_documents d
        WHERE d.vendor_id = p_vendor_id AND d.document_type = p_document_type;

        UPDATE identity.compliance_documents cd2
        SET
            document_url = p_document_url,
            expiry_date = p_expiry_date,
            verification_status = 'Pending',
            verified_by = NULL,
            verified_at = NULL,
            rejection_reason = NULL,
            file_name = COALESCE(p_file_name, cd2.file_name),
            document_content = COALESCE(p_file_content, cd2.document_content),
            updated_at = NOW()
        WHERE cd2.vendor_id = p_vendor_id AND cd2.document_type = p_document_type
        RETURNING cd2.document_id,
                  cd2.vendor_id,
                  cd2.document_type,
                  cd2.document_url,
                  cd2.verification_status,
                  cd2.file_name,
                  cd2.document_content,
                  cd2.created_at
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status,
             p_file_name, p_file_content, v_created_at;
    ELSE
        INSERT INTO identity.compliance_documents (
            vendor_id, document_type, document_url, expiry_date,
            verification_status, file_name, document_content
        ) VALUES (
            p_vendor_id, p_document_type, p_document_url, p_expiry_date,
            'Pending', p_file_name, p_file_content
        )
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status,
                  compliance_documents.file_name,
                  compliance_documents.document_content,
                  compliance_documents.created_at
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status,
             p_file_name, p_file_content, v_created_at;

        INSERT INTO identity.compliance_document_history (
            document_id, vendor_id, document_type, document_url,
            expiry_date, verification_status, file_name,
            document_content, rejection_reason, verified_by, verified_at,
            created_at
        ) VALUES (
            v_document_id, v_vendor_id, v_document_type, v_document_url,
            p_expiry_date, v_status, p_file_name,
            p_file_content, NULL, NULL, NULL,
            NOW()
        );
    END IF;

    RETURN QUERY SELECT v_document_id, v_vendor_id, v_document_type, v_document_url,
                        v_status, p_file_name, p_file_content, v_created_at;
END;
$$;

-- 3. Update history query to return new columns
DROP FUNCTION IF EXISTS identity.get_vendor_compliance_document_history(UUID, VARCHAR);

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
    created_at TIMESTAMPTZ,
    file_name VARCHAR(255),
    rejection_reason TEXT,
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.history_id, h.document_id, h.document_type, h.document_url,
        h.expiry_date, h.verification_status, h.created_at, h.file_name,
        h.rejection_reason, h.verified_by, h.verified_at
    FROM identity.compliance_document_history h
    WHERE h.vendor_id = p_vendor_id
      AND h.document_type = p_document_type
    ORDER BY h.created_at DESC;
END;
$$;
