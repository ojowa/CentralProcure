-- Function for Creating a Requisition (PostgreSQL)
DROP PROCEDURE IF EXISTS procurement_workflow.create_requisition_sp(
    VARCHAR(255),
    VARCHAR(150),
    VARCHAR(50),
    VARCHAR(50),
    VARCHAR(50),
    VARCHAR(120),
    VARCHAR(60),
    UUID,
    VARCHAR(60),
    TIMESTAMP WITHOUT TIME ZONE,
    TEXT,
    TEXT,
    TEXT,
    JSONB
);
DROP FUNCTION IF EXISTS procurement_workflow.create_requisition(
    VARCHAR(255),
    VARCHAR(150),
    VARCHAR(50),
    VARCHAR(50),
    VARCHAR(50),
    VARCHAR(120),
    VARCHAR(60),
    UUID,
    VARCHAR(60),
    TIMESTAMP WITHOUT TIME ZONE,
    TEXT,
    TEXT,
    TEXT,
    JSONB
);

CREATE OR REPLACE FUNCTION procurement_workflow.resolve_requisition_stage(p_status VARCHAR(50))
RETURNS VARCHAR(60)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CASE
        WHEN p_status IS NULL THEN 'department_user'
        WHEN p_status ILIKE 'Submitted' THEN 'procurement_officer'
        WHEN p_status ILIKE 'Under Review' THEN 'procurement_officer'
        WHEN p_status ILIKE 'Evaluation' THEN 'evaluation_committee'
        WHEN p_status ILIKE 'Board Review' THEN 'tenders_board'
        WHEN p_status ILIKE 'Approved' THEN 'accounting_officer'
        WHEN p_status ILIKE 'Rejected' THEN 'department_user'
        ELSE 'department_user'
    END;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.create_requisition(
    p_title VARCHAR(255),
    p_department VARCHAR(150),
    p_unit_id UUID,
    p_status VARCHAR(50),
    p_priority VARCHAR(50),
    p_procurement_type VARCHAR(50),
    p_funding_source VARCHAR(120),
    p_budget_code VARCHAR(60),
    p_app_item_id UUID,
    p_project_code VARCHAR(60),
    p_required_by TIMESTAMP WITHOUT TIME ZONE,
    p_delivery_location TEXT,
    p_justification TEXT,
    p_risk_notes TEXT,
    p_line_items JSONB
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
    created_at TIMESTAMP WITHOUT TIME ZONE,
    procurement_type VARCHAR(50),
    budget_code VARCHAR(60),
    app_item_id UUID,
    project_code VARCHAR(60),
    delivery_location TEXT,
    justification TEXT,
    risk_notes TEXT,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    current_stage VARCHAR(60)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_requisition_id UUID;
    v_total_estimate DECIMAL(18, 2);
    v_status VARCHAR(50);
    v_fiscal_year INT;
    v_budget_code VARCHAR(60);
    v_plan_status VARCHAR(50);
    v_plan_department VARCHAR(150);
    v_item_budget_code VARCHAR(60);
    v_item_status VARCHAR(30);
    v_department VARCHAR(150);
    v_unit_id UUID;
BEGIN
    v_unit_id := p_unit_id;
    v_budget_code := p_budget_code;

    IF v_unit_id IS NOT NULL THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE ou.unit_id = p_unit_id
          AND ou.is_active = TRUE
          AND ou.is_assignable = TRUE;

        IF v_department IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Organizational unit is invalid or inactive.';
        END IF;
    ELSIF p_department IS NOT NULL AND btrim(p_department) <> '' THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE LOWER(ou.unit_name) = LOWER(btrim(p_department))
          AND ou.is_active = TRUE
          AND ou.is_assignable = TRUE
        LIMIT 1;

        v_department := COALESCE(v_department, btrim(p_department));
    END IF;

    v_department := COALESCE(v_department, NULLIF(btrim(p_department), ''));

    IF v_department IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department or organizational unit is required.';
    END IF;

    IF p_app_item_id IS NOT NULL THEN
        SELECT p.status, p.department, i.budget_code, i.status
        INTO v_plan_status, v_plan_department, v_item_budget_code, v_item_status
        FROM procurement_workflow.procurement_plan_items i
        JOIN procurement_workflow.procurement_plans p ON p.plan_id = i.plan_id
        WHERE i.plan_item_id = p_app_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item not found.';
        END IF;

        IF v_item_status <> 'Active' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item is not active.';
        END IF;

        IF v_plan_status <> 'Approved' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan must be approved for this APP item.';
        END IF;

        IF v_plan_department IS NOT NULL AND v_department IS NOT NULL AND v_plan_department <> v_department THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department does not match procurement plan.';
        END IF;

        IF v_budget_code IS NULL OR btrim(v_budget_code) = '' THEN
            v_budget_code := v_item_budget_code;
        ELSIF v_item_budget_code IS NOT NULL AND v_budget_code <> v_item_budget_code THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BudgetCode does not match APP line item.';
        END IF;
    END IF;

    INSERT INTO procurement_workflow.requisitions (
        title,
        department,
        unit_id,
        status,
        priority,
        procurement_type,
        funding_source,
        budget_code,
        app_item_id,
        project_code,
        required_by,
        delivery_location,
        justification,
        risk_notes,
        current_stage
    )
    VALUES (
        p_title,
        v_department,
        v_unit_id,
        COALESCE(p_status, 'Draft'),
        p_priority,
        p_procurement_type,
        p_funding_source,
        v_budget_code,
        p_app_item_id,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        procurement_workflow.resolve_requisition_stage(COALESCE(p_status, 'Draft'))
    )
    RETURNING requisitions.requisition_id INTO v_requisition_id;

    INSERT INTO procurement_workflow.requisition_line_items (
        requisition_id,
        item_code,
        description,
        unit,
        quantity,
        unit_cost
    )
    SELECT
        v_requisition_id,
        NULLIF(item->>'ItemId', ''),
        item->>'Description',
        item->>'Unit',
        (item->>'Quantity')::numeric,
        (item->>'UnitCost')::numeric
    FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;

    UPDATE procurement_workflow.requisitions r
    SET
        total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items li
            WHERE li.requisition_id = v_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE r.requisition_id = v_requisition_id;

    SELECT r.total_estimate, r.status
    INTO v_total_estimate, v_status
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;

    IF v_status IN ('Submitted', 'Under Review', 'Evaluation', 'Board Review', 'Approved')
       AND v_budget_code IS NOT NULL AND btrim(v_budget_code) <> '' THEN
        v_fiscal_year := COALESCE(EXTRACT(YEAR FROM p_required_by)::int, EXTRACT(YEAR FROM NOW())::int);
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            v_requisition_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_total_estimate
        );
    END IF;

    IF v_status = 'Approved' THEN
        PERFORM procurement_workflow.require_bpp_no_objection(v_requisition_id, p_procurement_type, v_total_estimate);
    END IF;

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
        r.created_at,
        r.procurement_type,
        r.budget_code,
        r.app_item_id,
        r.project_code,
        r.delivery_location,
        r.justification,
        r.risk_notes,
        r.updated_at,
        r.current_stage
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;
END;
$$;

-- Procedure wrapper for create_requisition (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.create_requisition_sp(
    IN p_title VARCHAR(255),
    IN p_department VARCHAR(150),
    IN p_unit_id UUID,
    IN p_status VARCHAR(50),
    IN p_priority VARCHAR(50),
    IN p_procurement_type VARCHAR(50),
    IN p_funding_source VARCHAR(120),
    IN p_budget_code VARCHAR(60),
    IN p_app_item_id UUID,
    IN p_project_code VARCHAR(60),
    IN p_required_by TIMESTAMP WITHOUT TIME ZONE,
    IN p_delivery_location TEXT,
    IN p_justification TEXT,
    IN p_risk_notes TEXT,
    IN p_line_items JSONB,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_requisition(
        p_title,
        p_department,
        p_unit_id,
        p_status,
        p_priority,
        p_procurement_type,
        p_funding_source,
        p_budget_code,
        p_app_item_id,
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        p_line_items
    );
END;
$$;
