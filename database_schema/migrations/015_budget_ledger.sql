-- Migration 015: Budget Ledger And Availability Checks (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;

CREATE TABLE IF NOT EXISTS procurement_workflow.budget_appropriations (
    appropriation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INT NOT NULL,
    department VARCHAR(150) NOT NULL,
    budget_code VARCHAR(60) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.budget_releases (
    release_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appropriation_id UUID NOT NULL REFERENCES procurement_workflow.budget_appropriations(appropriation_id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    release_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.budget_commitments (
    commitment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NULL REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE SET NULL,
    tender_id UUID NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE SET NULL,
    fiscal_year INT NOT NULL,
    department VARCHAR(150) NOT NULL,
    budget_code VARCHAR(60) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Reserved',
    committed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.budget_expenditures (
    expenditure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES procurement_workflow.budget_commitments(commitment_id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    spent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_appropriations_amount_chk'
          AND conrelid = 'procurement_workflow.budget_appropriations'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_appropriations
            ADD CONSTRAINT budget_appropriations_amount_chk
            CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_appropriations_status_chk'
          AND conrelid = 'procurement_workflow.budget_appropriations'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_appropriations
            ADD CONSTRAINT budget_appropriations_status_chk
            CHECK (status IN ('Active', 'Closed'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_releases_amount_chk'
          AND conrelid = 'procurement_workflow.budget_releases'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_releases
            ADD CONSTRAINT budget_releases_amount_chk
            CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_commitments_amount_chk'
          AND conrelid = 'procurement_workflow.budget_commitments'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_commitments
            ADD CONSTRAINT budget_commitments_amount_chk
            CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_commitments_status_chk'
          AND conrelid = 'procurement_workflow.budget_commitments'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_commitments
            ADD CONSTRAINT budget_commitments_status_chk
            CHECK (status IN ('Reserved', 'Committed', 'Released', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_commitments_source_chk'
          AND conrelid = 'procurement_workflow.budget_commitments'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_commitments
            ADD CONSTRAINT budget_commitments_source_chk
            CHECK ((requisition_id IS NOT NULL) OR (tender_id IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'budget_expenditures_amount_chk'
          AND conrelid = 'procurement_workflow.budget_expenditures'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.budget_expenditures
            ADD CONSTRAINT budget_expenditures_amount_chk
            CHECK (amount > 0);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS budget_appropriations_lookup_idx
    ON procurement_workflow.budget_appropriations (fiscal_year, department, budget_code, status);

CREATE INDEX IF NOT EXISTS budget_releases_appropriation_idx
    ON procurement_workflow.budget_releases (appropriation_id);

CREATE INDEX IF NOT EXISTS budget_commitments_lookup_idx
    ON procurement_workflow.budget_commitments (fiscal_year, department, budget_code, status);

CREATE UNIQUE INDEX IF NOT EXISTS budget_commitments_requisition_active_ux
    ON procurement_workflow.budget_commitments (requisition_id)
    WHERE requisition_id IS NOT NULL AND status IN ('Reserved', 'Committed');

CREATE OR REPLACE FUNCTION procurement_workflow.get_budget_available(
    p_budget_code VARCHAR(60),
    p_department VARCHAR(150),
    p_fiscal_year INT
)
RETURNS DECIMAL(18, 2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_appropriated DECIMAL(18, 2);
    v_released DECIMAL(18, 2);
    v_committed DECIMAL(18, 2);
    v_spent DECIMAL(18, 2);
    v_base DECIMAL(18, 2);
BEGIN
    SELECT COALESCE(SUM(a.amount), 0)
    INTO v_appropriated
    FROM procurement_workflow.budget_appropriations a
    WHERE a.budget_code = p_budget_code
      AND a.department = p_department
      AND a.fiscal_year = p_fiscal_year
      AND a.status = 'Active';

    SELECT COALESCE(SUM(r.amount), 0)
    INTO v_released
    FROM procurement_workflow.budget_releases r
    JOIN procurement_workflow.budget_appropriations a
      ON a.appropriation_id = r.appropriation_id
    WHERE a.budget_code = p_budget_code
      AND a.department = p_department
      AND a.fiscal_year = p_fiscal_year
      AND a.status = 'Active';

    v_base := CASE WHEN v_released > 0 THEN v_released ELSE v_appropriated END;

    SELECT COALESCE(SUM(c.amount), 0)
    INTO v_committed
    FROM procurement_workflow.budget_commitments c
    WHERE c.budget_code = p_budget_code
      AND c.department = p_department
      AND c.fiscal_year = p_fiscal_year
      AND c.status IN ('Reserved', 'Committed');

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_spent
    FROM procurement_workflow.budget_expenditures e
    JOIN procurement_workflow.budget_commitments c
      ON c.commitment_id = e.commitment_id
    WHERE c.budget_code = p_budget_code
      AND c.department = p_department
      AND c.fiscal_year = p_fiscal_year;

    RETURN v_base - v_committed - v_spent;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.reserve_budget_for_requisition(
    p_requisition_id UUID,
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
    v_appropriation_id UUID;
BEGIN
    IF p_budget_code IS NULL OR btrim(p_budget_code) = '' THEN
        RETURN;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Budget reservation amount must be greater than 0.';
    END IF;

    SELECT commitment_id, amount
    INTO v_existing_id, v_existing_amount
    FROM procurement_workflow.budget_commitments
    WHERE requisition_id = p_requisition_id
      AND status IN ('Reserved', 'Committed')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    v_available := procurement_workflow.get_budget_available(p_budget_code, p_department, p_fiscal_year);

    SELECT a.appropriation_id
    INTO v_appropriation_id
    FROM procurement_workflow.budget_appropriations a
    WHERE a.budget_code = p_budget_code
      AND a.department = p_department
      AND a.fiscal_year = p_fiscal_year
      AND a.status = 'Active'
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_appropriation_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Active appropriation not found for this budget code, department, and fiscal year.';
    END IF;

    IF v_existing_id IS NOT NULL THEN
        v_available := v_available + v_existing_amount;
    END IF;

    IF p_amount > v_available THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Insufficient budget available for this requisition.';
    END IF;

    IF v_existing_id IS NULL THEN
        INSERT INTO procurement_workflow.budget_commitments (
            appropriation_id,
            requisition_id,
            fiscal_year,
            department,
            budget_code,
            amount,
            status,
            committed_at
        )
        VALUES (
            v_appropriation_id,
            p_requisition_id,
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
            appropriation_id = v_appropriation_id,
            fiscal_year = p_fiscal_year,
            department = p_department,
            budget_code = p_budget_code,
            amount = p_amount,
            updated_at = NOW()
        WHERE commitment_id = v_existing_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.release_budget_for_requisition(
    p_requisition_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE procurement_workflow.budget_commitments
    SET
        status = 'Released',
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id
      AND status IN ('Reserved', 'Committed');
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
BEGIN
    INSERT INTO procurement_workflow.requisitions (
        title,
        department,
        status,
        priority,
        procurement_type,
        funding_source,
        budget_code,
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
        p_budget_code,
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

    UPDATE procurement_workflow.requisitions
    SET
        total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items
            WHERE requisition_id = v_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE requisition_id = v_requisition_id;

    SELECT r.total_estimate, r.status
    INTO v_total_estimate, v_status
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = v_requisition_id;

    IF v_status IN ('Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved') THEN
        v_fiscal_year := COALESCE(EXTRACT(YEAR FROM p_required_by)::int, EXTRACT(YEAR FROM NOW())::int);
        PERFORM procurement_workflow.reserve_budget_for_requisition(
            v_requisition_id,
            p_budget_code,
            p_department,
            v_fiscal_year,
            v_total_estimate
        );
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

CREATE OR REPLACE FUNCTION procurement_workflow.update_requisition(
    p_requisition_id UUID,
    p_title VARCHAR(255),
    p_department VARCHAR(150),
    p_status VARCHAR(50),
    p_priority VARCHAR(50),
    p_procurement_type VARCHAR(50),
    p_funding_source VARCHAR(120),
    p_budget_code VARCHAR(60),
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
    v_status VARCHAR(50);
    v_department VARCHAR(150);
    v_budget_code VARCHAR(60);
    v_required_by TIMESTAMP WITHOUT TIME ZONE;
    v_total_estimate DECIMAL(18, 2);
    v_fiscal_year INT;
BEGIN
    UPDATE procurement_workflow.requisitions
    SET
        title = COALESCE(p_title, title),
        department = COALESCE(p_department, department),
        status = COALESCE(p_status, status),
        priority = COALESCE(p_priority, priority),
        procurement_type = COALESCE(p_procurement_type, procurement_type),
        funding_source = COALESCE(p_funding_source, funding_source),
        budget_code = COALESCE(p_budget_code, budget_code),
        project_code = COALESCE(p_project_code, project_code),
        required_by = COALESCE(p_required_by, required_by),
        delivery_location = COALESCE(p_delivery_location, delivery_location),
        justification = COALESCE(p_justification, justification),
        risk_notes = COALESCE(p_risk_notes, risk_notes),
        current_stage = COALESCE(
            CASE WHEN p_status IS NULL THEN NULL ELSE procurement_workflow.resolve_requisition_stage(p_status) END,
            current_stage
        ),
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    IF p_line_items IS NOT NULL THEN
        DELETE FROM procurement_workflow.requisition_line_items
        WHERE requisition_id = p_requisition_id;

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

    UPDATE procurement_workflow.requisitions
    SET total_estimate = COALESCE((
            SELECT SUM(quantity * unit_cost)
            FROM procurement_workflow.requisition_line_items
            WHERE requisition_id = p_requisition_id
        ), 0),
        updated_at = NOW()
    WHERE requisition_id = p_requisition_id;

    SELECT r.status, r.department, r.budget_code, r.required_by, r.total_estimate
    INTO v_status, v_department, v_budget_code, v_required_by, v_total_estimate
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = p_requisition_id;

    v_fiscal_year := COALESCE(EXTRACT(YEAR FROM v_required_by)::int, EXTRACT(YEAR FROM NOW())::int);

    IF v_status IN ('Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved') THEN
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

COMMIT;
