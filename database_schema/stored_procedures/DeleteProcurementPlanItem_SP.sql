-- Function for Deleting a Procurement Plan Item (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.delete_procurement_plan_item(
    p_plan_item_id UUID
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
    DELETE FROM procurement_workflow.procurement_plan_items
    WHERE plan_item_id = p_plan_item_id
    RETURNING
        plan_item_id,
        plan_id,
        item_code,
        description,
        budget_code,
        procurement_type,
        estimated_amount,
        status,
        notes,
        created_at,
        updated_at;
END;
$$;

-- Procedure wrapper for delete_procurement_plan_item (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.delete_procurement_plan_item_sp(
    IN p_plan_item_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.delete_procurement_plan_item(p_plan_item_id);
END;
$$;
