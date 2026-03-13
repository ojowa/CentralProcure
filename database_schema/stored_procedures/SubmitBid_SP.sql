-- Function for Submitting a Bid (PostgreSQL)
CREATE OR REPLACE FUNCTION vendor_sourcing.submit_bid(
    p_tender_id UUID,
    p_vendor_id UUID,
    p_bid_amount DECIMAL(18, 2),
    p_technical_proposal_url TEXT,
    p_validity_period_days INT
)
RETURNS TABLE (
    bid_id UUID,
    tender_id UUID,
    vendor_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM vendor_sourcing.bids
        WHERE tender_id = p_tender_id
          AND vendor_id = p_vendor_id
    ) THEN
        RAISE EXCEPTION 'Bid already submitted for this tender.'
            USING ERRCODE = '23505';
    END IF;

    RETURN QUERY
    INSERT INTO vendor_sourcing.bids (
        tender_id,
        vendor_id,
        bid_amount,
        technical_proposal_url,
        validity_period_days,
        status
    )
    VALUES (
        p_tender_id,
        p_vendor_id,
        p_bid_amount,
        p_technical_proposal_url,
        p_validity_period_days,
        'Submitted'
    )
    RETURNING bids.bid_id, bids.tender_id, bids.vendor_id;
END;
$$;

-- Procedure wrapper for submit_bid (PostgreSQL)
CREATE OR REPLACE PROCEDURE vendor_sourcing.submit_bid_sp(
    IN p_tender_id UUID,
    IN p_vendor_id UUID,
    IN p_bid_amount DECIMAL(18, 2),
    IN p_technical_proposal_url TEXT,
    IN p_validity_period_days INT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.submit_bid(
        p_tender_id,
        p_vendor_id,
        p_bid_amount,
        p_technical_proposal_url,
        p_validity_period_days
    );
END;
$$;
