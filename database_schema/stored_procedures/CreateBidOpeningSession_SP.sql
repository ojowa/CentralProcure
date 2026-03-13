-- Function for Creating Bid Opening Session (PostgreSQL)
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

-- Procedure wrapper for create_bid_opening_session (PostgreSQL)
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
