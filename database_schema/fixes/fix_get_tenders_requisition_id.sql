DROP FUNCTION IF EXISTS vendor_sourcing.get_tenders(character varying, text, integer, integer);

CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders(
  p_status character varying DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE(
  tender_id uuid,
  title character varying,
  category character varying,
  status character varying,
  budget numeric,
  department character varying,
  budget_code character varying,
  fiscal_year integer,
  publish_date timestamp without time zone,
  opening_date timestamp without time zone,
  closing_date timestamp without time zone,
  created_at timestamp without time zone
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.tender_id,
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
