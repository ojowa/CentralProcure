-- Migration 049: Delete Requisition Logic
BEGIN;

CREATE OR REPLACE FUNCTION procurement_workflow.delete_requisition(
    p_requisition_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_instance_id UUID;
BEGIN
    -- 1. Get workflow instance ID if it exists
    SELECT instance_id INTO v_instance_id
    FROM procurement_workflow.workflow_instances
    WHERE entity_type = 'requisition' AND entity_id = p_requisition_id;

    -- 2. Delete workflow history
    IF v_instance_id IS NOT NULL THEN
        DELETE FROM procurement_workflow.workflow_instance_history
        WHERE instance_id = v_instance_id;
    END IF;

    -- 3. Delete workflow instance
    DELETE FROM procurement_workflow.workflow_instances
    WHERE entity_type = 'requisition' AND entity_id = p_requisition_id;

    -- 4. Delete requisition line items
    DELETE FROM procurement_workflow.requisition_line_items
    WHERE requisition_id = p_requisition_id;

    -- 5. Delete the requisition itself
    DELETE FROM procurement_workflow.requisitions
    WHERE requisition_id = p_requisition_id;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.delete_requisition_sp(
    IN p_requisition_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM procurement_workflow.delete_requisition(p_requisition_id);
END;
$$;

COMMIT;
