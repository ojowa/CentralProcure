-- Migration 007: Requisitions (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;

CREATE TABLE IF NOT EXISTS procurement_workflow.requisitions (
    requisition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    priority VARCHAR(50) NULL,
    procurement_type VARCHAR(50) NULL,
    funding_source VARCHAR(120) NULL,
    budget_code VARCHAR(60) NULL,
    project_code VARCHAR(60) NULL,
    required_by TIMESTAMP WITHOUT TIME ZONE NULL,
    delivery_location TEXT NULL,
    justification TEXT NULL,
    risk_notes TEXT NULL,
    total_estimate DECIMAL(18, 2) NOT NULL DEFAULT 0,
    current_stage VARCHAR(60) NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.requisition_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE,
    item_code VARCHAR(50) NULL,
    description TEXT NOT NULL,
    unit VARCHAR(40) NOT NULL,
    quantity DECIMAL(18, 2) NOT NULL,
    unit_cost DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_status_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_status_chk
            CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Evaluation', 'Board Review', 'Approved', 'Rejected', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_priority_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_priority_chk
            CHECK (priority IS NULL OR priority IN ('Normal', 'Urgent', 'Strategic'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_proc_type_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_proc_type_chk
            CHECK (procurement_type IS NULL OR procurement_type IN ('Goods', 'Works', 'Services'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_total_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_total_chk
            CHECK (total_estimate >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_title_len_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_title_len_chk
            CHECK (char_length(title) BETWEEN 5 AND 255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_department_len_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_department_len_chk
            CHECK (char_length(department) BETWEEN 3 AND 150);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_budget_code_len_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_budget_code_len_chk
            CHECK (budget_code IS NULL OR char_length(budget_code) <= 60);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_project_code_len_chk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_project_code_len_chk
            CHECK (project_code IS NULL OR char_length(project_code) <= 60);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisition_line_items_qty_chk'
          AND conrelid = 'procurement_workflow.requisition_line_items'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisition_line_items
            ADD CONSTRAINT requisition_line_items_qty_chk
            CHECK (quantity > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisition_line_items_cost_chk'
          AND conrelid = 'procurement_workflow.requisition_line_items'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisition_line_items
            ADD CONSTRAINT requisition_line_items_cost_chk
            CHECK (unit_cost > 0);
    END IF;
END
$$;

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

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisitions(
    p_status VARCHAR(50) DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_priority VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_date_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_sort_by VARCHAR(50) DEFAULT 'created_at',
    p_sort_dir VARCHAR(4) DEFAULT 'desc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
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
    created_at TIMESTAMP WITHOUT TIME ZONE
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
        r.created_at
    FROM
        procurement_workflow.requisitions r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (p_department IS NULL OR r.department ILIKE '%' || p_department || '%')
        AND (p_priority IS NULL OR r.priority ILIKE p_priority)
        AND (
            p_query IS NULL
            OR r.title ILIKE '%' || p_query || '%'
            OR r.department ILIKE '%' || p_query || '%'
            OR r.requisition_id::text ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR r.created_at >= p_date_from)
        AND (p_date_to IS NULL OR r.created_at <= p_date_to)
    ORDER BY
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'asc' THEN r.title END ASC,
        CASE WHEN lower(p_sort_by) = 'title' AND lower(p_sort_dir) = 'desc' THEN r.title END DESC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'asc' THEN r.department END ASC,
        CASE WHEN lower(p_sort_by) = 'department' AND lower(p_sort_dir) = 'desc' THEN r.department END DESC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'asc' THEN r.status END ASC,
        CASE WHEN lower(p_sort_by) = 'status' AND lower(p_sort_dir) = 'desc' THEN r.status END DESC,
        CASE WHEN lower(p_sort_by) = 'priority' AND lower(p_sort_dir) = 'asc' THEN r.priority END ASC,
        CASE WHEN lower(p_sort_by) = 'priority' AND lower(p_sort_dir) = 'desc' THEN r.priority END DESC,
        CASE WHEN lower(p_sort_by) = 'total_estimate' AND lower(p_sort_dir) = 'asc' THEN r.total_estimate END ASC,
        CASE WHEN lower(p_sort_by) = 'total_estimate' AND lower(p_sort_dir) = 'desc' THEN r.total_estimate END DESC,
        CASE WHEN lower(p_sort_by) = 'required_by' AND lower(p_sort_dir) = 'asc' THEN r.required_by END ASC,
        CASE WHEN lower(p_sort_by) = 'required_by' AND lower(p_sort_dir) = 'desc' THEN r.required_by END DESC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'asc' THEN r.created_at END ASC,
        CASE WHEN lower(p_sort_by) = 'created_at' AND lower(p_sort_dir) = 'desc' THEN r.created_at END DESC,
        r.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisitions_count(
    p_status VARCHAR(50) DEFAULT NULL,
    p_department VARCHAR(150) DEFAULT NULL,
    p_priority VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_date_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM procurement_workflow.requisitions r
    WHERE
        (p_status IS NULL OR r.status ILIKE p_status)
        AND (p_department IS NULL OR r.department ILIKE '%' || p_department || '%')
        AND (p_priority IS NULL OR r.priority ILIKE p_priority)
        AND (
            p_query IS NULL
            OR r.title ILIKE '%' || p_query || '%'
            OR r.department ILIKE '%' || p_query || '%'
            OR r.requisition_id::text ILIKE '%' || p_query || '%'
        )
        AND (p_date_from IS NULL OR r.created_at >= p_date_from)
        AND (p_date_to IS NULL OR r.created_at <= p_date_to);

    RETURN v_count;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_requisitions_sp(
    IN p_status VARCHAR(50),
    IN p_department VARCHAR(150),
    IN p_priority VARCHAR(50),
    IN p_query TEXT,
    IN p_date_from TIMESTAMP WITHOUT TIME ZONE,
    IN p_date_to TIMESTAMP WITHOUT TIME ZONE,
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
    SELECT * FROM procurement_workflow.get_requisitions(
        p_status,
        p_department,
        p_priority,
        p_query,
        p_date_from,
        p_date_to,
        p_sort_by,
        p_sort_dir,
        p_limit,
        p_offset
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

CREATE OR REPLACE FUNCTION procurement_workflow.get_requisition_line_items(
    p_requisition_id UUID
)
RETURNS TABLE (
    item_code VARCHAR(50),
    description TEXT,
    unit VARCHAR(40),
    quantity DECIMAL(18, 2),
    unit_cost DECIMAL(18, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        li.item_code,
        li.description,
        li.unit,
        li.quantity,
        li.unit_cost
    FROM procurement_workflow.requisition_line_items li
    WHERE li.requisition_id = p_requisition_id
    ORDER BY li.created_at;
END;
$$;

CREATE OR REPLACE PROCEDURE procurement_workflow.get_requisition_line_items_sp(
    IN p_requisition_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_requisition_line_items(p_requisition_id);
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

CREATE OR REPLACE PROCEDURE procurement_workflow.create_requisition_sp(
    IN p_title VARCHAR(255),
    IN p_department VARCHAR(150),
    IN p_status VARCHAR(50),
    IN p_priority VARCHAR(50),
    IN p_procurement_type VARCHAR(50),
    IN p_funding_source VARCHAR(120),
    IN p_budget_code VARCHAR(60),
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

CREATE OR REPLACE PROCEDURE procurement_workflow.update_requisition_sp(
    IN p_requisition_id UUID,
    IN p_title VARCHAR(255),
    IN p_department VARCHAR(150),
    IN p_status VARCHAR(50),
    IN p_priority VARCHAR(50),
    IN p_procurement_type VARCHAR(50),
    IN p_funding_source VARCHAR(120),
    IN p_budget_code VARCHAR(60),
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
        p_project_code,
        p_required_by,
        p_delivery_location,
        p_justification,
        p_risk_notes,
        p_line_items
    );
END;
$$;

COMMIT;
