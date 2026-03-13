-- Migration 010: Evaluation Reports (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;

CREATE TABLE IF NOT EXISTS procurement_workflow.evaluation_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_code VARCHAR(50) NOT NULL UNIQUE,
    tender_id UUID NOT NULL,
    tender_title VARCHAR(255) NOT NULL,
    committee_lead VARCHAR(150) NOT NULL,
    recommendation VARCHAR(120) NOT NULL,
    score_summary VARCHAR(120) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
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
        WHERE conname = 'evaluation_reports_status_chk'
          AND conrelid = 'procurement_workflow.evaluation_reports'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.evaluation_reports
            ADD CONSTRAINT evaluation_reports_status_chk
            CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Returned'));
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_evaluation_reports(
    p_status VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    report_id UUID,
    report_code VARCHAR(50),
    tender_id UUID,
    tender_title VARCHAR(255),
    committee_lead VARCHAR(150),
    recommendation VARCHAR(120),
    score_summary VARCHAR(120),
    status VARCHAR(50),
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.report_id,
        r.report_code,
        r.tender_id,
        r.tender_title,
        r.committee_lead,
        r.recommendation,
        r.score_summary,
        r.status,
        r.submitted_at,
        r.notes,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.evaluation_reports r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR r.report_code ILIKE '%' || p_query || '%'
            OR r.tender_title ILIKE '%' || p_query || '%'
            OR r.committee_lead ILIKE '%' || p_query || '%'
        )
    ORDER BY r.submitted_at DESC, r.created_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_evaluation_reports_sp(
    IN p_status VARCHAR(50),
    IN p_query TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_evaluation_reports(p_status, p_query);
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_evaluation_report(
    p_report_code VARCHAR(50)
)
RETURNS TABLE (
    report_id UUID,
    report_code VARCHAR(50),
    tender_id UUID,
    tender_title VARCHAR(255),
    committee_lead VARCHAR(150),
    recommendation VARCHAR(120),
    score_summary VARCHAR(120),
    status VARCHAR(50),
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.report_id,
        r.report_code,
        r.tender_id,
        r.tender_title,
        r.committee_lead,
        r.recommendation,
        r.score_summary,
        r.status,
        r.submitted_at,
        r.notes,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.evaluation_reports r
    WHERE r.report_code = p_report_code;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_evaluation_report_sp(
    IN p_report_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_evaluation_report(p_report_code);
END;
$$;

COMMIT;
