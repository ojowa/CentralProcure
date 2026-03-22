-- Migration 070: Capture planning committee reviews per requisition
BEGIN;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD COLUMN IF NOT EXISTS requisition_id UUID NULL;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS uq_member_review_plan_role_user;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT uq_member_review_req_role_user UNIQUE (requisition_id, reviewer_role, reviewer_user_id);

CREATE INDEX IF NOT EXISTS idx_member_review_requisition
    ON procurement_workflow.planning_committee_member_reviews(requisition_id);

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS fk_member_review_plan;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT fk_member_review_plan
        FOREIGN KEY (plan_id)
        REFERENCES procurement_workflow.procurement_plans(plan_id)
        ON DELETE CASCADE;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT fk_member_review_requisition
        FOREIGN KEY (requisition_id)
        REFERENCES procurement_workflow.requisitions(requisition_id)
        ON DELETE CASCADE;

ALTER TABLE procurement_workflow.planning_committee_member_status
    ADD COLUMN IF NOT EXISTS requisition_id UUID NULL;

ALTER TABLE procurement_workflow.planning_committee_member_status
    DROP CONSTRAINT IF EXISTS uq_member_status_plan_role;

ALTER TABLE procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT uq_member_status_req_role UNIQUE (requisition_id, role_key);

CREATE INDEX IF NOT EXISTS idx_member_status_requisition
    ON procurement_workflow.planning_committee_member_status(requisition_id);

ALTER TABLE procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT fk_member_status_requisition
        FOREIGN KEY (requisition_id)
        REFERENCES procurement_workflow.requisitions(requisition_id)
        ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION procurement_workflow.upsert_member_status(
    p_plan_id UUID,
    p_requisition_id UUID,
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
        requisition_id,
        role_key,
        status_label,
        decision,
        updated_by,
        updated_at
    )
    VALUES (
        p_plan_id,
        p_requisition_id,
        p_role_key,
        p_status_label,
        p_decision,
        p_updated_by,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_member_status_req_role DO UPDATE
    SET
        status_label = EXCLUDED.status_label,
        decision = EXCLUDED.decision,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;

DROP PROCEDURE IF EXISTS procurement_workflow.get_member_statuses_sp(UUID);
DROP FUNCTION IF EXISTS procurement_workflow.get_member_statuses(UUID);

CREATE OR REPLACE FUNCTION procurement_workflow.get_member_statuses(
    p_requisition_id UUID
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
    WHERE s.requisition_id = p_requisition_id
    ORDER BY s.updated_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_member_statuses_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_member_statuses(p_requisition_id);
END;
$$;

DROP PROCEDURE IF EXISTS procurement_workflow.submit_member_review_sp(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT);
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
        requisition_id,
        reviewer_role,
        reviewer_user_id,
        decision,
        remarks
    )
    VALUES (
        p_plan_id,
        p_requisition_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    )
    ON CONFLICT ON CONSTRAINT uq_member_review_req_role_user DO UPDATE
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
        r.created_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.review_id = v_review_id;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.submit_member_review_sp(
    IN p_plan_id UUID,
    IN p_requisition_id UUID,
    IN p_reviewer_role VARCHAR(80),
    IN p_reviewer_user_id VARCHAR(255),
    IN p_decision VARCHAR(50),
    IN p_remarks TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.submit_member_review(
        p_plan_id,
        p_requisition_id,
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    );
END;
$$;

DROP PROCEDURE IF EXISTS procurement_workflow.get_member_reviews_sp(UUID);
DROP FUNCTION IF EXISTS procurement_workflow.get_member_reviews(UUID);

CREATE OR REPLACE FUNCTION procurement_workflow.get_member_reviews(
    p_requisition_id UUID
)
RETURNS TABLE (
    review_id UUID,
    plan_id UUID,
    requisition_id UUID,
    reviewer_role VARCHAR(80),
    reviewer_user_id VARCHAR(255),
    decision VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.review_id,
        r.plan_id,
        r.requisition_id,
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.requisition_id = p_requisition_id
    ORDER BY r.updated_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_member_reviews_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_member_reviews(p_requisition_id);
END;
$$;

COMMIT;
