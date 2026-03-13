-- Function for Creating a Procurement Plan Item (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.create_procurement_plan_item(
    p_plan_id UUID,
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
DECLARE
    v_plan_item_id UUID;
BEGIN
    INSERT INTO procurement_workflow.procurement_plan_items (
        plan_id,
        item_code,
        description,
        budget_code,
        procurement_type,
        estimated_amount,
        status,
        notes
    )
    VALUES (
        p_plan_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        COALESCE(p_estimated_amount, 0),
        COALESCE(p_status, 'Active'),
        p_notes
    )
    RETURNING procurement_plan_items.plan_item_id INTO v_plan_item_id;

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
    WHERE i.plan_item_id = v_plan_item_id;
END;
$$;

-- Procedure wrapper for create_procurement_plan_item (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.create_procurement_plan_item_sp(
    IN p_plan_id UUID,
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
    SELECT * FROM procurement_workflow.create_procurement_plan_item(
        p_plan_id,
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
