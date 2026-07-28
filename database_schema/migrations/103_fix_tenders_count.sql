CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders_count(
    p_status VARCHAR DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql STABLE
AS $$
    SELECT COUNT(*) FROM vendor_sourcing.tenders t
    WHERE (p_status IS NULL OR p_status = '' OR t.status = p_status)
      AND (p_query IS NULL OR p_query = '' OR t.title ILIKE '%' || p_query || '%');
$$;
