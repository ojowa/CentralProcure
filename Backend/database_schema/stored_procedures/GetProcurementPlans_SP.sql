-- Function for Getting Procurement Plans (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.get_procurement_plans(
    p_fiscal_year INT DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'created_at',
    p_sort_dir VARCHAR(4) DEFAULT 'desc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    plan_id UUID,
    plan_title VARCHAR(255),
    department VARCHAR(150),
    fiscal_year INT,
    status VARCHAR(50),
    total_budget DECIMAL(18, 2),
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status,
        p.total_budget,
        p.created_at
    FROM
        procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'plan_title' AND lower(p_sort_dir) = 'asc' THEN p.plan_title END ASC,
        CASE WHEN lower(p_sort_by) = 'plan_title' AND lower(p_sort_dir) = 'desc' THEN p.plan_title END DESC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'asc' THEN p.department END ASC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'desc' THEN p.department END DESC,
        CASE WHEN lower(p_sort_by) = 'fiscal_year' AND lower(p_sort_dir) = 'asc' THEN p.fiscal_year END ASC,
        CASE WHEN lower(p_sort_by) = 'fiscal_year' AND lower(p_sort_dir) = 'desc' THEN p.fiscal_year END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN p.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN p.status END DESC,
        CASE WHEN lower(p_sort_by) = 'total_budget' AND lower(p_sort_dir) = 'asc' THEN p.total_budget END ASC,
        CASE WHEN lower(p_sort_by) = 'total_budget' AND lower(p_sort_dir) = 'desc' THEN p.total_budget END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN p.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN p.created_at END DESC,
        p.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

-- get_procurement_plans_count function
CREATE OR REPLACE FUNCTION procurement_workflow.get_procurement_plans_count(
    p_fiscal_year INT DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM procurement_workflow.procurement_plans p
    WHERE
        (p_fiscal_year IS NULL OR p.fiscal_year = p_fiscal_year)
        AND (p_department IS NULL OR p.department ILIKE '%' || p_department || '%')
        AND (p_status IS NULL OR p.status ILIKE p_status);

    RETURN v_count;
END;
$$;

-- Procedure wrapper for get_procurement_plans (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_procurement_plans_sp(
    IN p_fiscal_year INT,
    IN p_department VARCHAR(150),
    IN p_status VARCHAR(50),
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
    SELECT * FROM procurement_workflow.get_procurement_plans(
        p_fiscal_year,
        p_department,
        p_status,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;
