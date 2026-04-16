BEGIN;

-- Function to analyze and aggregate procurement needs across the organization
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
    avg_unit_cost DECIMAL(18, 2),
    total_estimated_cost DECIMAL(18, 2),
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
        AVG(nai.estimated_unit_cost) AS avg_unit_cost,
        SUM(nai.quantity * nai.estimated_unit_cost) AS total_estimated_cost,
        COUNT(DISTINCT na.need_assessment_id)::INT AS occurrence_count,
        STRING_AGG(DISTINCT nai.priority, ', ') AS priority_summary
    FROM procurement_workflow.need_assessment_items nai
    JOIN procurement_workflow.need_assessments na ON na.need_assessment_id = nai.need_assessment_id
    WHERE na.fiscal_year = p_fiscal_year
      AND (p_unit_id IS NULL OR na.unit_id = p_unit_id)
      AND (p_status IS NULL OR na.status = p_status)
    GROUP BY nai.description, nai.procurement_type, nai.unit
    ORDER BY total_estimated_cost DESC;
END;
$$;

-- Stored Procedure wrapper for the analysis tool
CREATE OR REPLACE PROCEDURE procurement_workflow.analyze_procurement_needs_sp(
    IN p_fiscal_year INT,
    IN p_unit_id UUID,
    IN p_status VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.analyze_procurement_needs(p_fiscal_year, p_unit_id, p_status);
END;
$$;

COMMIT;
