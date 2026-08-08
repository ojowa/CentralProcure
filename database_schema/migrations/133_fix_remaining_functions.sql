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
            COUNT(*)::DECIMAL(18,2) AS plan_quantity
        FROM procurement_workflow.procurement_plan_items ppi
        JOIN procurement_workflow.procurement_plans pp ON pp.plan_id = ppi.plan_id
        WHERE pp.fiscal_year = p_fiscal_year
        GROUP BY ppi.description, ppi.procurement_type
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
    ORDER BY en.total_quantity DESC;
$$;
