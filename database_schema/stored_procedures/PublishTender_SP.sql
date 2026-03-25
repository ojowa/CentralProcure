-- Function for Publishing a Tender (PostgreSQL)
CREATE OR REPLACE FUNCTION vendor_sourcing.publish_tender(
    p_tender_id UUID,
    p_publish_date TIMESTAMP WITHOUT TIME ZONE,
    p_opening_date TIMESTAMP WITHOUT TIME ZONE,
    p_closing_date TIMESTAMP WITHOUT TIME ZONE
)
RETURNS TABLE (
    tender_id UUID,
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    status VARCHAR(50),
    budget DECIMAL(18, 2),
    department VARCHAR(150),
    budget_code VARCHAR(60),
    fiscal_year INT,
    specifications TEXT,
    eligibility_criteria TEXT,
    evaluation_criteria TEXT,
    publish_date TIMESTAMP WITHOUT TIME ZONE,
    opening_date TIMESTAMP WITHOUT TIME ZONE,
    closing_date TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_budget DECIMAL(18, 2);
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_fiscal_year INT;
BEGIN
    UPDATE vendor_sourcing.tenders AS t
    SET
        status = 'Published',
        publish_date = COALESCE(p_publish_date, NOW()),
        opening_date = COALESCE(p_opening_date, t.opening_date),
        closing_date = COALESCE(p_closing_date, t.closing_date),
        fiscal_year = COALESCE(t.fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::int),
        updated_at = NOW()
    WHERE t.tender_id = p_tender_id
    RETURNING t.budget, t.department, t.budget_code, t.fiscal_year
    INTO v_budget, v_department, v_budget_code, v_fiscal_year;

    PERFORM procurement_workflow.reserve_budget_for_tender(
        p_tender_id,
        v_budget_code,
        v_department,
        v_fiscal_year,
        v_budget
    );

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.specifications,
        t.eligibility_criteria,
        t.evaluation_criteria,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at,
        t.updated_at
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;
END;
$$;

-- Procedure wrapper for publish_tender (PostgreSQL)
CREATE OR REPLACE PROCEDURE vendor_sourcing.publish_tender_sp(
    IN p_tender_id UUID,
    IN p_publish_date TIMESTAMP WITHOUT TIME ZONE,
    IN p_opening_date TIMESTAMP WITHOUT TIME ZONE,
    IN p_closing_date TIMESTAMP WITHOUT TIME ZONE,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.publish_tender(
        p_tender_id,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;
