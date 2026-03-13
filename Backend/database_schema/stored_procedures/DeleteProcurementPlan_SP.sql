-- Function for Deleting a Procurement Plan (PostgreSQL)
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

-- Procedure wrapper for delete_procurement_plan (PostgreSQL)
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
