-- Migration 105: Enhanced Needs Analysis (7 analytical functions)
BEGIN;

-- ============================================================
-- 1. Category Breakdown — summary by procurement type
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_by_category(
    p_fiscal_year INT
)
RETURNS TABLE (
    procurement_type VARCHAR(50),
    item_count BIGINT,
    total_quantity DECIMAL(18,2),
    total_collections BIGINT,
    unique_units BIGINT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nci.procurement_type,
        COUNT(*) AS item_count,
        SUM(nci.quantity) AS total_quantity,
        COUNT(DISTINCT nc.collection_id) AS total_collections,
        COUNT(DISTINCT nc.unit_id) AS unique_units
    FROM procurement_workflow.needs_collection_items nci
    JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
    WHERE nc.fiscal_year = p_fiscal_year
      AND nc.status = 'Submitted'
    GROUP BY nci.procurement_type
    ORDER BY total_quantity DESC;
$$;

-- ============================================================
-- 2. Unit-Level Stats — per-unit submission breakdown
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_by_unit(
    p_fiscal_year INT
)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(150),
    item_count BIGINT,
    total_quantity DECIMAL(18,2),
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    collection_status VARCHAR(50)
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nc.unit_id,
        ou.unit_name,
        COUNT(nci.item_id) AS item_count,
        SUM(nci.quantity) AS total_quantity,
        nc.submitted_at,
        nc.status AS collection_status
    FROM procurement_workflow.needs_collection nc
    LEFT JOIN procurement_workflow.needs_collection_items nci ON nci.collection_id = nc.collection_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = nc.unit_id
    WHERE nc.fiscal_year = p_fiscal_year
    GROUP BY nc.unit_id, ou.unit_name, nc.submitted_at, nc.status
    ORDER BY ou.unit_name;
$$;

-- ============================================================
-- 3. Priority-Weighted Scoring — urgency × quantity ranking
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_weighted(
    p_fiscal_year INT
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    unit VARCHAR(50),
    total_quantity DECIMAL(18,2),
    occurrence_count INT,
    priority_summary TEXT,
    weighted_score DECIMAL(18,2),
    source_units JSONB
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nci.description AS item_description,
        nci.procurement_type,
        nci.unit,
        SUM(nci.quantity) AS total_quantity,
        COUNT(DISTINCT nc.collection_id)::INT AS occurrence_count,
        STRING_AGG(DISTINCT nci.priority, ', ') AS priority_summary,
        SUM(nci.quantity * CASE
            WHEN nci.priority = 'Urgent' THEN 3.0
            WHEN nci.priority = 'Strategic' THEN 2.5
            WHEN nci.priority = 'Normal' THEN 2.0
            WHEN nci.priority = 'Low' THEN 1.0
            ELSE 2.0
        END) AS weighted_score,
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('unitId', nc.unit_id, 'unitName', ou.unit_name)),
            '[]'::jsonb
        ) AS source_units
    FROM procurement_workflow.needs_collection_items nci
    JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = nc.unit_id
    WHERE nc.fiscal_year = p_fiscal_year
      AND nc.status = 'Submitted'
    GROUP BY nci.description, nci.procurement_type, nci.unit
    ORDER BY weighted_score DESC;
$$;

-- ============================================================
-- 4. Duplicate/Similar Detection — fuzzy match on descriptions
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.detect_similar_needs(
    p_fiscal_year INT
)
RETURNS TABLE (
    group_id INT,
    descriptions TEXT[],
    procurement_type VARCHAR(50),
    combined_quantity DECIMAL(18,2),
    occurrence_count INT,
    suggestion TEXT
)
LANGUAGE sql STABLE
AS $$
    WITH normalized AS (
        SELECT DISTINCT
            LOWER(TRIM(REPLACE(REPLACE(REPLACE(nci.description, '.', ''), ',', ''), '  ', ' '))) AS norm_desc,
            nci.procurement_type,
            nci.description AS original_desc,
            nci.quantity,
            nc.collection_id,
            nc.unit_id
        FROM procurement_workflow.needs_collection_items nci
        JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
        WHERE nc.fiscal_year = p_fiscal_year
          AND nc.status = 'Submitted'
    ),
    grouped AS (
        SELECT
            ROW_NUMBER() OVER (ORDER BY norm_desc) AS group_id,
            norm_desc,
            proc_type,
            agg_descs,
            agg_quantity,
            agg_count
        FROM (
            SELECT
                norm_desc,
                procurement_type AS proc_type,
                ARRAY_AGG(DISTINCT original_desc) AS agg_descs,
                SUM(quantity) AS agg_quantity,
                COUNT(DISTINCT collection_id) AS agg_count
            FROM normalized
            GROUP BY norm_desc, procurement_type
        ) sub
    )
    SELECT
        g.group_id,
        g.agg_descs AS descriptions,
        g.proc_type AS procurement_type,
        g.agg_quantity AS combined_quantity,
        g.agg_count::INT AS occurrence_count,
        CASE
            WHEN array_length(g.agg_descs, 1) > 1
            THEN 'Consider consolidating: ' || array_to_string(g.agg_descs, ' / ')
            ELSE 'Single item — no duplicates'
        END AS suggestion
    FROM grouped g
    WHERE g.agg_count > 1
    ORDER BY g.agg_quantity DESC;
$$;

-- ============================================================
-- 5. Procurement Plan Gap — compare needs vs existing plan
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_plan_gap(
    p_fiscal_year INT
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    total_quantity DECIMAL(18,2),
    source_units JSONB,
    in_plan BOOLEAN,
    plan_item_id UUID,
    plan_description TEXT,
    plan_estimated_amount DECIMAL(18,2)
)
LANGUAGE sql STABLE
AS $$
    WITH analysis AS (
        SELECT * FROM procurement_workflow.analyze_needs(p_fiscal_year)
    ),
    plan_items AS (
        SELECT
            ppi.plan_item_id,
            LOWER(TRIM(ppi.description)) AS norm_desc,
            ppi.description AS plan_description,
            ppi.procurement_type AS plan_type,
            ppi.estimated_amount
        FROM procurement_workflow.procurement_plan_items ppi
        JOIN procurement_workflow.procurement_plans pp ON pp.plan_id = ppi.plan_id
        WHERE pp.fiscal_year = p_fiscal_year
          AND pp.status IN ('Submitted', 'Approved')
          AND ppi.status = 'Active'
    )
    SELECT
        a.item_description,
        a.procurement_type,
        a.total_quantity,
        a.source_units,
        CASE WHEN pi.plan_item_id IS NOT NULL THEN TRUE ELSE FALSE END AS in_plan,
        pi.plan_item_id,
        pi.plan_description,
        pi.estimated_amount AS plan_estimated_amount
    FROM analysis a
    LEFT JOIN plan_items pi
        ON LOWER(TRIM(a.item_description)) = pi.norm_desc
        AND a.procurement_type = pi.plan_type
    ORDER BY in_plan ASC, a.total_quantity DESC;
$$;

-- ============================================================
-- 6. Threshold Flags — cross-reference with approval thresholds
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_thresholds(
    p_fiscal_year INT,
    p_estimated_unit_price DECIMAL(18,2) DEFAULT 0
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    total_quantity DECIMAL(18,2),
    estimated_total_value DECIMAL(18,2),
    threshold_route VARCHAR(80),
    requires_board BOOLEAN,
    requires_bpp BOOLEAN,
    threshold_min DECIMAL(18,2),
    threshold_max DECIMAL(18,2)
)
LANGUAGE sql STABLE
AS $$
    WITH analysis AS (
        SELECT * FROM procurement_workflow.analyze_needs(p_fiscal_year)
    )
    SELECT
        a.item_description,
        a.procurement_type,
        a.total_quantity,
        (a.total_quantity * p_estimated_unit_price) AS estimated_total_value,
        at2.approval_route,
        at2.requires_board,
        at2.requires_bpp,
        at2.min_amount,
        at2.max_amount
    FROM analysis a
    LEFT JOIN procurement_workflow.approval_thresholds at2
        ON at2.procurement_type = a.procurement_type
        AND at2.status = 'Active'
        AND (a.total_quantity * p_estimated_unit_price) >= at2.min_amount
        AND (at2.max_amount IS NULL OR (a.total_quantity * p_estimated_unit_price) < at2.max_amount)
    ORDER BY estimated_total_value DESC;
$$;

-- ============================================================
-- 7. Non-Submission Tracker — units that haven't submitted
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.get_non_submissions(
    p_fiscal_year INT
)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(150),
    unit_code VARCHAR(60),
    has_draft BOOLEAN,
    has_submission BOOLEAN,
    submission_status VARCHAR(50),
    last_updated TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ou.unit_id,
        ou.unit_name,
        ou.unit_code,
        COALESCE(nc.has_draft, FALSE) AS has_draft,
        COALESCE(nc.has_submission, FALSE) AS has_submission,
        nc.submission_status,
        nc.last_updated
    FROM identity.organizational_units ou
    LEFT JOIN LATERAL (
        SELECT
            BOOL_OR(nc2.status = 'Draft') AS has_draft,
            BOOL_OR(nc2.status = 'Submitted') AS has_submission,
            CASE
                WHEN BOOL_OR(nc2.status = 'Submitted') THEN 'Submitted'
                WHEN BOOL_OR(nc2.status = 'Draft') THEN 'Draft'
                ELSE 'Not Started'
            END AS submission_status,
            MAX(nc2.updated_at) AS last_updated
        FROM procurement_workflow.needs_collection nc2
        WHERE nc2.unit_id = ou.unit_id
          AND nc2.fiscal_year = p_fiscal_year
    ) nc ON TRUE
    WHERE ou.is_active = TRUE
      AND ou.is_assignable = TRUE
    ORDER BY
        CASE
            WHEN nc.submission_status = 'Submitted' THEN 1
            WHEN nc.submission_status = 'Draft' THEN 2
            ELSE 3
        END,
        ou.unit_name;
$$;

COMMIT;
