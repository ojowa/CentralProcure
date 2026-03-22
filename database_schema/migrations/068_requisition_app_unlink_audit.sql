-- Migration 068: Audit APP unlink reason
BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.requisition_app_unlinks (
    unlink_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE,
    previous_app_item_id UUID NULL,
    reason TEXT NOT NULL,
    unlinked_by VARCHAR(255) NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION procurement_workflow.unlink_requisition_app_item(
    p_requisition_id UUID,
    p_reason TEXT,
    p_unlinked_by VARCHAR(255)
)
RETURNS TABLE (
    requisition_id UUID,
    app_item_id UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_prev_app_item_id UUID;
BEGIN
    SELECT r.app_item_id
    INTO v_prev_app_item_id
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Unlink reason is required.';
    END IF;

    INSERT INTO procurement_workflow.requisition_app_unlinks (
        requisition_id,
        previous_app_item_id,
        reason,
        unlinked_by
    )
    VALUES (
        p_requisition_id,
        v_prev_app_item_id,
        p_reason,
        p_unlinked_by
    );

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
    IN p_reason TEXT,
    IN p_unlinked_by VARCHAR(255),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.unlink_requisition_app_item(p_requisition_id, p_reason, p_unlinked_by);
END;
$$;

COMMIT;
