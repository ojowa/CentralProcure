BEGIN;

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
        FROM vendor_sourcing.bids AS b
        WHERE b.tender_id = p_tender_id
          AND b.vendor_id = p_vendor_id
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
    RETURNING vendor_sourcing.bids.bid_id,
              vendor_sourcing.bids.tender_id,
              vendor_sourcing.bids.vendor_id;
END;
$$;

COMMIT;
