-- Function for Updating a Requisition (PostgreSQL)
DROP PROCEDURE IF EXISTS procurement_workflow.update_requisition_sp(
    UUID,
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
DROP FUNCTION IF EXISTS procurement_workflow.update_requisition(
    UUID,
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
        WHEN p_status IS NULL THEN 'department_need_capture'
        WHEN p_status ILIKE 'Draft' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Submitted' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Endorsed' THEN 'department_head_endorsement'
        WHEN p_status ILIKE 'Initial' THEN 'budget_code_allocation'
        WHEN p_status ILIKE 'Under Review' THEN 'planning_committee_review'
        WHEN p_status ILIKE 'Evaluation' THEN 'evaluation_committee'
        WHEN p_status ILIKE 'Board Review' THEN 'tenders_board'
        WHEN p_status ILIKE 'Approved' THEN 'accounting_officer'
        WHEN p_status ILIKE 'Rejected' THEN 'department_need_capture'
        ELSE 'department_need_capture'
    END;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.update_requisition(
    p_requisition_id UUID,
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
    v_existing_department VARCHAR(150);
    v_existing_budget_code VARCHAR(60);
    v_existing_app_item_id UUID;
    v_existing_proc_type VARCHAR(50);
    v_existing_status VARCHAR(50);
    v_existing_required_by TIMESTAMP WITHOUT TIME ZONE;
    v_existing_unit_id UUID;
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_app_item_id UUID;
    v_procurement_type VARCHAR(50);
    v_status VARCHAR(50);
    v_required_by TIMESTAMP WITHOUT TIME ZONE;
    v_total_estimate DECIMAL(18, 2);
    v_fiscal_year INT;
    v_plan_status VARCHAR(50);
    v_plan_department VARCHAR(150);
    v_item_budget_code VARCHAR(60);
    v_item_status VARCHAR(30);
    v_unit_id UUID;
    v_linked_requisition_id UUID;
BEGIN
    SELECT r.department, r.unit_id, r.budget_code, r.app_item_id, r.procurement_type, r.status, r.required_by
    INTO v_existing_department, v_existing_unit_id, v_existing_budget_code, v_existing_app_item_id, v_existing_proc_type, v_existing_status, v_existing_required_by
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_budget_code := COALESCE(p_budget_code, v_existing_budget_code);
    v_app_item_id := COALESCE(p_app_item_id, v_existing_app_item_id);
    v_procurement_type := COALESCE(p_procurement_type, v_existing_proc_type);
    v_status := COALESCE(p_status, v_existing_status);
    v_required_by := COALESCE(p_required_by, v_existing_required_by);
    v_unit_id := COALESCE(p_unit_id, v_existing_unit_id);

    IF p_app_item_id IS NOT NULL AND v_existing_app_item_id IS NOT NULL AND v_existing_app_item_id <> p_app_item_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Requisition is already linked to an APP item.';
    END IF;

    IF v_unit_id IS NOT NULL THEN
        SELECT ou.unit_id, ou.unit_name
        INTO v_unit_id, v_department
        FROM identity.organizational_units ou
        WHERE ou.unit_id = v_unit_id
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
    ELSE
        v_department := v_existing_department;
    END IF;

    v_department := COALESCE(v_department, v_existing_department, NULLIF(btrim(p_department), ''));

    IF v_department IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department or organizational unit is required.';
    END IF;

    IF v_app_item_id IS NOT NULL THEN
        SELECT p.status, p.department, i.budget_code, i.status
        INTO v_plan_status, v_plan_department, v_item_budget_code, v_item_status
        FROM procurement_workflow.procurement_plan_items i
        JOIN procurement_workflow.procurement_plans p ON p.plan_id = i.plan_id
        WHERE i.plan_item_id = v_app_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item not found.';
        END IF;

        IF v_item_status <> 'Active' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP line item is not active.';
        END IF;

        IF v_plan_status <> 'Under Review' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan must be under review for this APP item.';
        END IF;

        SELECT r.requisition_id
        INTO v_linked_requisition_id
        FROM procurement_workflow.requisitions r
        WHERE r.app_item_id = v_app_item_id
          AND r.requisition_id <> p_requisition_id
        LIMIT 1;

        IF v_linked_requisition_id IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APP item is already linked to another requisition.';
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

    UPDATE procurement_workflow.requisitions r
    SET
        title = COALESCE(p_title, r.title),
        department = v_department,
        unit_id = v_unit_id,
        status = COALESCE(p_status, r.status),
        priority = COALESCE(p_priority, r.priority),
        procurement_type = COALESCE(p_procurement_type, r.procurement_type),
        funding_source = COALESCE(p_funding_source, r.funding_source),
        budget_code = v_budget_code,
        app_item_id = v_app_item_id,
        project_code = COALESCE(p_project_code, r.project_code),
        required_by = COALESCE(p_required_by, r.required_by),
        delivery_location = COALESCE(p_delivery_location, r.delivery_location),
        justification = COALESCE(p_justification, r.justification),
        risk_notes = COALESCE(p_risk_notes, r.risk_notes),
        current_stage = COALESCE(
            CASE WHEN p_status IS NULL THEN NULL ELSE procurement_workflow.resolve_requisition_stage(p_status) END,
            r.current_stage
        ),
        updated_at = NOW()
    WHERE r.requisition_id = p_requisition_id;

    IF p_line_items IS NOT NULL THEN
        DELETE FROM procurement_workflow.requisition_line_items li
        WHERE li.requisition_id = p_requisition_id;

        INSERT INTO procurement_workflow.requisition_line_items (
            requisition_id,
            item_code,
            description,
            unit,
            quantity,
            unit_cost
        )
        SELECT
            p_requisition_id,
            NULLIF(item->>'ItemId', ''),
            item->>'Description',
            item->>'Unit',
            (item->>'Quantity')::numeric,
            (item->>'UnitCost')::numeric
        FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;
    END IF;

    UPDATE procurement_workflow.requisitions r
    SET total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items li
            WHERE li.requisition_id = p_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE r.requisition_id = p_requisition_id;

    SELECT r.total_estimate
    INTO v_total_estimate
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_fiscal_year := COALESCE(EXTRACT(YEAR FROM v_required_by)::int, EXTRACT(YEAR FROM NOW())::int);

    IF v_status IN ('Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved') AND v_budget_code IS NOT NULL AND btrim(v_budget_code) <> '' THEN
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            p_requisition_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_total_estimate
        );
    ELSIF v_status IN ('Draft', 'Submitted', 'Endorsed', 'Rejected', 'Cancelled') THEN
        PERFORM procurement_workflow.release_budget_for_requisition(p_requisition_id);
    END IF;

    IF v_status = 'Approved' THEN
        PERFORM procurement_workflow.require_bpp_no_objection(p_requisition_id, v_procurement_type, v_total_estimate);
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
    WHERE r.requisition_id = p_requisition_id;
END;
$$;

-- Procedure wrapper for update_requisition (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.update_requisition_sp(
    IN p_requisition_id UUID,
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
    SELECT * FROM procurement_workflow.update_requisition(
        p_requisition_id,
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
