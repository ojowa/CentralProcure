-- Function for Updating Bid Opening Session (PostgreSQL)
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

-- Procedure wrapper for update_bid_opening_session (PostgreSQL)
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
