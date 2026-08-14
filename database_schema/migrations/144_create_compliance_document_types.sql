-- Migration 144: Create compliance_document_types table and seed data
-- Replaces hardcoded compliance requirements in vendor.ts

CREATE TABLE IF NOT EXISTS identity.compliance_document_types (
    document_type_id   SERIAL PRIMARY KEY,
    document_type      VARCHAR(100) NOT NULL UNIQUE,
    description        VARCHAR(500) NOT NULL DEFAULT '',
    is_mandatory       BOOLEAN NOT NULL DEFAULT true,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    display_order      INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO identity.compliance_document_types (document_type, description, is_mandatory, display_order)
VALUES
    ('CAC Certificate', 'Certificate of Incorporation from the Corporate Affairs Commission', true, 1),
    ('Tax Clearance', 'Tax clearance certificate from the Federal Inland Revenue Service', true, 2),
    ('PENCOM', 'Pension clearance certificate from the National Pension Commission', true, 3),
    ('ITF', 'Industrial Training Fund compliance certificate', true, 4),
    ('Company Profile', 'Company profile with details of directors and organizational structure', true, 5),
    ('Bank Reference', 'Bank reference letter from the company''s bank', true, 6),
    ('Insurance Certificate', 'Insurance certificate covering the company''s operations', true, 7)
ON CONFLICT (document_type) DO NOTHING;

CREATE OR REPLACE FUNCTION identity.get_compliance_document_types()
RETURNS TABLE (
    document_type VARCHAR(100),
    description   VARCHAR(500),
    is_mandatory  BOOLEAN
)
LANGUAGE sql STABLE
AS $$
    SELECT cdt.document_type, cdt.description, cdt.is_mandatory
    FROM identity.compliance_document_types cdt
    WHERE cdt.is_active = true
    ORDER BY cdt.display_order;
$$;
