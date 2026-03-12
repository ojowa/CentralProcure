-- Function for Getting Requisition Detail (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.get_requisition_detail(
    p_requisition_id UUID
)
RETURNS TABLE (
    requisition_id UUID,
    title VARCHAR(255),
    department VARCHAR(150),
    status VARCHAR(50),
    priority VARCHAR(50),
    funding_source VARCHAR(120),
    total_estimate DECIMAL(18, 2),
    required_by TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    procurement_type VARCHAR(50),
    budget_code VARCHAR(60),
    app_item_id UUID,
    project_code VARCHAR(60),
    delivery_location TEXT,
    justification TEXT,
    risk_notes TEXT,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    current_stage VARCHAR(60)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.app_item_id,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;

-- Procedure wrapper for get_requisition_detail (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_requisition_detail_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisition_detail(p_requisition_id);
END;
$$;
