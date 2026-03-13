-- Budget Ledger Functions (PostgreSQL)
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
BEGIN
    IF p_budget_code IS NULL OR btrim(p_budget_code) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BudgetCode is required for budget reservation.';
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

    IF v_existing_id IS NOT NULL THEN
        v_available := v_available + v_existing_amount;
    END IF;

    IF p_amount > v_available THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Insufficient budget available for this requisition.';
    END IF;

    IF v_existing_id IS NULL THEN
        INSERT INTO procurement_workflow.budget_commitments (
            requisition_id,
            fiscal_year,
            department,
            budget_code,
            amount,
            status,
            committed_at
        )
        VALUES (
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
