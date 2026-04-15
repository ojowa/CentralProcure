-- Migration 096: Add meeting minutes and dropdown remarks support to planning committee
BEGIN;

-- Add meeting_minute_url to planning_committee_decisions
ALTER TABLE procurement_workflow.planning_committee_decisions
    ADD COLUMN IF NOT EXISTS meeting_minute_url TEXT NULL;

-- Update submit_committee_decision function to handle meeting_minute_url and requisition_id
CREATE OR REPLACE FUNCTION procurement_workflow.submit_committee_decision(
    p_requisition_id UUID,
    p_plan_id UUID,
    p_chairman_user_id VARCHAR(255),
    p_secretary_user_id VARCHAR(255),
    p_overall_decision VARCHAR(50),
    p_committee_remarks TEXT,
    p_meeting_date DATE,
    p_meeting_minute_url TEXT
)
RETURNS TABLE (
    decision_id UUID,
    requisition_id UUID,
    plan_id UUID,
    overall_decision VARCHAR(50),
    committee_remarks TEXT,
    meeting_date DATE,
    meeting_minute_url TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_decision_id UUID;
BEGIN
    INSERT INTO procurement_workflow.planning_committee_decisions (
        requisition_id,
        plan_id,
        chairman_user_id,
        secretary_user_id,
        overall_decision,
        committee_remarks,
        meeting_date,
        meeting_minute_url
    )
    VALUES (
        p_requisition_id,
        p_plan_id,
        p_chairman_user_id,
        p_secretary_user_id,
        p_overall_decision,
        p_committee_remarks,
        COALESCE(p_meeting_date, CURRENT_DATE),
        p_meeting_minute_url
    )
    ON CONFLICT (requisition_id) DO UPDATE
    SET
        plan_id = EXCLUDED.plan_id,
        chairman_user_id = EXCLUDED.chairman_user_id,
        secretary_user_id = EXCLUDED.secretary_user_id,
        overall_decision = EXCLUDED.overall_decision,
        committee_remarks = EXCLUDED.committee_remarks,
        meeting_date = EXCLUDED.meeting_date,
        meeting_minute_url = EXCLUDED.meeting_minute_url,
        updated_at = NOW()
    RETURNING planning_committee_decisions.decision_id INTO v_decision_id;

    -- NOTE: In this new "revolved" logic, we might NOT want to update the plan status here
    -- because the Secretary now handles the final "approve or drop from plan" decision.
    -- However, for compatibility with existing workflow triggers, we keep it minimal.

    RETURN QUERY
    SELECT
        d.decision_id,
        d.requisition_id,
        d.plan_id,
        d.overall_decision,
        d.committee_remarks,
        d.meeting_date,
        d.meeting_minute_url,
        d.created_at
    FROM procurement_workflow.planning_committee_decisions d
    WHERE d.decision_id = v_decision_id;
END;
$$;

-- Update the SP wrapper
DROP PROCEDURE IF EXISTS procurement_workflow.submit_committee_decision_sp(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, DATE);
DROP PROCEDURE IF EXISTS procurement_workflow.submit_committee_decision_sp(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, DATE, TEXT);

CREATE OR REPLACE PROCEDURE procurement_workflow.submit_committee_decision_sp(
    IN p_requisition_id UUID,
    IN p_plan_id UUID,
    IN p_chairman_user_id VARCHAR(255),
    IN p_secretary_user_id VARCHAR(255),
    IN p_overall_decision VARCHAR(50),
    IN p_committee_remarks TEXT,
    IN p_meeting_date DATE,
    IN p_meeting_minute_url TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.submit_committee_decision(
        p_requisition_id,
        p_plan_id,
        p_chairman_user_id,
        p_secretary_user_id,
        p_overall_decision,
        p_committee_remarks,
        p_meeting_date,
        p_meeting_minute_url
    );
END;
$$;

COMMIT;
