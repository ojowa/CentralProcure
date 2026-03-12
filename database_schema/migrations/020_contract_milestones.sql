-- Migration 020: Contract milestone tracking (PostgreSQL)
BEGIN;

CREATE TABLE IF NOT EXISTS post_award.contract_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_code VARCHAR(50) NOT NULL REFERENCES post_award.contracts(contract_code) ON DELETE CASCADE,
    milestone_title VARCHAR(180) NOT NULL,
    status_after VARCHAR(50) NOT NULL,
    progress_after INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL,
    contract_manager VARCHAR(150) NOT NULL,
    recorded_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    recorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contract_milestones_progress_chk'
          AND conrelid = 'post_award.contract_milestones'::regclass
    ) THEN
        ALTER TABLE post_award.contract_milestones
            ADD CONSTRAINT contract_milestones_progress_chk
            CHECK (progress_after BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contract_milestones_status_chk'
          AND conrelid = 'post_award.contract_milestones'::regclass
    ) THEN
        ALTER TABLE post_award.contract_milestones
            ADD CONSTRAINT contract_milestones_status_chk
            CHECK (status_after IN ('Active', 'On Hold', 'Completed', 'Terminated'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS contract_milestones_contract_idx
    ON post_award.contract_milestones (contract_code, recorded_at DESC);

INSERT INTO post_award.contract_milestones (
    contract_code,
    milestone_title,
    status_after,
    progress_after,
    notes,
    contract_manager,
    recorded_by,
    recorded_at,
    created_at
)
SELECT
    c.contract_code,
    'Baseline contract record',
    c.status,
    c.progress,
    COALESCE(NULLIF(c.notes, ''), 'Initial contract state migrated into milestone tracking.'),
    c.contract_manager,
    COALESCE(NULLIF(c.updated_by, ''), NULLIF(c.created_by, ''), 'migration'),
    COALESCE(c.updated_at, c.created_at, NOW()),
    COALESCE(c.updated_at, c.created_at, NOW())
FROM post_award.contracts c
WHERE NOT EXISTS (
    SELECT 1
    FROM post_award.contract_milestones m
    WHERE m.contract_code = c.contract_code
);

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

CREATE OR REPLACE FUNCTION post_award.log_contract_milestone(
    p_contract_code VARCHAR(50),
    p_milestone_title VARCHAR(180),
    p_status VARCHAR(50),
    p_progress INTEGER,
    p_notes TEXT,
    p_contract_manager VARCHAR(150),
    p_recorded_by VARCHAR(255)
)
RETURNS TABLE (
    contract_id UUID,
    contract_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    contract_value DECIMAL(18, 2),
    status VARCHAR(50),
    start_date TIMESTAMP WITHOUT TIME ZONE,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    progress INTEGER,
    contract_manager VARCHAR(150),
    notes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_contract_manager VARCHAR(150);
    v_recorded_by VARCHAR(255);
BEGIN
    IF p_milestone_title IS NULL OR btrim(p_milestone_title) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MilestoneTitle is required.';
    END IF;

    IF p_notes IS NULL OR btrim(p_notes) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Notes are required.';
    END IF;

    IF p_progress < 0 OR p_progress > 100 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Progress must be between 0 and 100.';
    END IF;

    IF p_status NOT IN ('Active', 'On Hold', 'Completed', 'Terminated') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Status is invalid for contract management.';
    END IF;

    UPDATE post_award.contracts AS c
    SET
        status = p_status,
        progress = p_progress,
        notes = p_notes,
        contract_manager = COALESCE(NULLIF(btrim(p_contract_manager), ''), c.contract_manager),
        updated_by = COALESCE(NULLIF(btrim(p_recorded_by), ''), CURRENT_USER),
        updated_at = NOW()
    WHERE c.contract_code = p_contract_code
    RETURNING c.contract_manager, c.updated_by
    INTO v_contract_manager, v_recorded_by;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO post_award.contract_milestones (
        contract_code,
        milestone_title,
        status_after,
        progress_after,
        notes,
        contract_manager,
        recorded_by
    )
    VALUES (
        p_contract_code,
        p_milestone_title,
        p_status,
        p_progress,
        p_notes,
        v_contract_manager,
        v_recorded_by
    );

    RETURN QUERY
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status,
        c.start_date,
        c.end_date,
        c.progress,
        c.contract_manager,
        c.notes
    FROM post_award.contracts c
    WHERE c.contract_code = p_contract_code;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.log_contract_milestone_sp(
    IN p_contract_code VARCHAR(50),
    IN p_milestone_title VARCHAR(180),
    IN p_status VARCHAR(50),
    IN p_progress INTEGER,
    IN p_notes TEXT,
    IN p_contract_manager VARCHAR(150),
    IN p_recorded_by VARCHAR(255),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.log_contract_milestone(
        p_contract_code,
        p_milestone_title,
        p_status,
        p_progress,
        p_notes,
        p_contract_manager,
        p_recorded_by
    );
END;
$$;

COMMIT;
