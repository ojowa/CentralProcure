-- Migration 003: Procurement Plans (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;

CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_title VARCHAR(255) NOT NULL,
    department VARCHAR(150) NOT NULL,
    fiscal_year INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    total_budget DECIMAL(18, 2) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE NULL,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_status_chk'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_status_chk
            CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_budget_chk'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_budget_chk
            CHECK (total_budget >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_year_chk'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_year_chk
            CHECK (fiscal_year BETWEEN 2000 AND 2100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_title_len_chk'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_title_len_chk
            CHECK (char_length(plan_title) BETWEEN 5 AND 255);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_dept_len_chk'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_dept_len_chk
            CHECK (char_length(department) BETWEEN 3 AND 150);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_dates_chk'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_dates_chk
            CHECK (
                approved_at IS NULL
                OR submitted_at IS NULL
                OR approved_at >= submitted_at
            );
    END IF;
END
$$;

-- get_procurement_plans function
CREATE OR REPLACE FUNCTION procurement_workflow.get_procurement_plans(
    p_fiscal_year INT DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'created_at',
    p_sort_dir VARCHAR(4) DEFAULT 'desc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    plan_id UUID,
    plan_title VARCHAR(255),
    department VARCHAR(150),
    fiscal_year INT,
    status VARCHAR(50),
    total_budget DECIMAL(18, 2),
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.created_at
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'plan_title' AND lower(p_sort_dir) = 'asc' THEN p.plan_title END ASC,
        CASE WHEN lower(p_sort_by) = 'plan_title' AND lower(p_sort_dir) = 'desc' THEN p.plan_title END DESC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'asc' THEN p.department END ASC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'desc' THEN p.department END DESC,
        CASE WHEN lower(p_sort_by) = 'fiscal_year' AND lower(p_sort_dir) = 'asc' THEN p.fiscal_year END ASC,
        CASE WHEN lower(p_sort_by) = 'fiscal_year' AND lower(p_sort_dir) = 'desc' THEN p.fiscal_year END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN p.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN p.status END DESC,
        CASE WHEN lower(p_sort_by) = 'total_budget' AND lower(p_sort_dir) = 'asc' THEN p.total_budget END ASC,
        CASE WHEN lower(p_sort_by) = 'total_budget' AND lower(p_sort_dir) = 'desc' THEN p.total_budget END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN p.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN p.created_at END DESC,
        p.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

-- get_procurement_plans_count function
CREATE OR REPLACE FUNCTION procurement_workflow.get_procurement_plans_count(
    p_fiscal_year INT DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status);

    RETURN v_count;
END;
$$;

-- get_procurement_plans stored procedure
CREATE OR REPLACE PROCEDURE procurement_workflow.get_procurement_plans_sp(
    IN p_fiscal_year INT,
    IN p_department VARCHAR(150),
    IN p_status VARCHAR(50),
    IN p_sort_by VARCHAR(50),
    IN p_sort_dir VARCHAR(4),
    IN p_limit INT,
    IN p_offset INT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plans(
        p_fiscal_year,
        p_department,
        p_status,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;

-- create_procurement_plan function
CREATE OR REPLACE FUNCTION procurement_workflow.create_procurement_plan(
    p_plan_title VARCHAR(255),
    p_department VARCHAR(150),
    p_fiscal_year INT,
    p_status VARCHAR(50),
    p_total_budget DECIMAL(18, 2),
    p_notes TEXT
)
RETURNS TABLE (
    plan_id UUID,
    plan_title VARCHAR(255),
    department VARCHAR(150),
    fiscal_year INT,
    status VARCHAR(50),
    total_budget DECIMAL(18, 2),
    notes TEXT,
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_id UUID;
BEGIN
    INSERT INTO procurement_workflow.procurement_plans (
        plan_title,
        department,
        fiscal_year,
        status,
        total_budget,
        notes
    )
    VALUES (
        p_plan_title,
        p_department,
        p_fiscal_year,
        COALESCE(p_status, 'Draft'),
        COALESCE(p_total_budget, 0),
        p_notes
    )
    RETURNING procurement_plans.plan_id INTO v_plan_id;

    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.notes,
        p.submitted_at,
        p.approved_at,
        p.created_at,
        p.updated_at
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        p.plan_id = v_plan_id;
END;
$$;

-- create_procurement_plan stored procedure
CREATE OR REPLACE PROCEDURE procurement_workflow.create_procurement_plan_sp(
    IN p_plan_title VARCHAR(255),
    IN p_department VARCHAR(150),
    IN p_fiscal_year INT,
    IN p_status VARCHAR(50),
    IN p_total_budget DECIMAL(18, 2),
    IN p_notes TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_procurement_plan(
        p_plan_title,
        p_department,
        p_fiscal_year,
        p_status,
        p_total_budget,
        p_notes
    );
END;
$$;

-- update_procurement_plan function
CREATE OR REPLACE FUNCTION procurement_workflow.update_procurement_plan(
    p_plan_id UUID,
    p_plan_title VARCHAR(255),
    p_department VARCHAR(150),
    p_fiscal_year INT,
    p_status VARCHAR(50),
    p_total_budget DECIMAL(18, 2),
    p_notes TEXT,
    p_submitted_at TIMESTAMP WITHOUT TIME ZONE,
    p_approved_at TIMESTAMP WITHOUT TIME ZONE
)
RETURNS TABLE (
    plan_id UUID,
    plan_title VARCHAR(255),
    department VARCHAR(150),
    fiscal_year INT,
    status VARCHAR(50),
    total_budget DECIMAL(18, 2),
    notes TEXT,
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE procurement_workflow.procurement_plans
    SET
        plan_title = COALESCE(p_plan_title, plan_title),
        department = COALESCE(p_department, department),
        fiscal_year = COALESCE(p_fiscal_year, fiscal_year),
        status = COALESCE(p_status, status),
        total_budget = COALESCE(p_total_budget, total_budget),
        notes = COALESCE(p_notes, notes),
        submitted_at = COALESCE(p_submitted_at, submitted_at),
        approved_at = COALESCE(p_approved_at, approved_at),
        updated_at = NOW()
    WHERE plan_id = p_plan_id;

    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.notes,
        p.submitted_at,
        p.approved_at,
        p.created_at,
        p.updated_at
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        p.plan_id = p_plan_id;
END;
$$;

-- update_procurement_plan stored procedure
CREATE OR REPLACE PROCEDURE procurement_workflow.update_procurement_plan_sp(
    IN p_plan_id UUID,
    IN p_plan_title VARCHAR(255),
    IN p_department VARCHAR(150),
    IN p_fiscal_year INT,
    IN p_status VARCHAR(50),
    IN p_total_budget DECIMAL(18, 2),
    IN p_notes TEXT,
    IN p_submitted_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_approved_at TIMESTAMP WITHOUT TIME ZONE,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_procurement_plan(
        p_plan_id,
        p_plan_title,
        p_department,
        p_fiscal_year,
        p_status,
        p_total_budget,
        p_notes,
        p_submitted_at,
        p_approved_at
    );
END;
$$;

-- delete_procurement_plan function
CREATE OR REPLACE FUNCTION procurement_workflow.delete_procurement_plan(
    p_plan_id UUID
)
RETURNS TABLE (
    plan_id UUID,
    plan_title VARCHAR(255),
    department VARCHAR(150),
    fiscal_year INT,
    status VARCHAR(50),
    total_budget DECIMAL(18, 2),
    notes TEXT,
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    DELETE FROM procurement_workflow.procurement_plans
    WHERE plan_id = p_plan_id
    RETURNING
        procurement_plans.plan_id,
        procurement_plans.plan_title,
        procurement_plans.department,
        procurement_plans.fiscal_year,
        procurement_plans.status,
        procurement_plans.total_budget,
        procurement_plans.notes,
        procurement_plans.submitted_at,
        procurement_plans.approved_at,
        procurement_plans.created_at,
        procurement_plans.updated_at;
END;
$$;

-- delete_procurement_plan stored procedure
CREATE OR REPLACE PROCEDURE procurement_workflow.delete_procurement_plan_sp(
    IN p_plan_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.delete_procurement_plan(p_plan_id);
END;
$$;

COMMIT;
