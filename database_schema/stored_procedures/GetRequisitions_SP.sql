-- Function for Getting Requisitions (PostgreSQL)
DROP PROCEDURE IF EXISTS procurement_workflow.get_requisitions_sp(
    VARCHAR(50),
    VARCHAR(150),
    VARCHAR(50),
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    VARCHAR(50),
    VARCHAR(4),
    INT,
    INT
);
DROP FUNCTION IF EXISTS procurement_workflow.get_requisitions(
    VARCHAR(50),
    VARCHAR(150),
    VARCHAR(50),
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    VARCHAR(50),
    VARCHAR(4),
    INT,
    INT
);

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisitions(
    p_status VARCHAR(50) DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_priority VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_date_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'created_at',
    p_sort_dir VARCHAR(4) DEFAULT 'desc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    requisition_id UUID,
    title VARCHAR(255),
    department VARCHAR(150),
    unit_id UUID,
    status VARCHAR(50),
    priority VARCHAR(50),
    funding_source VARCHAR(120),
    total_estimate DECIMAL(18, 2),
    required_by TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        r.unit_id,
        r.status,
        r.priority,
        r.funding_source,
        r.total_estimate,
        r.required_by,
        r.created_at
    FROM
        procurement_workflow.requisitions r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (p_department IS NULL OR r.department ILIKE '%' || p_department || '%')
        AND (p_priority IS NULL OR r.priority ILIKE p_priority)
        AND (
            p_query IS NULL
            OR r.title ILIKE '%' || p_query || '%'
            OR r.department ILIKE '%' || p_query || '%'
            OR r.requisition_id::text ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR r.created_at >= p_date_from)
        AND (p_date_to IS NULL OR r.created_at <= p_date_to)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'asc' THEN r.title END ASC,
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'desc' THEN r.title END DESC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'asc' THEN r.department END ASC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'desc' THEN r.department END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN r.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN r.status END DESC,
        CASE WHEN lower(p_sort_by) = 'priority' AND lower(p_sort_dir) = 'asc' THEN r.priority END ASC,
        CASE WHEN lower(p_sort_by) = 'priority' AND lower(p_sort_dir) = 'desc' THEN r.priority END DESC,
        CASE WHEN lower(p_sort_by) = 'total_estimate' AND lower(p_sort_dir) = 'asc' THEN r.total_estimate END ASC,
        CASE WHEN lower(p_sort_by) = 'total_estimate' AND lower(p_sort_dir) = 'desc' THEN r.total_estimate END DESC,
        CASE WHEN lower(p_sort_by) = 'required_by' AND lower(p_sort_dir) = 'asc' THEN r.required_by END ASC,
        CASE WHEN lower(p_sort_by) = 'required_by' AND lower(p_sort_dir) = 'desc' THEN r.required_by END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN r.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN r.created_at END DESC,
        r.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

-- Function for Getting Requisitions Count (PostgreSQL)
CREATE OR REPLACE FUNCTION procurement_workflow.get_requisitions_count(
    p_status VARCHAR(50) DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_priority VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_date_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM procurement_workflow.requisitions r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (p_department IS NULL OR r.department ILIKE '%' || p_department || '%')
        AND (p_priority IS NULL OR r.priority ILIKE p_priority)
        AND (
            p_query IS NULL
            OR r.title ILIKE '%' || p_query || '%'
            OR r.department ILIKE '%' || p_query || '%'
            OR r.requisition_id::text ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR r.created_at >= p_date_from)
        AND (p_date_to IS NULL OR r.created_at <= p_date_to);

    RETURN v_count;
END;
$$;

-- Procedure wrapper for get_requisitions (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_requisitions_sp(
    IN p_status VARCHAR(50),
    IN p_department VARCHAR(150),
    IN p_priority VARCHAR(50),
    IN p_query TEXT,
    IN p_date_from TIMESTAMP WITHOUT TIME ZONE,
    IN p_date_to TIMESTAMP WITHOUT TIME ZONE,
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
    SELECT * FROM procurement_workflow.get_requisitions(
        p_status,
        p_department,
        p_priority,
        p_query,
        p_date_from,
        p_date_to,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;
