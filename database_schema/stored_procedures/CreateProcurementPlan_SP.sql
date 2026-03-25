-- Function for Creating a Procurement Plan (PostgreSQL)
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
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        p.plan_id = v_plan_id;
END;
$$;

-- Procedure wrapper for create_procurement_plan (PostgreSQL)
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
