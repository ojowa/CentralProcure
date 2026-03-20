BEGIN;

CREATE OR REPLACE FUNCTION procurement_workflow.submit_member_review(
    p_plan_id UUID,
    p_reviewer_role VARCHAR(80),
    p_reviewer_user_id VARCHAR(255),
    p_decision VARCHAR(50),
    p_remarks TEXT
)
RETURNS TABLE (
    review_id UUID,
    plan_id UUID,
    reviewer_role VARCHAR(80),
    reviewer_user_id VARCHAR(255),
    decision VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_review_id UUID;
BEGIN
    INSERT INTO procurement_workflow.planning_committee_member_reviews (
        plan_id,
        reviewer_role,
        reviewer_user_id,
        decision,
        remarks
    )
    VALUES (
        p_plan_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    )
    ON CONFLICT ON CONSTRAINT uq_member_review_plan_role_user DO UPDATE
    SET
        decision = EXCLUDED.decision,
        remarks = EXCLUDED.remarks,
        updated_at = NOW()
    RETURNING planning_committee_member_reviews.review_id INTO v_review_id;

    RETURN QUERY
    SELECT
        r.review_id,
        r.plan_id,
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.created_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.review_id = v_review_id;
END;
$$;

COMMIT;
