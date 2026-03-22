-- Migration 067: Allow unlinking requisition from APP item
BEGIN;

CREATE OR REPLACE FUNCTION procurement_workflow.unlink_requisition_app_item(
    p_requisition_id UUID
)
RETURNS TABLE (
    requisition_id UUID,
    app_item_id UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE procurement_workflow.requisitions
    SET
        app_item_id = NULL,
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    RETURN QUERY
    SELECT r.requisition_id, r.app_item_id, r.updated_at
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.unlink_requisition_app_item_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.unlink_requisition_app_item(p_requisition_id);
END;
$$;

COMMIT;
