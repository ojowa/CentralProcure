-- Function for Getting Open Tenders (PostgreSQL)
CREATE OR REPLACE FUNCTION vendor_sourcing.get_open_tenders()
RETURNS TABLE (
    tender_id UUID,
    title VARCHAR(255),
    category VARCHAR(100),
    status VARCHAR(50),
    closing_date TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.category,
        t.status,
        t.closing_date
    FROM
        vendor_sourcing.tenders t
    WHERE
        t.status = 'Published' AND t.closing_date > NOW()
    ORDER BY
        t.closing_date ASC;
END;
$$;

-- Procedure wrapper for get_open_tenders (PostgreSQL)
CREATE OR REPLACE PROCEDURE vendor_sourcing.get_open_tenders_sp(
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_open_tenders();
END;
$$;

