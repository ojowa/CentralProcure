-- Migration 146: Vendor approval alignment + audit trail
-- Fixes:
--   1. compliance_documents.file_name column (queried by download endpoints but never created)
--   2. compliance_documents.document_content column (actual file bytes so downloads work end-to-end)
--   3. vendors.review_notes column (written by approve_vendor_registration but never migrated)
--   4. vendor_approval_audit table (audit trail for approve/reject decisions)
--   5. vendor_notifications table (vendor-facing notification on decisions)
--   6. approve_vendor_registration() writes audit + notification rows

BEGIN;

-- 1. compliance_documents.file_name
ALTER TABLE identity.compliance_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
UPDATE identity.compliance_documents
SET file_name = REGEXP_REPLACE(document_url, '^.*/', '')
WHERE file_name IS NULL;

-- 2. compliance_documents.document_content (base64/raw bytes)
ALTER TABLE identity.compliance_documents ADD COLUMN IF NOT EXISTS document_content TEXT;

-- 3. vendors.review_notes
ALTER TABLE identity.vendors ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 4. vendor_approval_audit
CREATE TABLE IF NOT EXISTS identity.vendor_approval_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    prior_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    decided_by VARCHAR(255),
    notes TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vendor_approval_audit_vendor
    ON identity.vendor_approval_audit (vendor_id, decided_at DESC);

-- 5. vendor_notifications
CREATE TABLE IF NOT EXISTS identity.vendor_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'info',
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vendor_notifications_vendor
    ON identity.vendor_notifications (vendor_id, created_at DESC);

-- 6. Rewrite approve_vendor_registration to persist notes, audit, and notify
CREATE OR REPLACE FUNCTION identity.approve_vendor_registration(
    p_vendor_id UUID,
    p_vendor_status VARCHAR(50),
    p_updated_by VARCHAR(255),
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_prior_status VARCHAR(50);
BEGIN
    SELECT vendor_status INTO v_prior_status
    FROM identity.vendors WHERE vendor_id = p_vendor_id;

    UPDATE identity.vendors
    SET
        vendor_status = p_vendor_status,
        is_active = CASE WHEN p_vendor_status = 'Active' THEN TRUE ELSE FALSE END,
        updated_by = COALESCE(NULLIF(BTRIM(p_updated_by), ''), CURRENT_USER),
        updated_at = NOW(),
        review_notes = p_notes
    WHERE vendor_id = p_vendor_id;

    -- Audit trail
    INSERT INTO identity.vendor_approval_audit (
        vendor_id, prior_status, new_status, decided_by, notes
    )
    VALUES (
        p_vendor_id, v_prior_status, p_vendor_status,
        COALESCE(NULLIF(BTRIM(p_updated_by), ''), CURRENT_USER),
        p_notes
    );

    -- Vendor-facing notification
    INSERT INTO identity.vendor_notifications (
        vendor_id, title, message, notification_type, entity_type, entity_id
    )
    VALUES (
        p_vendor_id,
        CASE
            WHEN p_vendor_status = 'Active' THEN 'Registration Approved'
            WHEN p_vendor_status = 'Rejected' THEN 'Registration Rejected'
            ELSE 'Registration Review'
        END,
        CASE
            WHEN p_vendor_status = 'Active' THEN 'Your registration has been approved and your account is now active.'
            WHEN p_vendor_status = 'Rejected' THEN 'Your registration was not approved. Contact procurement for details.'
            ELSE 'Your registration has been returned to pending review.'
        END,
        'vendor_registration',
        'vendor',
        p_vendor_id::text
    );
END;
$$ LANGUAGE plpgsql;

-- 7. Rewrite upload_compliance_document to persist file_name + content
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
    document_content TEXT
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
            file_name = COALESCE(p_file_name, file_name),
            document_content = COALESCE(p_file_content, document_content),
            updated_at = NOW()
        WHERE vendor_id = p_vendor_id AND document_type = p_document_type
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status,
                  compliance_documents.file_name,
                  compliance_documents.document_content
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status,
             p_file_name, p_file_content;
    ELSE
        INSERT INTO identity.compliance_documents (
            vendor_id,
            document_type,
            document_url,
            expiry_date,
            verification_status,
            file_name,
            document_content
        )
        VALUES (
            p_vendor_id,
            p_document_type,
            p_document_url,
            p_expiry_date,
            'Pending',
            p_file_name,
            p_file_content
        )
        RETURNING compliance_documents.document_id,
                  compliance_documents.vendor_id,
                  compliance_documents.document_type,
                  compliance_documents.document_url,
                  compliance_documents.verification_status,
                  compliance_documents.file_name,
                  compliance_documents.document_content
        INTO v_document_id, v_vendor_id, v_document_type, v_document_url, v_status,
             p_file_name, p_file_content;
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

    RETURN QUERY SELECT v_document_id, v_vendor_id, v_document_type, v_document_url,
                        v_status, p_file_name, p_file_content;
END;
$$;

-- 8. get_vendor_compliance_documents should expose file_name
DROP FUNCTION IF EXISTS identity.get_vendor_compliance_documents(UUID);
CREATE OR REPLACE FUNCTION identity.get_vendor_compliance_documents(p_vendor_id UUID)
RETURNS TABLE (
    document_id UUID,
    document_type VARCHAR(100),
    document_url TEXT,
    expiry_date DATE,
    verification_status VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    file_name VARCHAR(255)
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.document_id,
        cd.document_type,
        cd.document_url,
        cd.expiry_date,
        cd.verification_status,
        cd.created_at,
        cd.updated_at,
        cd.file_name
    FROM identity.compliance_documents cd
    WHERE cd.vendor_id = p_vendor_id
    ORDER BY cd.created_at DESC;
END;
$$;

COMMIT;
