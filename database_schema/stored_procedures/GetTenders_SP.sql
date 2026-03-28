-- Function for Getting Tenders (PostgreSQL)
DROP PROCEDURE IF EXISTS vendor_sourcing.get_tenders_sp(
    VARCHAR(50),
    VARCHAR(100),
    TEXT,
    VARCHAR(50),
    VARCHAR(4),
    INT,
    INT
);

DROP FUNCTION IF EXISTS vendor_sourcing.get_tenders(
    VARCHAR(50),
    VARCHAR(100),
    TEXT,
    VARCHAR(50),
    VARCHAR(4),
    INT,
    INT
);

CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders(
    p_status VARCHAR(50) DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'created_at',
    p_sort_dir VARCHAR(4) DEFAULT 'desc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    tender_id UUID,
    requisition_id UUID,
    title VARCHAR(500),
    category VARCHAR(100),
    status VARCHAR(50),
    budget DECIMAL(18, 2),
    department VARCHAR(150),
    budget_code VARCHAR(60),
    fiscal_year INT,
    publish_date TIMESTAMP WITHOUT TIME ZONE,
    opening_date TIMESTAMP WITHOUT TIME ZONE,
    closing_date TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
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
    FROM
        vendor_sourcing.tenders t
    WHERE
        (p_status IS NULL OR t.status ILIKE p_status)
        AND (p_category IS NULL OR t.category ILIKE '%' || p_category || '%')
        AND (
            p_query IS NULL
            OR t.title ILIKE '%' || p_query || '%'
            OR t.description ILIKE '%' || p_query || '%'
        )
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'asc' THEN t.title END ASC,
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'desc' THEN t.title END DESC,
        CASE WHEN lower(p_sort_by) = 'category' AND lower(p_sort_dir) = 'asc' THEN t.category END ASC,
        CASE WHEN lower(p_sort_by) = 'category' AND lower(p_sort_dir) = 'desc' THEN t.category END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN t.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN t.status END DESC,
        CASE WHEN lower(p_sort_by) = 'budget' AND lower(p_sort_dir) = 'asc' THEN t.budget END ASC,
        CASE WHEN lower(p_sort_by) = 'budget' AND lower(p_sort_dir) = 'desc' THEN t.budget END DESC,
        CASE WHEN lower(p_sort_by) = 'publish_date' AND lower(p_sort_dir) = 'asc' THEN t.publish_date END ASC,
        CASE WHEN lower(p_sort_by) = 'publish_date' AND lower(p_sort_dir) = 'desc' THEN t.publish_date END DESC,
        CASE WHEN lower(p_sort_by) = 'closing_date' AND lower(p_sort_dir) = 'asc' THEN t.closing_date END ASC,
        CASE WHEN lower(p_sort_by) = 'closing_date' AND lower(p_sort_dir) = 'desc' THEN t.closing_date END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN t.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN t.created_at END DESC,
        t.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

-- Function for Getting Tenders Count (PostgreSQL)
CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders_count(
    p_status VARCHAR(50) DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM vendor_sourcing.tenders t
    WHERE
        (p_status IS NULL OR t.status ILIKE p_status)
        AND (p_category IS NULL OR t.category ILIKE '%' || p_category || '%')
        AND (
            p_query IS NULL
            OR t.title ILIKE '%' || p_query || '%'
            OR t.description ILIKE '%' || p_query || '%'
        );

    RETURN v_count;
END;
$$;

-- Procedure wrapper for get_tenders (PostgreSQL)
CREATE OR REPLACE PROCEDURE vendor_sourcing.get_tenders_sp(
    IN p_status VARCHAR(50),
    IN p_category VARCHAR(100),
    IN p_query TEXT,
    IN p_sort_by VARCHAR(50),
    IN p_sort_dir VARCHAR(4),
    IN p_limit INT,
    IN p_offset INT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_tenders(
        p_status,
        p_category,
        p_query,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;

