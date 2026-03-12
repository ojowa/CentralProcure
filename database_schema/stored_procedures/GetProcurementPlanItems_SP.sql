-- Function for Getting Procurement Plan Items (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.get_procurement_plan_items(
    p_plan_id UUID
)
RETURNS TABLE (
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR(60),
    description TEXT,
    budget_code VARCHAR(60),
    procurement_type VARCHAR(50),
    estimated_amount DECIMAL(18, 2),
    status VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.plan_item_id,
        i.plan_id,
        i.item_code,
        i.description,
        i.budget_code,
        i.procurement_type,
        i.estimated_amount,
        i.status,
        i.notes,
        i.created_at,
        i.updated_at
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p_plan_id
    ORDER BY i.created_at;
END;
$$;

-- Procedure wrapper for get_procurement_plan_items (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_procurement_plan_items_sp(
    IN p_plan_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plan_items(p_plan_id);
END;
$$;
