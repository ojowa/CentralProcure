-- Migration 017: Update Budget/Tender/Requisition Functions And APP Line Items (PostgreSQL)
BEGIN;

-- Budget ledger extensions
CREATE OR REPLACE FUNCTION procurement_workflow.reserve_budget_for_tender(
    p_tender_id UUID,
    p_budget_code VARCHAR(60),
    p_department VARCHAR(150),
    p_fiscal_year INT,
    p_amount DECIMAL(18, 2)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_id UUID;
    v_existing_amount DECIMAL(18, 2);
    v_available DECIMAL(18, 2);
BEGIN
    IF p_budget_code IS NULL OR btrim(p_budget_code) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BudgetCode is required for tender budget reservation.';
    END IF;

    IF p_department IS NULL OR btrim(p_department) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Department is required for tender budget reservation.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tender budget reservation amount must be greater than 0.';
    END IF;

    SELECT commitment_id, amount
    INTO v_existing_id, v_existing_amount
    FROM procurement_workflow.budget_commitments
    WHERE tender_id = p_tender_id
      AND status IN ('Reserved', 'Committed')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    v_available := procurement_workflow.get_budget_available(p_budget_code, p_department, p_fiscal_year);

    IF v_existing_id IS NOT NULL THEN
        v_available := v_available + v_existing_amount;
    END IF;

    IF p_amount > v_available THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Insufficient budget available for this tender.';
    END IF;

    IF v_existing_id IS NULL THEN
        INSERT INTO procurement_workflow.budget_commitments (
            tender_id,
            fiscal_year,
            department,
            budget_code,
            amount,
            status,
            committed_at
        )
        VALUES (
            p_tender_id,
            p_fiscal_year,
            p_department,
            p_budget_code,
            p_amount,
            'Reserved',
            NOW()
        );
    ELSE
        UPDATE procurement_workflow.budget_commitments
        SET
            fiscal_year = p_fiscal_year,
            department = p_department,
            budget_code = p_budget_code,
            amount = p_amount,
            updated_at = NOW()
        WHERE commitment_id = v_existing_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.release_budget_for_tender(
    p_tender_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE procurement_workflow.budget_commitments
    SET
        status = 'Released',
        updated_at = NOW()
    WHERE tender_id = p_tender_id
      AND status IN ('Reserved', 'Committed');
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_threshold_for_amount(
    p_procurement_type VARCHAR(50),
    p_amount DECIMAL(18, 2)
)
RETURNS TABLE (
    threshold_id UUID,
    approval_route VARCHAR(80),
    requires_board BOOLEAN,
    requires_bpp BOOLEAN,
    min_amount DECIMAL(18, 2),
    max_amount DECIMAL(18, 2),
    notes TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_amount IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        t.threshold_id,
        t.approval_route,
        t.requires_board,
        t.requires_bpp,
        t.min_amount,
        t.max_amount,
        t.notes
    FROM procurement_workflow.approval_thresholds t
    WHERE t.status = 'Active'
      AND (t.procurement_type IS NULL OR (p_procurement_type IS NOT NULL AND t.procurement_type ILIKE p_procurement_type))
      AND p_amount >= t.min_amount
      AND (t.max_amount IS NULL OR p_amount <= t.max_amount)
    ORDER BY
        CASE WHEN t.procurement_type IS NULL THEN 1 ELSE 0 END,
        t.min_amount DESC
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.require_bpp_no_objection(
    p_requisition_id UUID,
    p_procurement_type VARCHAR(50),
    p_amount DECIMAL(18, 2)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_requires_bpp BOOLEAN;
BEGIN
    SELECT requires_bpp
    INTO v_requires_bpp
    FROM procurement_workflow.get_threshold_for_amount(p_procurement_type, p_amount);

    IF COALESCE(v_requires_bpp, FALSE) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM procurement_workflow.bpp_no_objections b
            WHERE b.requisition_id = p_requisition_id
              AND b.status = 'Approved'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BPP No Objection approval is required before approval.';
        END IF;
    END IF;
END;
$$;

-- Procurement plan items
CREATE OR REPLACE FUNCTION procurement_workflow.create_procurement_plan_item(
    p_plan_id UUID,
    p_item_code VARCHAR(60),
    p_description TEXT,
    p_budget_code VARCHAR(60),
    p_procurement_type VARCHAR(50),
    p_estimated_amount DECIMAL(18, 2),
    p_status VARCHAR(30),
    p_notes TEXT
)
RETURNS TABLE (
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR(60),
    description TEXT,
    budget_code VARCHAR(60),
    procurement_type VARCHAR(50),
    estimated_amount DECIMAL(18, 2),
    status VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_item_id UUID;
BEGIN
    INSERT INTO procurement_workflow.procurement_plan_items (
        plan_id,
        item_code,
        description,
        budget_code,
        procurement_type,
        estimated_amount,
        status,
        notes
    )
    VALUES (
        p_plan_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        COALESCE(p_estimated_amount, 0),
        COALESCE(p_status, 'Active'),
        p_notes
    )
    RETURNING procurement_plan_items.plan_item_id INTO v_plan_item_id;

    RETURN QUERY
    SELECT
        i.plan_item_id,
        i.plan_id,
        i.item_code,
        i.description,
        i.budget_code,
        i.procurement_type,
        i.estimated_amount,
        i.status,
        i.notes,
        i.created_at,
        i.updated_at
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_item_id = v_plan_item_id;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.create_procurement_plan_item_sp(
    IN p_plan_id UUID,
    IN p_item_code VARCHAR(60),
    IN p_description TEXT,
    IN p_budget_code VARCHAR(60),
    IN p_procurement_type VARCHAR(50),
    IN p_estimated_amount DECIMAL(18, 2),
    IN p_status VARCHAR(30),
    IN p_notes TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.create_procurement_plan_item(
        p_plan_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        p_estimated_amount,
        p_status,
        p_notes
    );
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.update_procurement_plan_item(
    p_plan_item_id UUID,
    p_item_code VARCHAR(60),
    p_description TEXT,
    p_budget_code VARCHAR(60),
    p_procurement_type VARCHAR(50),
    p_estimated_amount DECIMAL(18, 2),
    p_status VARCHAR(30),
    p_notes TEXT
)
RETURNS TABLE (
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR(60),
    description TEXT,
    budget_code VARCHAR(60),
    procurement_type VARCHAR(50),
    estimated_amount DECIMAL(18, 2),
    status VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE procurement_workflow.procurement_plan_items
    SET
        item_code = COALESCE(p_item_code, item_code),
        description = COALESCE(p_description, description),
        budget_code = COALESCE(p_budget_code, budget_code),
        procurement_type = COALESCE(p_procurement_type, procurement_type),
        estimated_amount = COALESCE(p_estimated_amount, estimated_amount),
        status = COALESCE(p_status, status),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE plan_item_id = p_plan_item_id;

    RETURN QUERY
    SELECT
        i.plan_item_id,
        i.plan_id,
        i.item_code,
        i.description,
        i.budget_code,
        i.procurement_type,
        i.estimated_amount,
        i.status,
        i.notes,
        i.created_at,
        i.updated_at
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_item_id = p_plan_item_id;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.update_procurement_plan_item_sp(
    IN p_plan_item_id UUID,
    IN p_item_code VARCHAR(60),
    IN p_description TEXT,
    IN p_budget_code VARCHAR(60),
    IN p_procurement_type VARCHAR(50),
    IN p_estimated_amount DECIMAL(18, 2),
    IN p_status VARCHAR(30),
    IN p_notes TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.update_procurement_plan_item(
        p_plan_item_id,
        p_item_code,
        p_description,
        p_budget_code,
        p_procurement_type,
        p_estimated_amount,
        p_status,
        p_notes
    );
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.delete_procurement_plan_item(
    p_plan_item_id UUID
)
RETURNS TABLE (
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR(60),
    description TEXT,
    budget_code VARCHAR(60),
    procurement_type VARCHAR(50),
    estimated_amount DECIMAL(18, 2),
    status VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    DELETE FROM procurement_workflow.procurement_plan_items
    WHERE plan_item_id = p_plan_item_id
    RETURNING
        plan_item_id,
        plan_id,
        item_code,
        description,
        budget_code,
        procurement_type,
        estimated_amount,
        status,
        notes,
        created_at,
        updated_at;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.delete_procurement_plan_item_sp(
    IN p_plan_item_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.delete_procurement_plan_item(p_plan_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_procurement_plan_items(
    p_plan_id UUID
)
RETURNS TABLE (
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR(60),
    description TEXT,
    budget_code VARCHAR(60),
    procurement_type VARCHAR(50),
    estimated_amount DECIMAL(18, 2),
    status VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.plan_item_id,
        i.plan_id,
        i.item_code,
        i.description,
        i.budget_code,
        i.procurement_type,
        i.estimated_amount,
        i.status,
        i.notes,
        i.created_at,
        i.updated_at
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p_plan_id
    ORDER BY i.created_at;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_procurement_plan_items_sp(
    IN p_plan_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_procurement_plan_items(p_plan_id);
END;
$$;

-- Requisition functions updated for APP items and BPP checks
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
BEGIN
    v_budget_code := p_budget_code;

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

        IF v_plan_department IS NOT NULL AND p_department IS NOT NULL AND v_plan_department <> p_department THEN
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
        p_department,
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
            p_department,
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

CREATE OR REPLACE PROCEDURE procurement_workflow.create_requisition_sp(
    IN p_title VARCHAR(255),
    IN p_department VARCHAR(150),
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

CREATE OR REPLACE FUNCTION procurement_workflow.update_requisition(
    p_requisition_id UUID,
    p_title VARCHAR(255),
    p_department VARCHAR(150),
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
BEGIN
    SELECT r.department, r.budget_code, r.app_item_id, r.procurement_type, r.status, r.required_by
    INTO v_existing_department, v_existing_budget_code, v_existing_app_item_id, v_existing_proc_type, v_existing_status, v_existing_required_by
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_department := COALESCE(p_department, v_existing_department);
    v_budget_code := COALESCE(p_budget_code, v_existing_budget_code);
    v_app_item_id := COALESCE(p_app_item_id, v_existing_app_item_id);
    v_procurement_type := COALESCE(p_procurement_type, v_existing_proc_type);
    v_status := COALESCE(p_status, v_existing_status);
    v_required_by := COALESCE(p_required_by, v_existing_required_by);

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

    UPDATE procurement_workflow.requisitions r
    SET
        title = COALESCE(p_title, r.title),
        department = v_department,
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

    IF v_status IN ('Submitted', 'Under Review', 'Evaluation', 'Board Review', 'Approved')
       AND v_budget_code IS NOT NULL AND btrim(v_budget_code) <> '' THEN
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            p_requisition_id,
            v_budget_code,
            v_department,
            v_fiscal_year,
            v_total_estimate
        );
    ELSIF v_status IN ('Draft', 'Rejected', 'Cancelled') THEN
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

CREATE OR REPLACE PROCEDURE procurement_workflow.update_requisition_sp(
    IN p_requisition_id UUID,
    IN p_title VARCHAR(255),
    IN p_department VARCHAR(150),
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

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisition_detail(
    p_requisition_id UUID
)
RETURNS TABLE (
    requisition_id UUID,
    title VARCHAR(255),
    department VARCHAR(150),
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
BEGIN
    RETURN QUERY
    SELECT
        r.requisition_id,
        r.title,
        r.department,
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

CREATE OR REPLACE PROCEDURE procurement_workflow.get_requisition_detail_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisition_detail(p_requisition_id);
END;
$$;

-- Tender functions updated for budget reservation
CREATE OR REPLACE FUNCTION vendor_sourcing.create_tender(
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
    v_tender_id UUID;
    v_status VARCHAR(50);
    v_fiscal_year INT;
BEGIN
    v_status := COALESCE(p_status, 'Draft');
    v_fiscal_year := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::int);

    INSERT INTO vendor_sourcing.tenders (
        title,
        description,
        category,
        status,
        budget,
        department,
        budget_code,
        fiscal_year,
        specifications,
        eligibility_criteria,
        evaluation_criteria,
        publish_date,
        opening_date,
        closing_date
    )
    VALUES (
        p_title,
        p_description,
        p_category,
        v_status,
        p_budget,
        p_department,
        p_budget_code,
        v_fiscal_year,
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    )
    RETURNING tenders.tender_id INTO v_tender_id;

    IF v_status IN ('Published', 'Closed', 'Awarded') THEN
        PERFORM procurement_workflow.reserve_budget_for_tender(
            v_tender_id,
            p_budget_code,
            p_department,
            v_fiscal_year,
            p_budget
        );
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
    WHERE t.tender_id = v_tender_id;
END;
$$;

CREATE OR REPLACE PROCEDURE vendor_sourcing.create_tender_sp(
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
    SELECT * FROM vendor_sourcing.create_tender(
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
    UPDATE vendor_sourcing.tenders
    SET
        status = 'Published',
        publish_date = COALESCE(p_publish_date, NOW()),
        opening_date = COALESCE(p_opening_date, opening_date),
        closing_date = COALESCE(p_closing_date, closing_date),
        fiscal_year = COALESCE(fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::int),
        updated_at = NOW()
    WHERE tender_id = p_tender_id
    RETURNING budget, department, budget_code, fiscal_year
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

-- Tender read functions updated for budget metadata
CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders(
    p_status VARCHAR(50) DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'created_at',
    p_sort_dir VARCHAR(4) DEFAULT 'desc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    tender_id UUID,
    title VARCHAR(500),
    category VARCHAR(100),
    status VARCHAR(50),
    budget DECIMAL(18, 2),
    department VARCHAR(150),
    budget_code VARCHAR(60),
    fiscal_year INT,
    publish_date TIMESTAMP WITHOUT TIME ZONE,
    opening_date TIMESTAMP WITHOUT TIME ZONE,
    closing_date TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.category,
        t.status,
        t.budget,
        t.department,
        t.budget_code,
        t.fiscal_year,
        t.publish_date,
        t.opening_date,
        t.closing_date,
        t.created_at
    FROM
        vendor_sourcing.tenders t
    WHERE
        (p_status IS NULL OR t.status ILIKE p_status)
        AND (p_category IS NULL OR t.category ILIKE '%' || p_category || '%')
        AND (
            p_query IS NULL
            OR t.title ILIKE '%' || p_query || '%'
            OR t.description ILIKE '%' || p_query || '%'
        )
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'asc' THEN t.title END ASC,
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'desc' THEN t.title END DESC,
        CASE WHEN lower(p_sort_by) = 'category' AND lower(p_sort_dir) = 'asc' THEN t.category END ASC,
        CASE WHEN lower(p_sort_by) = 'category' AND lower(p_sort_dir) = 'desc' THEN t.category END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN t.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN t.status END DESC,
        CASE WHEN lower(p_sort_by) = 'budget' AND lower(p_sort_dir) = 'asc' THEN t.budget END ASC,
        CASE WHEN lower(p_sort_by) = 'budget' AND lower(p_sort_dir) = 'desc' THEN t.budget END DESC,
        CASE WHEN lower(p_sort_by) = 'publish_date' AND lower(p_sort_dir) = 'asc' THEN t.publish_date END ASC,
        CASE WHEN lower(p_sort_by) = 'publish_date' AND lower(p_sort_dir) = 'desc' THEN t.publish_date END DESC,
        CASE WHEN lower(p_sort_by) = 'closing_date' AND lower(p_sort_dir) = 'asc' THEN t.closing_date END ASC,
        CASE WHEN lower(p_sort_by) = 'closing_date' AND lower(p_sort_dir) = 'desc' THEN t.closing_date END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN t.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN t.created_at END DESC,
        t.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION vendor_sourcing.get_tender_details(
    p_tender_id UUID
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
    closing_date TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
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
        t.closing_date
    FROM
        vendor_sourcing.tenders t
    WHERE
        t.tender_id = p_tender_id;
END;
$$;

CREATE OR REPLACE PROCEDURE vendor_sourcing.get_tenders_sp(
    IN p_status VARCHAR(50),
    IN p_category VARCHAR(100),
    IN p_query TEXT,
    IN p_sort_by VARCHAR(50),
    IN p_sort_dir VARCHAR(4),
    IN p_limit INT,
    IN p_offset INT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_tenders(
        p_status,
        p_category,
        p_query,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
    );
END;
$$;

CREATE OR REPLACE PROCEDURE vendor_sourcing.get_tender_details_sp(
    IN p_tender_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM vendor_sourcing.get_tender_details(p_tender_id);
END;
$$;

COMMIT;
