-- Function for Getting Bid Opening Sessions (PostgreSQL)
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

-- Function for Getting Bid Opening Sessions Count (PostgreSQL)
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

-- Procedure wrapper for get_bid_opening_sessions (PostgreSQL)
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
