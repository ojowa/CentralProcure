-- Function for Updating a Procurement Plan Item (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.update_procurement_plan_item(
    p_plan_item_id UUID,
    p_item_code VARCHAR(60),
    p_description TEXT,
    p_budget_code VARCHAR(60),
    p_procurement_type VARCHAR(50),
    p_estimated_amount DECIMAL(18, 2),
    p_status VARCHAR(30),
    p_notes TEXT
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
    UPDATE procurement_workflow.procurement_plan_items
    SET
        item_code = COALESCE(p_item_code, item_code),
        description = COALESCE(p_description, description),
        budget_code = COALESCE(p_budget_code, budget_code),
        procurement_type = COALESCE(p_procurement_type, procurement_type),
        estimated_amount = COALESCE(p_estimated_amount, estimated_amount),
        status = COALESCE(p_status, status),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE plan_item_id = p_plan_item_id;

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
    WHERE i.plan_item_id = p_plan_item_id;
END;
$$;

-- Procedure wrapper for update_procurement_plan_item (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.update_procurement_plan_item_sp(
    IN p_plan_item_id UUID,
    IN p_item_code VARCHAR(60),
    IN p_description TEXT,
    IN p_budget_code VARCHAR(60),
    IN p_procurement_type VARCHAR(50),
    IN p_estimated_amount DECIMAL(18, 2),
    IN p_status VARCHAR(30),
    IN p_notes TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_procurement_plan_item(
        p_plan_item_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        p_estimated_amount,
        p_status,
        p_notes
    );
END;
$$;
