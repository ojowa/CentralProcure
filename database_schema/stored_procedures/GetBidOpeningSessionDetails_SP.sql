-- Function for Getting Bid Opening Session Details (PostgreSQL)
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

-- Procedure wrapper for get_bid_opening_session_details (PostgreSQL)
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
