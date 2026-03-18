-- Migration 037: Planning Committee Review Implementation (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;

-- Table to track individual member reviews
CREATE TABLE IF NOT EXISTS procurement_workflow.planning_committee_member_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL,
    reviewer_role VARCHAR(80) NOT NULL, -- e.g., 'planning_statistics_officer', 'financial_unit_officer', 'legal_reviewer'
    reviewer_user_id VARCHAR(255) NOT NULL,
    decision VARCHAR(50) NOT NULL, -- 'Cleared', 'Queried', 'Rejected'
    remarks TEXT NULL,
    -- Audit fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_member_review_plan
        FOREIGN KEY (plan_id)
        REFERENCES procurement_workflow.procurement_plans(plan_id)
        ON DELETE CASCADE,
    CONSTRAINT member_review_decision_chk
        CHECK (decision IN ('Cleared', 'Queried', 'Rejected'))
);

CREATE INDEX IF NOT EXISTS idx_member_review_plan ON procurement_workflow.planning_committee_member_reviews(plan_id);

-- Table to track consolidated committee decision
CREATE TABLE IF NOT EXISTS procurement_workflow.planning_committee_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL UNIQUE,
    chairman_user_id VARCHAR(255) NOT NULL,
    secretary_user_id VARCHAR(255) NOT NULL,
    overall_decision VARCHAR(50) NOT NULL, -- 'Recommended', 'Returned', 'Rejected'
    committee_remarks TEXT NULL,
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Audit fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_committee_decision_plan
        FOREIGN KEY (plan_id)
        REFERENCES procurement_workflow.procurement_plans(plan_id)
        ON DELETE CASCADE,
    CONSTRAINT committee_decision_overall_chk
        CHECK (overall_decision IN ('Recommended', 'Returned', 'Rejected'))
);

-- Stored Procedures

-- Submit member review
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
    ON CONFLICT (plan_id, reviewer_role, reviewer_user_id) DO UPDATE
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

-- Note: Need unique constraint for ON CONFLICT
ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT uq_member_review_plan_role_user UNIQUE (plan_id, reviewer_role, reviewer_user_id);

-- Submit committee decision
CREATE OR REPLACE FUNCTION procurement_workflow.submit_committee_decision(
    p_plan_id UUID,
    p_chairman_user_id VARCHAR(255),
    p_secretary_user_id VARCHAR(255),
    p_overall_decision VARCHAR(50),
    p_committee_remarks TEXT,
    p_meeting_date DATE
)
RETURNS TABLE (
    decision_id UUID,
    plan_id UUID,
    overall_decision VARCHAR(50),
    committee_remarks TEXT,
    meeting_date DATE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_decision_id UUID;
    v_plan_status VARCHAR(50);
BEGIN
    INSERT INTO procurement_workflow.planning_committee_decisions (
        plan_id,
        chairman_user_id,
        secretary_user_id,
        overall_decision,
        committee_remarks,
        meeting_date
    )
    VALUES (
        p_plan_id,
        p_chairman_user_id,
        p_secretary_user_id,
        p_overall_decision,
        p_committee_remarks,
        COALESCE(p_meeting_date, CURRENT_DATE)
    )
    ON CONFLICT (plan_id) DO UPDATE
    SET
        overall_decision = EXCLUDED.overall_decision,
        committee_remarks = EXCLUDED.committee_remarks,
        meeting_date = EXCLUDED.meeting_date,
        updated_at = NOW()
    RETURNING planning_committee_decisions.decision_id INTO v_decision_id;

    -- Update plan status based on decision
    -- In this system, 'Submitted' status is used for plans that are active in the workflow beyond Draft.
    -- The specific stage is managed by the workflow_runtime_tracker.
    IF p_overall_decision = 'Recommended' THEN
        v_plan_status := 'Submitted'; 
    ELSIF p_overall_decision = 'Returned' THEN
        v_plan_status := 'Draft'; -- Return to department
    ELSIF p_overall_decision = 'Rejected' THEN
        v_plan_status := 'Rejected';
    ELSE
        v_plan_status := 'Submitted';
    END IF;

    UPDATE procurement_workflow.procurement_plans
    SET status = v_plan_status, updated_at = NOW()
    WHERE plan_id = p_plan_id;

    RETURN QUERY
    SELECT
        d.decision_id,
        d.plan_id,
        d.overall_decision,
        d.committee_remarks,
        d.meeting_date,
        d.created_at
    FROM procurement_workflow.planning_committee_decisions d
    WHERE d.decision_id = v_decision_id;
END;
$$;

-- Get member reviews for a plan
CREATE OR REPLACE FUNCTION procurement_workflow.get_member_reviews(
    p_plan_id UUID
)
RETURNS TABLE (
    review_id UUID,
    plan_id UUID,
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
        r.reviewer_role,
        r.reviewer_user_id,
        r.decision,
        r.remarks,
        r.created_at,
        r.updated_at
    FROM procurement_workflow.planning_committee_member_reviews r
    WHERE r.plan_id = p_plan_id
    ORDER BY r.created_at;
END;
$$;

-- Stored Procedures (SP wrappers)

CREATE OR REPLACE PROCEDURE procurement_workflow.submit_member_review_sp(
    IN p_plan_id UUID,
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
        p_reviewer_role,
        p_reviewer_user_id,
        p_decision,
        p_remarks
    );
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.submit_committee_decision_sp(
    IN p_plan_id UUID,
    IN p_chairman_user_id VARCHAR(255),
    IN p_secretary_user_id VARCHAR(255),
    IN p_overall_decision VARCHAR(50),
    IN p_committee_remarks TEXT,
    IN p_meeting_date DATE,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.submit_committee_decision(
        p_plan_id,
        p_chairman_user_id,
        p_secretary_user_id,
        p_overall_decision,
        p_committee_remarks,
        p_meeting_date
    );
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_member_reviews_sp(
    IN p_plan_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_member_reviews(p_plan_id);
END;
$$;

COMMIT;
