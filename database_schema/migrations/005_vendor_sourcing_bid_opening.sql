-- Migration 005: Vendor Sourcing Bid Opening Sessions (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS vendor_sourcing;

CREATE TABLE IF NOT EXISTS vendor_sourcing.bid_opening_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE CASCADE,
    session_title VARCHAR(300) NOT NULL,
    location VARCHAR(255),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
    opened_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bid_opening_status_chk'
          AND conrelid = 'vendor_sourcing.bid_opening_sessions'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.bid_opening_sessions
            ADD CONSTRAINT bid_opening_status_chk
            CHECK (status IN ('Scheduled', 'Open', 'Closed', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bid_opening_opened_chk'
          AND conrelid = 'vendor_sourcing.bid_opening_sessions'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.bid_opening_sessions
            ADD CONSTRAINT bid_opening_opened_chk
            CHECK (opened_at IS NULL OR opened_at >= scheduled_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bid_opening_closed_chk'
          AND conrelid = 'vendor_sourcing.bid_opening_sessions'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.bid_opening_sessions
            ADD CONSTRAINT bid_opening_closed_chk
            CHECK (closed_at IS NULL OR opened_at IS NULL OR closed_at >= opened_at);
    END IF;
END
$$;

-- get_bid_opening_sessions function
CREATE OR REPLACE FUNCTION vendor_sourcing.get_bid_opening_sessions(
    p_status VARCHAR(30) DEFAULT NULL,
    p_tender_id UUID DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_date_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'scheduled_at',
    p_sort_dir VARCHAR(4) DEFAULT 'asc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    session_id UUID,
    tender_id UUID,
    session_title VARCHAR(300),
    location VARCHAR(255),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(30),
    opened_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.tender_id,
        s.session_title,
        s.location,
        s.scheduled_at,
        s.status,
        s.opened_at,
        s.closed_at,
        s.created_at
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE
        (p_status IS NULL OR s.status ILIKE p_status)
        AND (p_tender_id IS NULL OR s.tender_id = p_tender_id)
        AND (
            p_query IS NULL
            OR s.session_title ILIKE '%' || p_query || '%'
            OR s.location ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR s.scheduled_at >= p_date_from)
        AND (p_date_to IS NULL OR s.scheduled_at <= p_date_to)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'session_title' AND lower(p_sort_dir) = 'asc' THEN s.session_title END ASC,
        CASE WHEN lower(p_sort_by) = 'session_title' AND lower(p_sort_dir) = 'desc' THEN s.session_title END DESC,
        CASE WHEN lower(p_sort_by) = 'location' AND lower(p_sort_dir) = 'asc' THEN s.location END ASC,
        CASE WHEN lower(p_sort_by) = 'location' AND lower(p_sort_dir) = 'desc' THEN s.location END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN s.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN s.status END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN s.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN s.created_at END DESC,
        CASE WHEN lower(p_sort_by) = 'scheduled_at' AND lower(p_sort_dir) = 'asc' THEN s.scheduled_at END ASC,
        CASE WHEN lower(p_sort_by) = 'scheduled_at' AND lower(p_sort_dir) = 'desc' THEN s.scheduled_at END DESC,
        s.scheduled_at ASC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

-- get_bid_opening_sessions_count function
CREATE OR REPLACE FUNCTION vendor_sourcing.get_bid_opening_sessions_count(
    p_status VARCHAR(30) DEFAULT NULL,
    p_tender_id UUID DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_date_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE
        (p_status IS NULL OR s.status ILIKE p_status)
        AND (p_tender_id IS NULL OR s.tender_id = p_tender_id)
        AND (
            p_query IS NULL
            OR s.session_title ILIKE '%' || p_query || '%'
            OR s.location ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR s.scheduled_at >= p_date_from)
        AND (p_date_to IS NULL OR s.scheduled_at <= p_date_to);

    RETURN v_count;
END;
$$;

-- get_bid_opening_sessions stored procedure
CREATE OR REPLACE PROCEDURE vendor_sourcing.get_bid_opening_sessions_sp(
    IN p_status VARCHAR(30),
    IN p_tender_id UUID,
    IN p_query TEXT,
    IN p_date_from TIMESTAMP WITHOUT TIME ZONE,
    IN p_date_to TIMESTAMP WITHOUT TIME ZONE,
    IN p_sort_by VARCHAR(50),
    IN p_sort_dir VARCHAR(4),
    IN p_limit INT,
    IN p_offset INT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_bid_opening_sessions(
        p_status,
        p_tender_id,
        p_query,
        p_date_from,
        p_date_to,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;

-- get_bid_opening_session_details function
CREATE OR REPLACE FUNCTION vendor_sourcing.get_bid_opening_session_details(
    p_session_id UUID
)
RETURNS TABLE (
    session_id UUID,
    tender_id UUID,
    session_title VARCHAR(300),
    location VARCHAR(255),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(30),
    opened_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.tender_id,
        s.session_title,
        s.location,
        s.scheduled_at,
        s.status,
        s.opened_at,
        s.closed_at,
        s.notes,
        s.created_at,
        s.updated_at
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE s.session_id = p_session_id;
END;
$$;

-- get_bid_opening_session_details stored procedure
CREATE OR REPLACE PROCEDURE vendor_sourcing.get_bid_opening_session_details_sp(
    IN p_session_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_bid_opening_session_details(p_session_id);
END;
$$;

-- create_bid_opening_session function
CREATE OR REPLACE FUNCTION vendor_sourcing.create_bid_opening_session(
    p_tender_id UUID,
    p_session_title VARCHAR(300),
    p_location VARCHAR(255),
    p_scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    p_status VARCHAR(30),
    p_opened_at TIMESTAMP WITHOUT TIME ZONE,
    p_closed_at TIMESTAMP WITHOUT TIME ZONE,
    p_notes TEXT
)
RETURNS TABLE (
    session_id UUID,
    tender_id UUID,
    session_title VARCHAR(300),
    location VARCHAR(255),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(30),
    opened_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO vendor_sourcing.bid_opening_sessions (
        tender_id,
        session_title,
        location,
        scheduled_at,
        status,
        opened_at,
        closed_at,
        notes
    )
    VALUES (
        p_tender_id,
        p_session_title,
        p_location,
        p_scheduled_at,
        COALESCE(p_status, 'Scheduled'),
        p_opened_at,
        p_closed_at,
        p_notes
    )
    RETURNING bid_opening_sessions.session_id INTO v_session_id;

    RETURN QUERY
    SELECT * FROM vendor_sourcing.get_bid_opening_session_details(v_session_id);
END;
$$;

-- create_bid_opening_session stored procedure
CREATE OR REPLACE PROCEDURE vendor_sourcing.create_bid_opening_session_sp(
    IN p_tender_id UUID,
    IN p_session_title VARCHAR(300),
    IN p_location VARCHAR(255),
    IN p_scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_status VARCHAR(30),
    IN p_opened_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_closed_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_notes TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.create_bid_opening_session(
        p_tender_id,
        p_session_title,
        p_location,
        p_scheduled_at,
        p_status,
        p_opened_at,
        p_closed_at,
        p_notes
    );
END;
$$;

-- update_bid_opening_session function
CREATE OR REPLACE FUNCTION vendor_sourcing.update_bid_opening_session(
    p_session_id UUID,
    p_session_title VARCHAR(300),
    p_location VARCHAR(255),
    p_scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    p_status VARCHAR(30),
    p_opened_at TIMESTAMP WITHOUT TIME ZONE,
    p_closed_at TIMESTAMP WITHOUT TIME ZONE,
    p_notes TEXT
)
RETURNS TABLE (
    session_id UUID,
    tender_id UUID,
    session_title VARCHAR(300),
    location VARCHAR(255),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(30),
    opened_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE vendor_sourcing.bid_opening_sessions
    SET
        session_title = COALESCE(p_session_title, session_title),
        location = COALESCE(p_location, location),
        scheduled_at = COALESCE(p_scheduled_at, scheduled_at),
        status = COALESCE(p_status, status),
        opened_at = COALESCE(p_opened_at, opened_at),
        closed_at = COALESCE(p_closed_at, closed_at),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN QUERY
    SELECT * FROM vendor_sourcing.get_bid_opening_session_details(p_session_id);
END;
$$;

-- update_bid_opening_session stored procedure
CREATE OR REPLACE PROCEDURE vendor_sourcing.update_bid_opening_session_sp(
    IN p_session_id UUID,
    IN p_session_title VARCHAR(300),
    IN p_location VARCHAR(255),
    IN p_scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_status VARCHAR(30),
    IN p_opened_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_closed_at TIMESTAMP WITHOUT TIME ZONE,
    IN p_notes TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.update_bid_opening_session(
        p_session_id,
        p_session_title,
        p_location,
        p_scheduled_at,
        p_status,
        p_opened_at,
        p_closed_at,
        p_notes
    );
END;
$$;

COMMIT;
