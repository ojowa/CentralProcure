CREATE OR REPLACE FUNCTION procurement_workflow.get_requisitions_sp(
    p_status VARCHAR DEFAULT '',
    p_department VARCHAR DEFAULT '',
    p_query TEXT DEFAULT '',
    p_sort_by VARCHAR DEFAULT 'created_at',
    p_sort_dir VARCHAR DEFAULT 'DESC',
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    requisition_id UUID,
    title VARCHAR,
    department VARCHAR,
    unit_id UUID,
    app_item_id UUID,
    app_item_description TEXT,
    status VARCHAR,
    priority VARCHAR,
    funding_source VARCHAR,
    total_estimate NUMERIC,
    required_by TIMESTAMP,
    created_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM procurement_workflow.get_requisitions(
        NULLIF(p_status, ''),
        NULLIF(p_department, ''),
        NULL,          -- priority
        NULLIF(p_query, ''),
        NULL,          -- date_from
        NULL,          -- date_to
        p_sort_by,
        p_sort_dir,
        p_page_size,
        (p_page - 1) * p_page_size
    );
$$;
