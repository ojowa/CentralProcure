BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.yearly_apps (
    yearly_app_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Under Review',
    notes TEXT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'yearly_apps_fiscal_year_ux'
          AND conrelid = 'procurement_workflow.yearly_apps'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.yearly_apps
            ADD CONSTRAINT yearly_apps_fiscal_year_ux UNIQUE (fiscal_year);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'yearly_apps_status_chk'
          AND conrelid = 'procurement_workflow.yearly_apps'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.yearly_apps
            ADD CONSTRAINT yearly_apps_status_chk
            CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Cancelled'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'yearly_apps_year_chk'
          AND conrelid = 'procurement_workflow.yearly_apps'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.yearly_apps
            ADD CONSTRAINT yearly_apps_year_chk
            CHECK (fiscal_year BETWEEN 2000 AND 2100);
    END IF;
END $$;

INSERT INTO procurement_workflow.yearly_apps (fiscal_year, title, status, notes)
SELECT
    p.fiscal_year,
    p.fiscal_year::text || ' APP',
    CASE
        WHEN BOOL_OR(p.status = 'Approved') THEN 'Submitted'
        ELSE 'Under Review'
    END,
    'Backfilled from procurement plans.'
FROM procurement_workflow.procurement_plans p
GROUP BY p.fiscal_year
ON CONFLICT (fiscal_year) DO UPDATE
SET title = EXCLUDED.title,
    updated_at = NOW();

ALTER TABLE procurement_workflow.procurement_plans
    ADD COLUMN IF NOT EXISTS yearly_app_id UUID NULL;

UPDATE procurement_workflow.procurement_plans p
SET yearly_app_id = y.yearly_app_id
FROM procurement_workflow.yearly_apps y
WHERE y.fiscal_year = p.fiscal_year
  AND p.yearly_app_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_procurement_plans_yearly_app'
          AND conrelid = 'procurement_workflow.procurement_plans'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT fk_procurement_plans_yearly_app
            FOREIGN KEY (yearly_app_id)
            REFERENCES procurement_workflow.yearly_apps(yearly_app_id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_procurement_plans_yearly_app
    ON procurement_workflow.procurement_plans(yearly_app_id);

CREATE OR REPLACE FUNCTION procurement_workflow.ensure_yearly_app(
    p_fiscal_year INT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_yearly_app_id UUID;
BEGIN
    IF p_fiscal_year IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Fiscal year is required to resolve the yearly APP.';
    END IF;

    INSERT INTO procurement_workflow.yearly_apps (fiscal_year, title, status, notes)
    VALUES (
        p_fiscal_year,
        p_fiscal_year::text || ' APP',
        'Under Review',
        'Auto-created while resolving yearly APP ownership.'
    )
    ON CONFLICT (fiscal_year) DO UPDATE
    SET title = EXCLUDED.title,
        updated_at = NOW()
    RETURNING yearly_app_id INTO v_yearly_app_id;

    RETURN v_yearly_app_id;
END;
$$;

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
    v_duplicate_id UUID;
    v_yearly_app_id UUID;
BEGIN
    SELECT p.plan_id
    INTO v_duplicate_id
    FROM procurement_workflow.procurement_plans p
    WHERE lower(trim(p.plan_title)) = lower(trim(p_plan_title))
      AND lower(trim(p.department)) = lower(trim(p_department))
      AND p.fiscal_year = p_fiscal_year
    LIMIT 1;

    IF v_duplicate_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan already exists for this title, department, and fiscal year.';
    END IF;

    v_yearly_app_id := procurement_workflow.ensure_yearly_app(p_fiscal_year);

    INSERT INTO procurement_workflow.procurement_plans (
        yearly_app_id,
        plan_title,
        department,
        fiscal_year,
        status,
        total_budget,
        notes
    )
    VALUES (
        v_yearly_app_id,
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
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = v_plan_id;
END;
$$;

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
DECLARE
    v_fiscal_year INT;
    v_yearly_app_id UUID;
BEGIN
    SELECT COALESCE(p_fiscal_year, p.fiscal_year)
    INTO v_fiscal_year
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;

    IF v_fiscal_year IS NULL THEN
        RETURN;
    END IF;

    v_yearly_app_id := procurement_workflow.ensure_yearly_app(v_fiscal_year);

    UPDATE procurement_workflow.procurement_plans
    SET
        yearly_app_id = v_yearly_app_id,
        plan_title = COALESCE(p_plan_title, plan_title),
        department = COALESCE(p_department, department),
        fiscal_year = v_fiscal_year,
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
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;
END;
$$;

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

COMMIT;
