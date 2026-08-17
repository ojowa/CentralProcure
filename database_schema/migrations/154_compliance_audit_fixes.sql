-- Migration 154: Compliance documents audit fixes
-- Fixes: unique constraint, document type keys, rejection_reason,
--        history tracking, frequency/expirable columns, drop old SP

-- 0. Drop functions that need return type changes
DROP FUNCTION IF EXISTS identity.get_vendor_compliance_documents(uuid);
DROP FUNCTION IF EXISTS identity.get_vendor_compliance_document_history(uuid, varchar);
DROP FUNCTION IF EXISTS identity.get_compliance_document_types();

-- 1. Add document_type_key (snake_case) to compliance_document_types
ALTER TABLE identity.compliance_document_types
  ADD COLUMN IF NOT EXISTS document_type_key VARCHAR(100);

UPDATE identity.compliance_document_types
SET document_type_key = LOWER(REPLACE(REPLACE(TRIM(document_type), ' ', '_'), '-', '_'))
WHERE document_type_key IS NULL;

ALTER TABLE identity.compliance_document_types
  ALTER COLUMN document_type_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS compliance_document_types_key_idx
  ON identity.compliance_document_types (document_type_key);

-- 2. Add frequency and expirable columns
ALTER TABLE identity.compliance_document_types
  ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'Annual',
  ADD COLUMN IF NOT EXISTS expirable BOOLEAN DEFAULT TRUE;

UPDATE identity.compliance_document_types SET frequency = 'One-time', expirable = FALSE
WHERE document_type_key = 'cac_certificate';

UPDATE identity.compliance_document_types SET frequency = 'Annual', expirable = TRUE
WHERE document_type_key IN ('tax_clearance', 'pencom', 'itf', 'insurance_certificate');

UPDATE identity.compliance_document_types SET frequency = 'As needed', expirable = FALSE
WHERE document_type_key = 'company_profile';

UPDATE identity.compliance_document_types SET frequency = 'As needed', expirable = TRUE
WHERE document_type_key = 'bank_reference';

-- 3. Add rejection_reason to compliance_documents
ALTER TABLE identity.compliance_documents
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Add unique constraint on (vendor_id, document_type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'compliance_documents_vendor_type_key'
  ) THEN
    ALTER TABLE identity.compliance_documents
      ADD CONSTRAINT compliance_documents_vendor_type_key
      UNIQUE (vendor_id, document_type);
  END IF;
END $$;

-- 5. Add index on updated_at
CREATE INDEX IF NOT EXISTS compliance_documents_updated_at_idx
  ON identity.compliance_documents (updated_at DESC);

-- 6. Add file_name to compliance_document_history
ALTER TABLE identity.compliance_document_history
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);

-- 7. Create verify_compliance_document SP (updates status + writes history)
CREATE OR REPLACE FUNCTION identity.verify_compliance_document(
  p_document_id UUID,
  p_verification_status VARCHAR(50),
  p_verified_by VARCHAR(255),
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_vendor_id UUID;
  v_document_type VARCHAR(100);
  v_document_url TEXT;
  v_expiry_date DATE;
  v_file_name VARCHAR(255);
BEGIN
  SELECT vendor_id, document_type, document_url, expiry_date, file_name
  INTO v_vendor_id, v_document_type, v_document_url, v_expiry_date, v_file_name
  FROM identity.compliance_documents
  WHERE document_id = p_document_id;

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  UPDATE identity.compliance_documents
  SET
    verification_status = p_verification_status,
    verified_by = p_verified_by,
    verified_at = NOW(),
    rejection_reason = CASE WHEN p_verification_status = 'Rejected' THEN p_rejection_reason ELSE NULL END,
    updated_at = NOW()
  WHERE document_id = p_document_id;

  INSERT INTO identity.compliance_document_history (
    document_id, vendor_id, document_type, document_url,
    expiry_date, verification_status, file_name, created_at
  ) VALUES (
    p_document_id, v_vendor_id, v_document_type, v_document_url,
    v_expiry_date, p_verification_status, v_file_name, NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Drop the old 4-param upload_compliance_document (doesn't store file_name/content)
DROP FUNCTION IF EXISTS identity.upload_compliance_document(UUID, VARCHAR, TEXT, DATE);

-- 9. Update get_vendor_compliance_documents to return rejection_reason
CREATE OR REPLACE FUNCTION identity.get_vendor_compliance_documents(p_vendor_id uuid)
RETURNS TABLE(
  document_id uuid,
  document_type character varying,
  document_url text,
  expiry_date date,
  verification_status character varying,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  file_name character varying,
  rejection_reason text
)
LANGUAGE plpgsql
STABLE
AS $function$
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
    cd.file_name,
    cd.rejection_reason
  FROM identity.compliance_documents cd
  WHERE cd.vendor_id = p_vendor_id
  ORDER BY cd.created_at DESC;
END;
$function$;

-- 10. Update get_vendor_compliance_document_history to include file_name
CREATE OR REPLACE FUNCTION identity.get_vendor_compliance_document_history(p_vendor_id uuid, p_document_type character varying)
RETURNS TABLE(
  history_id uuid,
  document_id uuid,
  document_type character varying,
  document_url text,
  expiry_date date,
  verification_status character varying,
  created_at timestamp without time zone,
  file_name character varying
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    h.history_id,
    h.document_id,
    h.document_type,
    h.document_url,
    h.expiry_date,
    h.verification_status,
    h.created_at,
    h.file_name
  FROM identity.compliance_document_history h
  WHERE h.vendor_id = p_vendor_id
    AND h.document_type = p_document_type
  ORDER BY h.created_at DESC;
END;
$function$;

-- 11. Update get_compliance_document_types to return new columns
CREATE OR REPLACE FUNCTION identity.get_compliance_document_types()
RETURNS TABLE(
  document_type character varying,
  document_type_key character varying,
  description character varying,
  is_mandatory boolean,
  frequency character varying,
  expirable boolean
)
LANGUAGE sql STABLE
AS $function$
  SELECT
    cdt.document_type,
    cdt.document_type_key,
    cdt.description,
    cdt.is_mandatory,
    cdt.frequency,
    cdt.expirable
  FROM identity.compliance_document_types cdt
  WHERE cdt.is_active = TRUE
  ORDER BY cdt.display_order, cdt.document_type;
$function$;
