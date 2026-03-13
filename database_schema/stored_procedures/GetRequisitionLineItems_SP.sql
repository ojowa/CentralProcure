-- Function for Getting Requisition Line Items (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.get_requisition_line_items(
    p_requisition_id UUID
)
RETURNS TABLE (
    item_code VARCHAR(50),
    description TEXT,
    unit VARCHAR(40),
    quantity DECIMAL(18, 2),
    unit_cost DECIMAL(18, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        li.item_code,
        li.description,
        li.unit,
        li.quantity,
        li.unit_cost
    FROM procurement_workflow.requisition_line_items li
    WHERE li.requisition_id = p_requisition_id
    ORDER BY li.created_at;
END;
$$;

-- Procedure wrapper for get_requisition_line_items (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_requisition_line_items_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisition_line_items(p_requisition_id);
END;
$$;
