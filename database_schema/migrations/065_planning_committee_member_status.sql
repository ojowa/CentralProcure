-- Migration 065: Persist planning committee member statuses
BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.planning_committee_member_status (
    status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE,
    role_key VARCHAR(80) NOT NULL,
    status_label VARCHAR(80) NOT NULL,
    decision VARCHAR(50) NULL,
    updated_by VARCHAR(255) NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_member_status_plan_role UNIQUE (plan_id, role_key)
);

CREATE OR REPLACE FUNCTION procurement_workflow.upsert_member_status(
    p_plan_id UUID,
    p_role_key VARCHAR(80),
    p_status_label VARCHAR(80),
    p_decision VARCHAR(50),
    p_updated_by VARCHAR(255)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO procurement_workflow.planning_committee_member_status (
        plan_id,
        role_key,
        status_label,
        decision,
        updated_by,
        updated_at
    )
    VALUES (
        p_plan_id,
        p_role_key,
        p_status_label,
        p_decision,
        p_updated_by,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_member_status_plan_role DO UPDATE
    SET
        status_label = EXCLUDED.status_label,
        decision = EXCLUDED.decision,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_member_statuses(
    p_plan_id UUID
)
RETURNS TABLE (
    role_key VARCHAR(80),
    status_label VARCHAR(80),
    decision VARCHAR(50),
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.role_key,
        s.status_label,
        s.decision,
        s.updated_by,
        s.updated_at
    FROM procurement_workflow.planning_committee_member_status s
    WHERE s.plan_id = p_plan_id
    ORDER BY s.updated_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_member_statuses_sp(
    IN p_plan_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_member_statuses(p_plan_id);
END;
$$;

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
    v_role_key VARCHAR(80);
    v_status_label VARCHAR(80);
BEGIN
    v_role_key := LOWER(REPLACE(REPLACE(p_reviewer_role, '-', '_'), ' ', '_'));

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

    PERFORM procurement_workflow.upsert_member_status(
        p_plan_id,
        v_role_key,
        v_status_label,
        p_decision,
        p_reviewer_user_id
    );

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
