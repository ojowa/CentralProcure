-- Migration 019: Reconcile legacy procurement plan items and tender routines (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;
CREATE SCHEMA IF NOT EXISTS vendor_sourcing;

ALTER TABLE vendor_sourcing.tenders
    ADD COLUMN IF NOT EXISTS department VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS budget_code VARCHAR(60) NULL,
    ADD COLUMN IF NOT EXISTS fiscal_year INT NULL;

ALTER TABLE procurement_workflow.procurement_plan_items
    ADD COLUMN IF NOT EXISTS plan_id UUID NULL,
    ADD COLUMN IF NOT EXISTS item_code VARCHAR(60) NULL,
    ADD COLUMN IF NOT EXISTS description TEXT NULL,
    ADD COLUMN IF NOT EXISTS procurement_type VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS estimated_amount DECIMAL(18, 2) NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT NULL,
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

DO $$
DECLARE
    v_cycle RECORD;
    v_plan_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'procurement_workflow'
          AND table_name = 'procurement_plan_items'
          AND column_name = 'plan_cycle_id'
    ) THEN
        FOR v_cycle IN
            SELECT
                c.plan_cycle_id,
                c.fiscal_year,
                c.title,
                c.department,
                c.status,
                c.created_by,
                c.created_at,
                c.submitted_at,
                c.approved_by,
                c.approved_at,
                COALESCE(SUM(i.estimated_cost), 0) AS total_budget
            FROM procurement_workflow.procurement_plan_cycles c
            LEFT JOIN procurement_workflow.procurement_plan_items i
                ON i.plan_cycle_id = c.plan_cycle_id
            GROUP BY
                c.plan_cycle_id,
                c.fiscal_year,
                c.title,
                c.department,
                c.status,
                c.created_by,
                c.created_at,
                c.submitted_at,
                c.approved_by,
                c.approved_at
        LOOP
            SELECT p.plan_id
            INTO v_plan_id
            FROM procurement_workflow.procurement_plans p
            WHERE p.plan_title = v_cycle.title
              AND p.department = v_cycle.department
              AND p.fiscal_year = v_cycle.fiscal_year
            ORDER BY p.created_at DESC
            LIMIT 1;

            IF v_plan_id IS NULL THEN
                v_plan_id := gen_random_uuid();

                INSERT INTO procurement_workflow.procurement_plans (
                    plan_id,
                    plan_title,
                    department,
                    fiscal_year,
                    status,
                    total_budget,
                    notes,
                    submitted_at,
                    approved_at,
                    created_by,
                    created_at,
                    updated_by,
                    updated_at
                )
                VALUES (
                    v_plan_id,
                    v_cycle.title,
                    v_cycle.department,
                    v_cycle.fiscal_year,
                    CASE
                        WHEN v_cycle.status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled') THEN v_cycle.status
                        ELSE 'Draft'
                    END,
                    v_cycle.total_budget,
                    'Migrated from legacy procurement_plan_cycles.',
                    v_cycle.submitted_at,
                    v_cycle.approved_at,
                    COALESCE(v_cycle.created_by, CURRENT_USER),
                    COALESCE(v_cycle.created_at, NOW()),
                    COALESCE(v_cycle.approved_by, v_cycle.created_by, CURRENT_USER),
                    COALESCE(v_cycle.approved_at, v_cycle.submitted_at, v_cycle.created_at, NOW())
                );
            END IF;

            UPDATE procurement_workflow.procurement_plan_items i
            SET
                plan_id = COALESCE(i.plan_id, v_plan_id),
                item_code = COALESCE(i.item_code, i.app_code),
                description = COALESCE(i.description, i.title),
                procurement_type = COALESCE(i.procurement_type, i.procurement_category),
                estimated_amount = COALESCE(i.estimated_amount, i.estimated_cost, 0),
                status = CASE
                    WHEN i.status IN ('Active', 'Inactive', 'Cancelled') THEN i.status
                    WHEN i.status IN ('Approved', 'Submitted') THEN 'Active'
                    WHEN i.status = 'Rejected' THEN 'Cancelled'
                    ELSE COALESCE(i.status, 'Active')
                END,
                notes = COALESCE(
                    i.notes,
                    concat_ws(
                        E'\n',
                        'Migrated from legacy procurement_plan_items.',
                        CASE WHEN i.funding_source IS NULL THEN NULL ELSE 'FundingSource: ' || i.funding_source END,
                        CASE WHEN i.procurement_method IS NULL THEN NULL ELSE 'ProcurementMethod: ' || i.procurement_method END,
                        CASE WHEN i.bpp_no_objection_required IS TRUE THEN 'BppNoObjectionRequired: true' ELSE NULL END,
                        CASE WHEN i.department IS NULL THEN NULL ELSE 'LegacyDepartment: ' || i.department END
                    )
                ),
                updated_by = COALESCE(i.updated_by, i.budget_verified_by, i.created_by, CURRENT_USER),
                updated_at = COALESCE(i.updated_at, i.budget_verified_at, i.created_at, NOW())
            WHERE i.plan_cycle_id = v_cycle.plan_cycle_id;
        END LOOP;
    END IF;
END
$$;

DO $$
DECLARE
    v_fallback_plan_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM procurement_workflow.procurement_plan_items
        WHERE plan_id IS NULL
    ) THEN
        SELECT p.plan_id
        INTO v_fallback_plan_id
        FROM procurement_workflow.procurement_plans p
        ORDER BY p.created_at
        LIMIT 1;

        IF v_fallback_plan_id IS NULL THEN
            v_fallback_plan_id := gen_random_uuid();

            INSERT INTO procurement_workflow.procurement_plans (
                plan_id,
                plan_title,
                department,
                fiscal_year,
                status,
                total_budget,
                notes,
                created_by,
                created_at,
                updated_by,
                updated_at
            )
            VALUES (
                v_fallback_plan_id,
                'Migrated Procurement Plan',
                'Legacy Migration',
                EXTRACT(YEAR FROM NOW())::INT,
                'Draft',
                0,
                'Created automatically during procurement plan item reconciliation.',
                CURRENT_USER,
                NOW(),
                CURRENT_USER,
                NOW()
            );
        END IF;

        UPDATE procurement_workflow.procurement_plan_items
        SET plan_id = v_fallback_plan_id
        WHERE plan_id IS NULL;
    END IF;
END
$$;

UPDATE procurement_workflow.procurement_plan_items
SET
    description = COALESCE(description, 'Migrated procurement plan item'),
    estimated_amount = COALESCE(estimated_amount, 0),
    status = CASE
        WHEN status IN ('Active', 'Inactive', 'Cancelled') THEN status
        WHEN status IN ('Approved', 'Submitted') THEN 'Active'
        WHEN status = 'Rejected' THEN 'Cancelled'
        ELSE 'Active'
    END,
    updated_by = COALESCE(updated_by, created_by, CURRENT_USER),
    updated_at = COALESCE(updated_at, created_at, NOW());

ALTER TABLE procurement_workflow.procurement_plan_items
    ALTER COLUMN plan_id SET NOT NULL,
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN estimated_amount SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE procurement_workflow.procurement_plan_items
    ALTER COLUMN estimated_amount SET DEFAULT 0,
    ALTER COLUMN status SET DEFAULT 'Active',
    ALTER COLUMN updated_by SET DEFAULT CURRENT_USER,
    ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plan_items_plan_fk'
          AND conrelid = 'procurement_workflow.procurement_plan_items'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plan_items
            ADD CONSTRAINT procurement_plan_items_plan_fk
            FOREIGN KEY (plan_id)
            REFERENCES procurement_workflow.procurement_plans(plan_id)
            ON DELETE CASCADE;
    END IF;
END
$$;

ALTER TABLE procurement_workflow.procurement_plan_items
    DROP CONSTRAINT IF EXISTS procurement_plan_items_amount_chk,
    DROP CONSTRAINT IF EXISTS procurement_plan_items_status_chk;

ALTER TABLE procurement_workflow.procurement_plan_items
    ADD CONSTRAINT procurement_plan_items_amount_chk
        CHECK (estimated_amount >= 0),
    ADD CONSTRAINT procurement_plan_items_status_chk
        CHECK (status IN ('Active', 'Inactive', 'Cancelled'));

CREATE INDEX IF NOT EXISTS procurement_plan_items_plan_idx
    ON procurement_workflow.procurement_plan_items (plan_id);

CREATE INDEX IF NOT EXISTS procurement_plan_items_budget_idx
    ON procurement_workflow.procurement_plan_items (budget_code);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_plan_items_code_ux
    ON procurement_workflow.procurement_plan_items (plan_id, item_code)
    WHERE item_code IS NOT NULL;

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

DO $$
DECLARE
    v_routine RECORD;
BEGIN
    FOR v_routine IN
        SELECT p.oid::regprocedure AS signature, p.prokind
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'vendor_sourcing'
          AND p.proname IN (
              'get_tenders',
              'get_tenders_sp',
              'get_tender_details',
              'get_tender_details_sp',
              'create_tender',
              'create_tender_sp',
              'update_tender',
              'update_tender_sp',
              'publish_tender',
              'publish_tender_sp'
          )
    LOOP
        EXECUTE format(
            'DROP %s IF EXISTS %s',
            CASE WHEN v_routine.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
            v_routine.signature
        );
    END LOOP;
END
$$;

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
    FROM vendor_sourcing.tenders t
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
    closing_date TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
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
        t.closing_date,
        t.created_at,
        t.updated_at
    FROM vendor_sourcing.tenders t
    WHERE t.tender_id = p_tender_id;
END;
$$;

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
    v_fiscal_year := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::INT);

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
    v_fiscal_year := COALESCE(p_fiscal_year, v_existing_fiscal_year, EXTRACT(YEAR FROM NOW())::INT);

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
        fiscal_year = COALESCE(fiscal_year, EXTRACT(YEAR FROM COALESCE(p_publish_date, NOW()))::INT),
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

COMMIT;
