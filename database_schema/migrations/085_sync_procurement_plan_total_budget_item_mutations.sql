BEGIN;

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
    v_plan_title VARCHAR(255);
    v_department VARCHAR(255);
    v_fiscal_year INT;
    v_plan_cycle_id UUID;
    v_cycle_code VARCHAR(100);
    v_app_code VARCHAR(100);
    v_procurement_category VARCHAR(100);
    v_funding_source VARCHAR(255);
    v_procurement_method VARCHAR(255);
    v_duplicate_id UUID;
BEGIN
    SELECT p.plan_title, p.department, p.fiscal_year
    INTO v_plan_title, v_department, v_fiscal_year
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_id = p_plan_id;
    IF v_plan_title IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Procurement plan not found.'; END IF;
    SELECT c.plan_cycle_id INTO v_plan_cycle_id FROM procurement_workflow.procurement_plan_cycles c
    WHERE c.title = v_plan_title AND c.department = v_department AND c.fiscal_year = v_fiscal_year ORDER BY c.created_at DESC LIMIT 1;
    IF v_plan_cycle_id IS NULL THEN
        v_cycle_code := left(replace(gen_random_uuid()::text, '-', ''), 16);
        INSERT INTO procurement_workflow.procurement_plan_cycles (fiscal_year, cycle_code, title, department, status, created_by)
        VALUES (v_fiscal_year, v_cycle_code, v_plan_title, v_department, 'Draft', CURRENT_USER)
        RETURNING plan_cycle_id INTO v_plan_cycle_id;
    END IF;
    v_app_code := COALESCE(p_item_code, 'APP-' || left(replace(gen_random_uuid()::text, '-', ''), 16));
    v_procurement_category := COALESCE(p_procurement_type, 'Goods');
    v_funding_source := 'Budget';
    v_procurement_method := 'Open Competitive Bidding';
    SELECT i.plan_item_id INTO v_duplicate_id FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p_plan_id AND lower(trim(i.description)) = lower(trim(p_description))
      AND lower(trim(i.budget_code)) = lower(trim(p_budget_code))
      AND lower(trim(COALESCE(i.procurement_type, ''))) = lower(trim(COALESCE(p_procurement_type, ''))) LIMIT 1;
    IF v_duplicate_id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Duplicate APP item: same description, budget code, and procurement type already exists for this plan.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM procurement_workflow.budget_lines bl WHERE bl.budget_code = p_budget_code) THEN
        INSERT INTO procurement_workflow.budget_lines (budget_code, department, funding_source, allocated_amount, is_active)
        VALUES (p_budget_code, v_department, v_funding_source, 0, TRUE);
    END IF;
    INSERT INTO procurement_workflow.procurement_plan_items (
        plan_id, plan_cycle_id, fiscal_year, app_code, title, department, procurement_category, item_code, description,
        budget_code, procurement_type, estimated_amount, funding_source, estimated_cost, procurement_method, status, notes, created_by
    ) VALUES (
        p_plan_id, v_plan_cycle_id, v_fiscal_year, v_app_code, p_description, v_department, v_procurement_category, p_item_code, p_description,
        p_budget_code, p_procurement_type, COALESCE(p_estimated_amount, 0), v_funding_source, COALESCE(p_estimated_amount, 0),
        v_procurement_method, COALESCE(p_status, 'Active'), p_notes, CURRENT_USER
    ) RETURNING procurement_plan_items.plan_item_id INTO v_plan_item_id;
    PERFORM procurement_workflow.sync_procurement_plan_total_budget(p_plan_id);
    RETURN QUERY SELECT i.plan_item_id, i.plan_id, i.item_code, i.description, i.budget_code, i.procurement_type, i.estimated_amount, i.status, i.notes, i.created_at, i.updated_at
    FROM procurement_workflow.procurement_plan_items i WHERE i.plan_item_id = v_plan_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.update_procurement_plan_item(
    p_plan_item_id UUID, p_item_code VARCHAR(60), p_description TEXT, p_budget_code VARCHAR(60), p_procurement_type VARCHAR(50),
    p_estimated_amount DECIMAL(18, 2), p_status VARCHAR(30), p_notes TEXT
)
RETURNS TABLE (
    plan_item_id UUID, plan_id UUID, item_code VARCHAR(60), description TEXT, budget_code VARCHAR(60),
    procurement_type VARCHAR(50), estimated_amount DECIMAL(18, 2), status VARCHAR(30), notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE, updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE v_plan_id UUID;
BEGIN
    SELECT i.plan_id INTO v_plan_id FROM procurement_workflow.procurement_plan_items i WHERE i.plan_item_id = p_plan_item_id;
    UPDATE procurement_workflow.procurement_plan_items
    SET item_code = COALESCE(p_item_code, item_code), description = COALESCE(p_description, description),
        budget_code = COALESCE(p_budget_code, budget_code), procurement_type = COALESCE(p_procurement_type, procurement_type),
        estimated_amount = COALESCE(p_estimated_amount, estimated_amount), status = COALESCE(p_status, status),
        notes = COALESCE(p_notes, notes), updated_at = NOW()
    WHERE plan_item_id = p_plan_item_id;
    IF v_plan_id IS NOT NULL THEN PERFORM procurement_workflow.sync_procurement_plan_total_budget(v_plan_id); END IF;
    RETURN QUERY SELECT i.plan_item_id, i.plan_id, i.item_code, i.description, i.budget_code, i.procurement_type, i.estimated_amount, i.status, i.notes, i.created_at, i.updated_at
    FROM procurement_workflow.procurement_plan_items i WHERE i.plan_item_id = p_plan_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.delete_procurement_plan_item(p_plan_item_id UUID)
RETURNS TABLE (
    plan_item_id UUID, plan_id UUID, item_code VARCHAR(60), description TEXT, budget_code VARCHAR(60),
    procurement_type VARCHAR(50), estimated_amount DECIMAL(18, 2), status VARCHAR(30), notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE, updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE v_deleted RECORD;
BEGIN
    DELETE FROM procurement_workflow.procurement_plan_items
    WHERE plan_item_id = p_plan_item_id
    RETURNING plan_item_id, plan_id, item_code, description, budget_code, procurement_type, estimated_amount, status, notes, created_at, updated_at
    INTO v_deleted;
    IF v_deleted IS NULL THEN RETURN; END IF;
    IF v_deleted.plan_id IS NOT NULL THEN PERFORM procurement_workflow.sync_procurement_plan_total_budget(v_deleted.plan_id); END IF;
    RETURN QUERY SELECT v_deleted.plan_item_id, v_deleted.plan_id, v_deleted.item_code, v_deleted.description, v_deleted.budget_code, v_deleted.procurement_type, v_deleted.estimated_amount, v_deleted.status, v_deleted.notes, v_deleted.created_at, v_deleted.updated_at;
END;
$$;

COMMIT;
