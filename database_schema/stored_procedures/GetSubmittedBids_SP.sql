-- Function for Getting Submitted Bids by a Vendor (PostgreSQL)
CREATE OR REPLACE FUNCTION vendor_sourcing.get_submitted_bids(
    p_vendor_id UUID
)
RETURNS TABLE (
    bid_id UUID,
    tender_id UUID,
    vendor_id UUID,
    bid_amount DECIMAL(18, 2),
    technical_proposal_url TEXT,
    validity_period_days INT,
    submission_date TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.bid_id,
        b.tender_id,
        b.vendor_id,
        b.bid_amount,
        b.technical_proposal_url,
        b.validity_period_days,
        b.submission_date,
        b.status
    FROM
        vendor_sourcing.bids b
    WHERE
        b.vendor_id = p_vendor_id
    ORDER BY
        b.submission_date DESC;
END;
$$;

-- Procedure wrapper for get_submitted_bids (PostgreSQL)
CREATE OR REPLACE PROCEDURE vendor_sourcing.get_submitted_bids_sp(
    IN p_vendor_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_submitted_bids(p_vendor_id);
END;
$$;
