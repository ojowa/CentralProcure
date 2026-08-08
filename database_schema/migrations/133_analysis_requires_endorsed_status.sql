-- Fix: Analysis functions should only analyze Endorsed collections (not Submitted)
-- This ensures the endorsement step is a prerequisite for analysis

-- 1. Update analyze_needs
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs(
    p_fiscal_year INT,
    p_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    unit VARCHAR(50),
    total_quantity DECIMAL(18,2),
    occurrence_count INT,
    priority_summary TEXT,
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
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('unitId', nc.unit_id, 'unitName', ou.unit_name)),
            '[]'::jsonb
        ) AS source_units
    FROM procurement_workflow.needs_collection_items nci
    JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = nc.unit_id
    WHERE nc.fiscal_year = p_fiscal_year
      AND nc.status = 'Endorsed'
      AND (p_unit_id IS NULL OR nc.unit_id = p_unit_id)
    GROUP BY nci.description, nci.procurement_type, nci.unit
    ORDER BY total_quantity DESC;
$$;

-- 2. Update analyze_needs_by_category
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
      AND nc.status = 'Endorsed'
    GROUP BY nci.procurement_type
    ORDER BY total_quantity DESC;
$$;

-- 3. Update analyze_needs_weighted
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
      AND nc.status = 'Endorsed'
    GROUP BY nci.description, nci.procurement_type, nci.unit
    ORDER BY weighted_score DESC;
$$;

-- 4. Update analyze_needs_thresholds
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_thresholds(
    p_fiscal_year INT
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    unit VARCHAR(50),
    total_quantity DECIMAL(18,2),
    estimated_value DECIMAL(18,2),
    threshold_band VARCHAR(50)
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nci.description AS item_description,
        nci.procurement_type,
        nci.unit,
        SUM(nci.quantity) AS total_quantity,
        COALESCE(SUM(nci.quantity * 1000), 0) AS estimated_value,
        CASE
            WHEN COALESCE(SUM(nci.quantity * 1000), 0) < 50000 THEN 'Micro'
            WHEN COALESCE(SUM(nci.quantity * 1000), 0) < 500000 THEN 'Small'
            WHEN COALESCE(SUM(nci.quantity * 1000), 0) < 5000000 THEN 'Medium'
            ELSE 'Large'
        END AS threshold_band
    FROM procurement_workflow.needs_collection_items nci
    JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
    WHERE nc.fiscal_year = p_fiscal_year
      AND nc.status = 'Endorsed'
    GROUP BY nci.description, nci.procurement_type, nci.unit
    ORDER BY estimated_value DESC;
$$;

-- 5. Update analyze_needs_plan_gap to use Endorsed status
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs_plan_gap(
    p_fiscal_year INT
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    unit VARCHAR(50),
    total_quantity DECIMAL(18,2),
    in_plan BOOLEAN,
    plan_quantity DECIMAL(18,2)
)
LANGUAGE sql STABLE
AS $$
    WITH endorsed_needs AS (
        SELECT
            nci.description AS item_description,
            nci.procurement_type,
            nci.unit,
            SUM(nci.quantity) AS total_quantity
        FROM procurement_workflow.needs_collection_items nci
        JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
        WHERE nc.fiscal_year = p_fiscal_year
          AND nc.status = 'Endorsed'
        GROUP BY nci.description, nci.procurement_type, nci.unit
    ),
    existing_plan AS (
        SELECT
            ppi.description AS item_description,
            ppi.procurement_type,
            ppi.unit,
            SUM(ppi.quantity) AS plan_quantity
        FROM procurement_workflow.procurement_plan_items ppi
        JOIN procurement_workflow.procurement_plans pp ON pp.plan_id = ppi.plan_id
        WHERE pp.fiscal_year = p_fiscal_year
        GROUP BY ppi.description, ppi.procurement_type, ppi.unit
    )
    SELECT
        en.item_description,
        en.procurement_type,
        en.unit,
        en.total_quantity,
        (ep.plan_quantity IS NOT NULL) AS in_plan,
        COALESCE(ep.plan_quantity, 0) AS plan_quantity
    FROM endorsed_needs en
    LEFT JOIN existing_plan ep ON
        LOWER(en.item_description) = LOWER(ep.item_description)
        AND LOWER(en.procurement_type) = LOWER(ep.procurement_type)
        AND LOWER(en.unit) = LOWER(ep.unit)
    ORDER BY en.total_quantity DESC;
$$;

-- 6. Update non-submissions to count only Submitted or Endorsed (not Draft)
CREATE OR REPLACE FUNCTION procurement_workflow.get_non_submissions(
    p_fiscal_year INT
)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(150),
    has_submission BOOLEAN
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ou.unit_id,
        ou.unit_name,
        (nc.collection_id IS NOT NULL) AS has_submission
    FROM identity.organizational_units ou
    LEFT JOIN procurement_workflow.needs_collection nc ON
        nc.unit_id = ou.unit_id
        AND nc.fiscal_year = p_fiscal_year
        AND nc.status IN ('Submitted', 'Endorsed')
    WHERE ou.is_active = true
      AND ou.is_assignable = true
    ORDER BY ou.unit_name;
$$;
