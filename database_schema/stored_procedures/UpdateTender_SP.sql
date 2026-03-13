-- Function for Updating a Tender (PostgreSQL)
CREATE OR REPLACE FUNCTION vendor_sourcing.update_tender(
    p_tender_id UUID,
    p_title VARCHAR(500),
    p_description TEXT,
    p_category VARCHAR(100),
    p_status VARCHAR(50),
    p_budget DECIMAL(18, 2),
    p_department VARCHAR(150),
    p_budget_code VARCHAR(60),
    p_fiscal_year INT,
    p_specifications TEXT,
    p_eligibility_criteria TEXT,
    p_evaluation_criteria TEXT,
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
    v_existing_status VARCHAR(50);
    v_existing_budget DECIMAL(18, 2);
    v_existing_department VARCHAR(150);
    v_existing_budget_code VARCHAR(60);
    v_existing_fiscal_year INT;
    v_status VARCHAR(50);
    v_budget DECIMAL(18, 2);
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_fiscal_year INT;
BEGIN
    SELECT t.status, t.budget, t.department, t.budget_code, t.fiscal_year
    INTO v_existing_status, v_existing_budget, v_existing_department, v_existing_budget_code, v_existing_fiscal_year
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;

    v_status := COALESCE(p_status, v_existing_status);
    v_budget := COALESCE(p_budget, v_existing_budget);
    v_department := COALESCE(p_department, v_existing_department);
    v_budget_code := COALESCE(p_budget_code, v_existing_budget_code);
    v_fiscal_year := COALESCE(p_fiscal_year, v_existing_fiscal_year, EXTRACT(YEAR FROM NOW())::int);

    UPDATE vendor_sourcing.tenders
    SET
        title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        category = COALESCE(p_category, category),
        status = COALESCE(p_status, status),
        budget = COALESCE(p_budget, budget),
        department = v_department,
        budget_code = v_budget_code,
        fiscal_year = v_fiscal_year,
        specifications = COALESCE(p_specifications, specifications),
        eligibility_criteria = COALESCE(p_eligibility_criteria, eligibility_criteria),
        evaluation_criteria = COALESCE(p_evaluation_criteria, evaluation_criteria),
        publish_date = COALESCE(p_publish_date, publish_date),
        opening_date = COALESCE(p_opening_date, opening_date),
        closing_date = COALESCE(p_closing_date, closing_date),
        updated_at = NOW()
    WHERE tender_id = p_tender_id;

    IF v_status IN ('Published', 'Closed', 'Awarded') THEN
        PERFORM procurement_workflow.reserve_budget_for_tender(
            p_tender_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_budget
        );
    ELSIF v_status IN ('Draft', 'Cancelled') THEN
        PERFORM procurement_workflow.release_budget_for_tender(p_tender_id);
    END IF;

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

-- Procedure wrapper for update_tender (PostgreSQL)
CREATE OR REPLACE PROCEDURE vendor_sourcing.update_tender_sp(
    IN p_tender_id UUID,
    IN p_title VARCHAR(500),
    IN p_description TEXT,
    IN p_category VARCHAR(100),
    IN p_status VARCHAR(50),
    IN p_budget DECIMAL(18, 2),
    IN p_department VARCHAR(150),
    IN p_budget_code VARCHAR(60),
    IN p_fiscal_year INT,
    IN p_specifications TEXT,
    IN p_eligibility_criteria TEXT,
    IN p_evaluation_criteria TEXT,
    IN p_publish_date TIMESTAMP WITHOUT TIME ZONE,
    IN p_opening_date TIMESTAMP WITHOUT TIME ZONE,
    IN p_closing_date TIMESTAMP WITHOUT TIME ZONE,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.update_tender(
        p_tender_id,
        p_title,
        p_description,
        p_category,
        p_status,
        p_budget,
        p_department,
        p_budget_code,
        p_fiscal_year,
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;
