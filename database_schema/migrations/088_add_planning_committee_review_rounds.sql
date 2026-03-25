ALTER TABLE procurement_workflow.procurement_plans
    ADD COLUMN IF NOT EXISTS review_round INT NOT NULL DEFAULT 1;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD COLUMN IF NOT EXISTS review_round INT NOT NULL DEFAULT 1;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS uq_member_review_req_role_user;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS uq_member_review_req_role_user_round;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT uq_member_review_req_role_user_round
    UNIQUE (requisition_id, reviewer_role, reviewer_user_id, review_round);

DROP FUNCTION IF EXISTS procurement_workflow.submit_member_review(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION procurement_workflow.submit_member_review(
    p_plan_id UUID,
    p_requisition_id UUID,
    p_reviewer_role VARCHAR(80),
    p_reviewer_user_id VARCHAR(255),
    p_decision VARCHAR(50),
    p_remarks TEXT
)
RETURNS TABLE (
    review_id UUID,
    plan_id UUID,
    requisition_id UUID,
    reviewer_role VARCHAR(80),
    reviewer_user_id VARCHAR(255),
    decision VARCHAR(50),
    remarks TEXT,
    review_round INT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_review_id UUID;
    v_role_key VARCHAR(80);
    v_status_label VARCHAR(80);
    v_review_round INT;
BEGIN
    v_role_key := LOWER(REPLACE(REPLACE(p_reviewer_role, '-', '_'), ' ', '_'));
    SELECT COALESCE(p.review_round, 1)
      INTO v_review_round
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;

    v_status_label := CASE
        WHEN v_role_key = 'planning_statistics_officer' THEN 'PSO Reviewed'
        WHEN v_role_key = 'financial_unit_officer' THEN 'Finance Reviewed'
        WHEN v_role_key = 'department_head' THEN 'Technical Reviewed'
        WHEN v_role_key = 'legal_reviewer' THEN 'Legal Reviewed'
        WHEN v_role_key = 'procurement_secretary' THEN 'Secretary Recorded'
        WHEN v_role_key = 'comptroller_procurement' THEN 'Chair Reviewed'
        ELSE 'Reviewed'
    END;

    INSERT INTO procurement_workflow.planning_committee_member_reviews (
        plan_id,
        requisition_id,
        reviewer_role,
        reviewer_user_id,
        decision,
        remarks,
        review_round
    )
    VALUES (
        p_plan_id,
        p_requisition_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks,
        v_review_round
    )
    ON CONFLICT ON CONSTRAINT uq_member_review_req_role_user_round DO UPDATE
    SET
        decision = EXCLUDED.decision,
        remarks = EXCLUDED.remarks,
        updated_at = NOW()
    RETURNING planning_committee_member_reviews.review_id INTO v_review_id;

    PERFORM procurement_workflow.upsert_member_status(
        p_plan_id,
        p_requisition_id,
        v_role_key,
        v_status_label,
        p_decision,
        p_reviewer_user_id
    );

    RETURN QUERY
    SELECT
        r.review_id,
        r.plan_id,
        r.requisition_id,
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.review_round,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.review_id = v_review_id;
END;
$$;
