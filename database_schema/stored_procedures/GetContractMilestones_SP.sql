-- Stored Procedure: Get Contract Milestones (PostgreSQL)
CREATE OR REPLACE FUNCTION post_award.get_contract_milestones(
    p_contract_code VARCHAR(50)
)
RETURNS TABLE (
    milestone_id UUID,
    contract_code VARCHAR(50),
    milestone_title VARCHAR(180),
    status_after VARCHAR(50),
    progress_after INTEGER,
    notes TEXT,
    contract_manager VARCHAR(150),
    recorded_by VARCHAR(255),
    recorded_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.milestone_id,
        m.contract_code,
        m.milestone_title,
        m.status_after,
        m.progress_after,
        m.notes,
        m.contract_manager,
        m.recorded_by,
        m.recorded_at
    FROM post_award.contract_milestones m
    WHERE m.contract_code = p_contract_code
    ORDER BY m.recorded_at DESC, m.created_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_contract_milestones_sp(
    IN p_contract_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_milestones(p_contract_code);
END;
$$;
