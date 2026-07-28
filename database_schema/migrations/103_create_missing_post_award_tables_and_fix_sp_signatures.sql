-- Migration 103: Create missing post_award tables and fix function signatures
-- to match what the API expects.

-- ============================================================
-- 1. Create missing budget tables in post_award schema
-- ============================================================

CREATE TABLE IF NOT EXISTS post_award.appropriations (
    appropriation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appropriation_code VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount > 0),
    fiscal_year INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Pending')),
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_award.releases (
    release_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appropriation_id UUID NOT NULL REFERENCES post_award.appropriations(appropriation_id) ON DELETE CASCADE,
    release_code VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Cancelled')),
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_award.commitments (
    commitment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id UUID NOT NULL REFERENCES post_award.releases(release_id) ON DELETE CASCADE,
    commitment_code VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    beneficiary VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Cancelled')),
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_award.budget_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    requested_amount NUMERIC(18,2) NOT NULL CHECK (requested_amount > 0),
    department VARCHAR(150) NOT NULL,
    requested_by VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. Create wrapper functions for _sp calls
--    The API does SELECT * FROM func($1,$2,$3,$4) but the _sp
--    versions are procedures with refcursors. We create
--    table-returning wrapper functions instead.
-- ============================================================

-- Inspection wrappers (API calls with 4 params: status, query, page, pageSize)
CREATE OR REPLACE FUNCTION post_award.get_inspections_sp(
    p_status VARCHAR DEFAULT '',
    p_query TEXT DEFAULT '',
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    inspection_id UUID,
    inspection_code VARCHAR,
    contract_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    status VARCHAR,
    scheduled_date TIMESTAMP,
    completed_date TIMESTAMP,
    inspector_name VARCHAR,
    outcome VARCHAR,
    location VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_inspections(
        NULLIF(p_status, '')::VARCHAR,
        NULLIF(p_query, '')::TEXT
    )
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
$$;

-- Inspection detail wrapper (API calls with 1 param: inspectionId)
CREATE OR REPLACE FUNCTION post_award.get_inspection_detail_sp(
    p_inspection_id VARCHAR
)
RETURNS TABLE(
    inspection_id UUID,
    inspection_code VARCHAR,
    contract_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    status VARCHAR,
    scheduled_date TIMESTAMP,
    completed_date TIMESTAMP,
    inspector_name VARCHAR,
    outcome VARCHAR,
    location VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_inspection_detail(p_inspection_id);
$$;

-- Contract wrappers
CREATE OR REPLACE FUNCTION post_award.get_contracts_sp(
    p_status VARCHAR DEFAULT '',
    p_query TEXT DEFAULT '',
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    contract_id UUID,
    contract_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    contract_value NUMERIC,
    status VARCHAR,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    progress INTEGER,
    contract_manager VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_contracts(
        NULLIF(p_status, '')::VARCHAR,
        NULLIF(p_query, '')::TEXT
    )
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
$$;

CREATE OR REPLACE FUNCTION post_award.get_contract_detail_sp(
    p_contract_code VARCHAR
)
RETURNS TABLE(
    contract_id UUID,
    contract_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    contract_value NUMERIC,
    status VARCHAR,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    progress INTEGER,
    contract_manager VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_contract_detail(p_contract_code);
$$;

CREATE OR REPLACE FUNCTION post_award.get_contract_milestones_sp(
    p_contract_code VARCHAR
)
RETURNS TABLE(
    milestone_id UUID,
    contract_code VARCHAR,
    milestone_title VARCHAR,
    status_after VARCHAR,
    progress_after INTEGER,
    notes TEXT,
    contract_manager VARCHAR,
    recorded_by VARCHAR,
    recorded_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_contract_milestones(p_contract_code);
$$;

-- Contract award wrappers
CREATE OR REPLACE FUNCTION post_award.get_contract_awards_sp(
    p_status VARCHAR DEFAULT '',
    p_query TEXT DEFAULT '',
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    award_id UUID,
    award_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    award_value NUMERIC,
    status VARCHAR,
    award_date TIMESTAMP,
    contract_start TIMESTAMP,
    contract_end TIMESTAMP,
    funding_source VARCHAR,
    notes TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_contract_awards(
        NULLIF(p_status, '')::VARCHAR,
        NULLIF(p_query, '')::TEXT
    )
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
$$;

CREATE OR REPLACE FUNCTION post_award.get_contract_award_sp(
    p_award_code VARCHAR
)
RETURNS TABLE(
    award_id UUID,
    award_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    award_value NUMERIC,
    status VARCHAR,
    award_date TIMESTAMP,
    contract_start TIMESTAMP,
    contract_end TIMESTAMP,
    funding_source VARCHAR,
    notes TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM post_award.get_contract_award(p_award_code);
$$;

CREATE OR REPLACE FUNCTION post_award.publish_contract_award_sp(
    p_award_code VARCHAR,
    p_published_by VARCHAR
)
RETURNS TABLE(
    award_id UUID,
    award_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    award_value NUMERIC,
    status VARCHAR,
    award_date TIMESTAMP,
    contract_start TIMESTAMP,
    contract_end TIMESTAMP,
    funding_source VARCHAR,
    notes TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql VOLATILE
AS $$
    UPDATE post_award.contract_awards
    SET status = 'Published',
        published_at = NOW(),
        updated_by = p_published_by,
        updated_at = NOW()
    WHERE award_code = p_award_code
      AND status IN ('Draft', 'Approved')
    RETURNING award_id, award_code, tender_title, vendor_name, award_value, status,
              award_date, contract_start, contract_end, funding_source, notes,
              published_at, created_at, updated_at;
$$;

CREATE OR REPLACE FUNCTION post_award.log_contract_milestone_sp(
    p_contract_code VARCHAR,
    p_milestone_title VARCHAR,
    p_status VARCHAR,
    p_progress INTEGER,
    p_notes TEXT,
    p_contract_manager VARCHAR,
    p_recorded_by VARCHAR
)
RETURNS TABLE(
    contract_id UUID,
    contract_code VARCHAR,
    tender_title VARCHAR,
    vendor_name VARCHAR,
    contract_value NUMERIC,
    status VARCHAR,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    progress INTEGER,
    contract_manager VARCHAR,
    notes TEXT
)
LANGUAGE sql VOLATILE
AS $$
    WITH milestone AS (
        INSERT INTO post_award.contract_milestones
            (contract_code, milestone_title, status_after, progress_after, notes, contract_manager, recorded_by, recorded_at)
        VALUES (p_contract_code, p_milestone_title, p_status, p_progress, p_notes, p_contract_manager, p_recorded_by, NOW())
        RETURNING contract_code
    ),
    contract_update AS (
        UPDATE post_award.contracts c
        SET status = p_status,
            progress = p_progress,
            contract_manager = p_contract_manager,
            updated_at = NOW()
        FROM milestone m
        WHERE c.contract_code = m.contract_code
        RETURNING c.contract_id, c.contract_code, c.tender_title, c.vendor_name,
                  c.contract_value, c.status, c.start_date, c.end_date,
                  c.progress, c.contract_manager, c.notes
    )
    SELECT * FROM contract_update;
$$;

-- ============================================================
-- 3. Record payment SP wrapper
-- ============================================================
CREATE OR REPLACE FUNCTION post_award.record_payment_sp(
    p_contract_code VARCHAR,
    p_amount NUMERIC,
    p_notes TEXT,
    p_recorded_by VARCHAR,
    OUT p_payment_id UUID,
    OUT p_payment_reference VARCHAR
)
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM post_award.contracts WHERE contract_code = p_contract_code) THEN
        RAISE EXCEPTION 'Contract not found: %', p_contract_code;
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(payment_reference FROM 5) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM post_award.payments
    WHERE contract_code = p_contract_code;

    p_payment_id := gen_random_uuid();
    p_payment_reference := 'PAY-' || LPAD(v_seq::TEXT, 4, '0');

    INSERT INTO post_award.payments
        (contract_code, amount, notes, status, payment_reference, recorded_by, payment_date)
    VALUES (p_contract_code, p_amount, p_notes, 'Paid', p_payment_reference, p_recorded_by, NOW());
END;
$$;

-- ============================================================
-- 4. Tender wrapper functions
--    API calls get_tenders($1,$2,$3,$4) = status, query, page, pageSize
--    DB function get_tenders has 7 params with defaults
-- ============================================================

CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders_count(
    p_status VARCHAR DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql STABLE
AS $$
    SELECT vendor_sourcing.get_tenders_count(
        NULLIF(p_status, ''),
        NULL,          -- category
        NULLIF(p_query, '')
    );
$$;

-- Override get_tenders to accept 4 params: status, query, page, pageSize
CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders(
    p_status VARCHAR DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    tender_id UUID,
    requisition_id UUID,
    title VARCHAR,
    category VARCHAR,
    status VARCHAR,
    budget NUMERIC,
    department VARCHAR,
    budget_code VARCHAR,
    fiscal_year INTEGER,
    publish_date TIMESTAMP,
    opening_date TIMESTAMP,
    closing_date TIMESTAMP,
    created_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM vendor_sourcing.get_tenders(
        NULLIF(p_status, ''),
        NULL,          -- category
        NULLIF(p_query, ''),
        'created_at',  -- sort_by
        'desc',        -- sort_dir
        p_page_size,   -- limit
        (p_page - 1) * p_page_size  -- offset
    );
$$;

-- ============================================================
-- 5. Requisition wrapper functions
--    API calls get_requisitions_sp with 7 params:
--      $1=status, $2=department, $3=query, $4=sortBy, $5=sortOrder, $6=page, $7=pageSize
--    DB get_requisitions_sp has 10 params + refcursor
-- ============================================================

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisitions_sp(
    p_status VARCHAR DEFAULT '',
    p_department VARCHAR DEFAULT '',
    p_query TEXT DEFAULT '',
    p_sort_by VARCHAR DEFAULT 'created_at',
    p_sort_dir VARCHAR DEFAULT 'DESC',
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    requisition_id UUID,
    title VARCHAR,
    department VARCHAR,
    unit_id UUID,
    app_item_id UUID,
    app_item_description TEXT,
    status VARCHAR,
    priority VARCHAR,
    funding_source VARCHAR,
    total_estimate NUMERIC,
    required_by TIMESTAMP,
    created_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM procurement_workflow.get_requisitions(
        NULLIF(p_status, ''),
        NULLIF(p_department, ''),
        NULL,          -- priority
        NULLIF(p_query, ''),
        NULL,          -- date_from
        NULL,          -- date_to
        p_sort_by,
        p_sort_dir,
        p_page_size,
        (p_page - 1) * p_page_size
    );
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisition_detail_sp(
    p_requisition_id UUID
)
RETURNS TABLE(
    requisition_id UUID,
    title VARCHAR,
    department VARCHAR,
    unit_id UUID,
    status VARCHAR,
    priority VARCHAR,
    funding_source VARCHAR,
    total_estimate NUMERIC,
    required_by TIMESTAMP,
    created_at TIMESTAMP,
    procurement_type VARCHAR,
    budget_code VARCHAR,
    app_item_id UUID,
    project_code VARCHAR,
    delivery_location TEXT,
    justification TEXT,
    risk_notes TEXT,
    updated_at TIMESTAMP,
    current_stage VARCHAR
)
LANGUAGE sql STABLE
AS $$
    SELECT * FROM procurement_workflow.get_requisition_detail(p_requisition_id);
$$;

-- ============================================================
-- 6. Procurement plan wrapper functions
-- ============================================================

CREATE OR REPLACE FUNCTION procurement_workflow.create_procurement_plan_sp(
    p_plan_title VARCHAR,
    p_department VARCHAR,
    p_fiscal_year INTEGER,
    p_status VARCHAR,
    p_total_budget NUMERIC,
    p_notes TEXT
)
RETURNS TABLE(
    plan_id UUID,
    plan_title_out VARCHAR,
    department VARCHAR,
    fiscal_year INTEGER,
    status VARCHAR,
    total_budget NUMERIC,
    notes TEXT,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    error_message TEXT
)
LANGUAGE plpgsql VOLATILE
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO procurement_workflow.procurement_plans
        (plan_title, department, fiscal_year, status, total_budget, notes, created_at, updated_at)
    VALUES (p_plan_title, p_department, p_fiscal_year,
            COALESCE(NULLIF(p_status, ''), 'Draft'), p_total_budget, p_notes, NOW(), NOW())
    RETURNING
        procurement_plans.plan_id,
        procurement_plans.plan_title,
        procurement_plans.department,
        procurement_plans.fiscal_year,
        procurement_plans.status,
        procurement_plans.total_budget,
        procurement_plans.notes,
        procurement_plans.submitted_at,
        procurement_plans.approved_at,
        procurement_plans.created_at,
        procurement_plans.updated_at,
        NULL::TEXT;
END;
$$;

-- Procurement plan item SP wrapper
CREATE OR REPLACE FUNCTION procurement_workflow.create_procurement_plan_item_sp(
    p_plan_id UUID,
    p_item_code VARCHAR,
    p_description TEXT,
    p_budget_code VARCHAR,
    p_procurement_type VARCHAR,
    p_estimated_amount NUMERIC,
    p_status VARCHAR,
    p_notes TEXT
)
RETURNS TABLE(
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR,
    description TEXT,
    budget_code VARCHAR,
    estimated_amount NUMERIC,
    status VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    error_message TEXT
)
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_cycle_id UUID;
    v_fiscal_year INTEGER;
    v_department VARCHAR;
BEGIN
    SELECT p.fiscal_year, p.department INTO v_fiscal_year, v_department
    FROM procurement_workflow.procurement_plans p WHERE p.plan_id = p_plan_id;

    SELECT pc.plan_cycle_id INTO v_cycle_id
    FROM procurement_workflow.procurement_plan_cycles pc
    WHERE pc.fiscal_year = v_fiscal_year
    ORDER BY pc.created_at DESC LIMIT 1;

    IF v_cycle_id IS NULL THEN
        v_cycle_id := gen_random_uuid();
        INSERT INTO procurement_workflow.procurement_plan_cycles
            (plan_cycle_id, fiscal_year, cycle_code, title, department, status)
        VALUES (v_cycle_id, v_fiscal_year, 'CYC-' || v_fiscal_year, 'Cycle ' || v_fiscal_year, v_department, 'Draft');
    END IF;

    RETURN QUERY
    INSERT INTO procurement_workflow.procurement_plan_items
        (plan_cycle_id, plan_id, fiscal_year, app_code, title, department, procurement_category, budget_code,
         funding_source, estimated_cost, procurement_type, estimated_amount, description, notes, status, created_by, created_at, updated_at)
    VALUES (v_cycle_id, p_plan_id, v_fiscal_year,
            COALESCE(NULLIF(p_item_code, ''), 'ITEM-' || gen_random_uuid()::TEXT),
            p_description, v_department, COALESCE(NULLIF(p_procurement_type, ''), 'General'),
            p_budget_code, '', p_estimated_amount,
            p_procurement_type, p_estimated_amount, p_description, p_notes,
            COALESCE(NULLIF(p_status, ''), 'Active'), CURRENT_USER, NOW(), NOW())
    RETURNING
        procurement_plan_items.plan_item_id,
        procurement_plan_items.plan_id,
        procurement_plan_items.item_code,
        procurement_plan_items.description,
        procurement_plan_items.budget_code,
        procurement_plan_items.estimated_amount,
        procurement_plan_items.status,
        procurement_plan_items.notes,
        procurement_plan_items.created_at,
        procurement_plan_items.updated_at,
        NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.update_procurement_plan_sp(
    p_plan_id UUID,
    p_plan_title VARCHAR,
    p_department VARCHAR,
    p_fiscal_year INTEGER,
    p_status VARCHAR,
    p_total_budget NUMERIC,
    p_notes TEXT,
    p_submitted_at TIMESTAMP DEFAULT NULL,
    p_approved_at TIMESTAMP DEFAULT NULL
)
RETURNS TABLE(
    plan_id UUID,
    plan_title VARCHAR,
    department VARCHAR,
    fiscal_year INTEGER,
    status VARCHAR,
    total_budget NUMERIC,
    notes TEXT,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    error_message TEXT
)
LANGUAGE sql VOLATILE
AS $$
    UPDATE procurement_workflow.procurement_plans
    SET plan_title = COALESCE(NULLIF(p_plan_title, ''), plan_title),
        department = COALESCE(NULLIF(p_department, ''), department),
        fiscal_year = COALESCE(p_fiscal_year, fiscal_year),
        status = COALESCE(NULLIF(p_status, ''), status),
        total_budget = COALESCE(p_total_budget, total_budget),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE plan_id = p_plan_id
    RETURNING plan_id, plan_title, department, fiscal_year, status, total_budget, notes, submitted_at, approved_at, created_at, updated_at, NULL::TEXT;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.delete_procurement_plan_sp(
    p_plan_id UUID
)
RETURNS TABLE(
    plan_id UUID,
    plan_title VARCHAR,
    department VARCHAR,
    fiscal_year INTEGER,
    status VARCHAR,
    total_budget NUMERIC,
    notes TEXT,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    error_message TEXT
)
LANGUAGE sql VOLATILE
AS $$
    DELETE FROM procurement_workflow.procurement_plans WHERE plan_id = p_plan_id
    RETURNING plan_id, plan_title, department, fiscal_year, status, total_budget, notes, submitted_at, approved_at, created_at, updated_at, NULL::TEXT;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.update_procurement_plan_item_sp(
    p_plan_item_id UUID,
    p_item_code VARCHAR,
    p_description TEXT,
    p_budget_code VARCHAR,
    p_procurement_type VARCHAR,
    p_estimated_amount NUMERIC,
    p_status VARCHAR,
    p_notes TEXT
)
RETURNS TABLE(
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR,
    description TEXT,
    budget_code VARCHAR,
    estimated_amount NUMERIC,
    status VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    error_message TEXT
)
LANGUAGE sql VOLATILE
AS $$
    UPDATE procurement_workflow.procurement_plan_items
    SET item_code = COALESCE(NULLIF(p_item_code, ''), item_code),
        description = COALESCE(p_description, description),
        budget_code = COALESCE(NULLIF(p_budget_code, ''), budget_code),
        procurement_type = COALESCE(NULLIF(p_procurement_type, ''), procurement_type),
        estimated_amount = COALESCE(NULLIF(p_estimated_amount, 0), estimated_amount),
        status = COALESCE(NULLIF(p_status, ''), status),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE plan_item_id = p_plan_item_id
    RETURNING plan_item_id, plan_id, item_code, description, budget_code, estimated_amount, status, notes, created_at, updated_at, NULL::TEXT;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.delete_procurement_plan_item_sp(
    p_plan_item_id UUID
)
RETURNS TABLE(
    plan_item_id UUID,
    plan_id UUID,
    item_code VARCHAR,
    description TEXT,
    budget_code VARCHAR,
    estimated_amount NUMERIC,
    status VARCHAR,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    error_message TEXT
)
LANGUAGE sql VOLATILE
AS $$
    DELETE FROM procurement_workflow.procurement_plan_items WHERE plan_item_id = p_plan_item_id
    RETURNING plan_item_id, plan_id, item_code, description, budget_code, estimated_amount, status, notes, created_at, updated_at, NULL::TEXT;
$$;

-- ============================================================
-- 7. Update tender SP wrapper
--    API calls update_tender_sp with 14 params:
--      $1=tenderId, $2=title, $3=description, $4=estimatedValue,
--      $5=status, $6=closingDate, $7=requirements, $8=evaluationCriteria,
--      $9=category, $10=procurementType, $11=fundingSource,
--      $12=approvalLevel, $13=unitId, $14=departmentId
-- ============================================================

CREATE OR REPLACE FUNCTION vendor_sourcing.update_tender_sp(
    p_tender_id UUID,
    p_title VARCHAR,
    p_description TEXT,
    p_budget NUMERIC,
    p_status VARCHAR,
    p_closing_date TIMESTAMP,
    p_specifications TEXT,
    p_evaluation_criteria TEXT,
    p_category VARCHAR,
    p_procurement_type VARCHAR,
    p_funding_source VARCHAR,
    p_approval_level VARCHAR,
    p_unit_id UUID,
    p_department_id UUID
)
RETURNS TABLE(
    tender_id UUID,
    title VARCHAR,
    description TEXT,
    category VARCHAR,
    status VARCHAR,
    budget NUMERIC,
    closing_date TIMESTAMP,
    specifications TEXT,
    evaluation_criteria TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE sql VOLATILE
AS $$
    UPDATE vendor_sourcing.tenders
    SET title = COALESCE(NULLIF(p_title, ''), title),
        description = COALESCE(NULLIF(p_description, ''), description),
        budget = COALESCE(NULLIF(p_budget, 0), budget),
        status = COALESCE(NULLIF(p_status, ''), status),
        closing_date = COALESCE(p_closing_date, closing_date),
        specifications = COALESCE(NULLIF(p_specifications, ''), specifications),
        eligibility_criteria = COALESCE(NULLIF(p_evaluation_criteria, ''), eligibility_criteria),
        category = COALESCE(NULLIF(p_category, ''), category),
        updated_at = NOW()
    WHERE tender_id = p_tender_id
    RETURNING tender_id, title, description, category, status, budget, closing_date,
              specifications, eligibility_criteria AS evaluation_criteria, created_at, updated_at;
$$;

-- ============================================================
-- 8. Identity notifications SP wrapper
-- ============================================================

CREATE OR REPLACE FUNCTION identity.get_internal_notifications_sp(
    p_user_id VARCHAR
)
RETURNS TABLE(
    notification_id UUID,
    title VARCHAR,
    message TEXT,
    notification_type VARCHAR,
    entity_type VARCHAR,
    entity_id VARCHAR,
    is_read BOOLEAN,
    created_at TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
    SELECT
        gen_random_uuid() AS notification_id,
        'Welcome'::VARCHAR AS title,
        'You are now signed in.'::TEXT AS message,
        'info'::VARCHAR AS notification_type,
        'auth'::VARCHAR AS entity_type,
        p_user_id AS entity_id,
        false AS is_read,
        NOW() AS created_at;
$$;
