BEGIN;

-- Remove cost columns from need assessment items
ALTER TABLE procurement_workflow.need_assessment_items DROP COLUMN IF EXISTS estimated_total_cost;
ALTER TABLE procurement_workflow.need_assessment_items DROP COLUMN IF EXISTS estimated_unit_cost;

-- Remove total cost from need assessments
ALTER TABLE procurement_workflow.need_assessments DROP COLUMN IF EXISTS total_estimated_cost;

-- Drop the existing function first because the return table structure has changed
DROP FUNCTION IF EXISTS procurement_workflow.analyze_procurement_needs(INT, UUID, VARCHAR);

-- Update analysis function to remove cost metrics
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_procurement_needs(
    p_fiscal_year INT,
    p_unit_id UUID DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT 'Endorsed'
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    unit VARCHAR(50),
    total_quantity DECIMAL(18, 2),
    occurrence_count INT,
    priority_summary TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nai.description AS item_description,
        nai.procurement_type,
        nai.unit,
        SUM(nai.quantity) AS total_quantity,
        COUNT(DISTINCT na.need_assessment_id)::INT AS occurrence_count,
        STRING_AGG(DISTINCT nai.priority, ', ') AS priority_summary
    FROM procurement_workflow.need_assessment_items nai
    JOIN procurement_workflow.need_assessments na ON na.need_assessment_id = nai.need_assessment_id
    WHERE na.fiscal_year = p_fiscal_year
      AND (p_unit_id IS NULL OR na.unit_id = p_unit_id)
      AND (p_status IS NULL OR na.status = p_status)
    GROUP BY nai.description, nai.procurement_type, nai.unit
    ORDER BY total_quantity DESC;
END;
$$;

COMMIT;
