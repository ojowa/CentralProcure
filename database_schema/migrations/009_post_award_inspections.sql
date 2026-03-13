-- Migration 009: Post-Award Inspections (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS post_award;

CREATE TABLE IF NOT EXISTS post_award.inspections (
    inspection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_code VARCHAR(50) NOT NULL UNIQUE,
    contract_code VARCHAR(50) NOT NULL,
    tender_title VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    scheduled_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    completed_date TIMESTAMP WITHOUT TIME ZONE NULL,
    inspector_name VARCHAR(150) NOT NULL,
    outcome VARCHAR(50) NULL,
    location VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'inspections_status_chk'
          AND conrelid = 'post_award.inspections'::regclass
    ) THEN
        ALTER TABLE post_award.inspections
            ADD CONSTRAINT inspections_status_chk
            CHECK (status IN ('Scheduled', 'In Progress', 'Accepted', 'Rejected'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'inspections_outcome_chk'
          AND conrelid = 'post_award.inspections'::regclass
    ) THEN
        ALTER TABLE post_award.inspections
            ADD CONSTRAINT inspections_outcome_chk
            CHECK (outcome IS NULL OR outcome IN ('Accepted', 'Rejected', 'Pending'));
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION post_award.get_inspections(
    p_status VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    inspection_id UUID,
    inspection_code VARCHAR(50),
    contract_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    status VARCHAR(50),
    scheduled_date TIMESTAMP WITHOUT TIME ZONE,
    completed_date TIMESTAMP WITHOUT TIME ZONE,
    inspector_name VARCHAR(150),
    outcome VARCHAR(50),
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.inspection_id,
        i.inspection_code,
        i.contract_code,
        i.tender_title,
        i.vendor_name,
        i.status,
        i.scheduled_date,
        i.completed_date,
        i.inspector_name,
        i.outcome,
        i.location,
        i.notes,
        i.created_at,
        i.updated_at
    FROM post_award.inspections i
    WHERE
        (p_status IS NULL OR i.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR i.inspection_code ILIKE '%' || p_query || '%'
            OR i.contract_code ILIKE '%' || p_query || '%'
            OR i.vendor_name ILIKE '%' || p_query || '%'
        )
    ORDER BY i.scheduled_date DESC, i.created_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_inspections_sp(
    IN p_status VARCHAR(50),
    IN p_query TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_inspections(p_status, p_query);
END;
$$;

CREATE OR REPLACE FUNCTION post_award.get_inspection_detail(
    p_inspection_code VARCHAR(50)
)
RETURNS TABLE (
    inspection_id UUID,
    inspection_code VARCHAR(50),
    contract_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    status VARCHAR(50),
    scheduled_date TIMESTAMP WITHOUT TIME ZONE,
    completed_date TIMESTAMP WITHOUT TIME ZONE,
    inspector_name VARCHAR(150),
    outcome VARCHAR(50),
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.inspection_id,
        i.inspection_code,
        i.contract_code,
        i.tender_title,
        i.vendor_name,
        i.status,
        i.scheduled_date,
        i.completed_date,
        i.inspector_name,
        i.outcome,
        i.location,
        i.notes,
        i.created_at,
        i.updated_at
    FROM post_award.inspections i
    WHERE i.inspection_code = p_inspection_code;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_inspection_detail_sp(
    IN p_inspection_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_inspection_detail(p_inspection_code);
END;
$$;

COMMIT;
