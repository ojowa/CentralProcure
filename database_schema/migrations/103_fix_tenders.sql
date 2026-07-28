CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders(
    p_status VARCHAR DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    tender_id UUID,
    requisition_id UUID,
    title VARCHAR,
    category VARCHAR,
    status VARCHAR,
    budget NUMERIC,
    department VARCHAR,
    budget_code VARCHAR,
    fiscal_year INTEGER,
    publish_date TIMESTAMP,
    opening_date TIMESTAMP,
    closing_date TIMESTAMP,
    created_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT
        t.tender_id,
        t.requisition_id,
        t.title,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at
    FROM vendor_sourcing.tenders t
    WHERE (p_status IS NULL OR p_status = '' OR t.status = p_status)
      AND (p_query IS NULL OR p_query = '' OR t.title ILIKE '%' || p_query || '%')
    ORDER BY t.created_at DESC
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
$$;
