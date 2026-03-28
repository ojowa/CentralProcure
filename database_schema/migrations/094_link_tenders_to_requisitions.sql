BEGIN;

ALTER TABLE vendor_sourcing.tenders
    ADD COLUMN IF NOT EXISTS requisition_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tenders_requisition_fk'
          AND conrelid = 'vendor_sourcing.tenders'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.tenders
            ADD CONSTRAINT tenders_requisition_fk
            FOREIGN KEY (requisition_id)
            REFERENCES procurement_workflow.requisitions(requisition_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

WITH candidate_links AS (
    SELECT
        t.tender_id,
        r.requisition_id,
        ROW_NUMBER() OVER (
            PARTITION BY t.tender_id
            ORDER BY r.created_at DESC, r.requisition_id
        ) AS tender_match_rank,
        COUNT(*) OVER (PARTITION BY t.tender_id) AS tender_match_count,
        COUNT(*) OVER (PARTITION BY r.requisition_id) AS requisition_match_count
    FROM vendor_sourcing.tenders t
    JOIN procurement_workflow.requisitions r
      ON lower(btrim(r.title)) = lower(btrim(t.title))
     AND COALESCE(lower(btrim(r.department)), '') = COALESCE(lower(btrim(t.department)), '')
     AND COALESCE(lower(btrim(r.budget_code)), '') = COALESCE(lower(btrim(t.budget_code)), '')
    WHERE t.requisition_id IS NULL
)
UPDATE vendor_sourcing.tenders t
SET requisition_id = c.requisition_id
FROM candidate_links c
WHERE t.tender_id = c.tender_id
  AND c.tender_match_rank = 1
  AND c.tender_match_count = 1
  AND c.requisition_match_count = 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenders_requisition_id
    ON vendor_sourcing.tenders (requisition_id)
    WHERE requisition_id IS NOT NULL;

DROP PROCEDURE IF EXISTS vendor_sourcing.get_tenders_sp(
    VARCHAR(50),
    VARCHAR(100),
    TEXT,
    VARCHAR(50),
    VARCHAR(4),
    INT,
    INT
);

DROP FUNCTION IF EXISTS vendor_sourcing.get_tenders(
    VARCHAR(50),
    VARCHAR(100),
    TEXT,
    VARCHAR(50),
    VARCHAR(4),
    INT,
    INT
);

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
    requisition_id UUID,
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
        t.requisition_id,
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

DROP PROCEDURE IF EXISTS vendor_sourcing.get_tender_details_sp(UUID);
DROP FUNCTION IF EXISTS vendor_sourcing.get_tender_details(UUID);

CREATE OR REPLACE FUNCTION vendor_sourcing.get_tender_details(
    p_tender_id UUID
)
RETURNS TABLE (
    tender_id UUID,
    requisition_id UUID,
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
        t.requisition_id,
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

DROP PROCEDURE IF EXISTS vendor_sourcing.create_tender_sp(
    VARCHAR(500),
    TEXT,
    VARCHAR(100),
    VARCHAR(50),
    DECIMAL(18, 2),
    VARCHAR(150),
    VARCHAR(60),
    INT,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE
);

DROP PROCEDURE IF EXISTS vendor_sourcing.create_tender_sp(
    VARCHAR(500),
    UUID,
    TEXT,
    VARCHAR(100),
    VARCHAR(50),
    DECIMAL(18, 2),
    VARCHAR(150),
    VARCHAR(60),
    INT,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE
);

DROP FUNCTION IF EXISTS vendor_sourcing.create_tender(
    VARCHAR(500),
    TEXT,
    VARCHAR(100),
    VARCHAR(50),
    DECIMAL(18, 2),
    VARCHAR(150),
    VARCHAR(60),
    INT,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE
);

DROP FUNCTION IF EXISTS vendor_sourcing.create_tender(
    VARCHAR(500),
    UUID,
    TEXT,
    VARCHAR(100),
    VARCHAR(50),
    DECIMAL(18, 2),
    VARCHAR(150),
    VARCHAR(60),
    INT,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE
);

CREATE OR REPLACE FUNCTION vendor_sourcing.create_tender(
    p_title VARCHAR(500),
    p_requisition_id UUID,
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
    requisition_id UUID,
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

    IF p_requisition_id IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM vendor_sourcing.tenders AS t
           WHERE t.requisition_id = p_requisition_id
       ) THEN
        RAISE EXCEPTION 'A tender already exists for the selected requisition.'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO vendor_sourcing.tenders (
        requisition_id,
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
        p_requisition_id,
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
        t.requisition_id,
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
    IN p_requisition_id UUID,
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
        p_requisition_id,
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

DROP PROCEDURE IF EXISTS vendor_sourcing.update_tender_sp(
    UUID,
    VARCHAR(500),
    TEXT,
    VARCHAR(100),
    VARCHAR(50),
    DECIMAL(18, 2),
    VARCHAR(150),
    VARCHAR(60),
    INT,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE
);

DROP FUNCTION IF EXISTS vendor_sourcing.update_tender(
    UUID,
    VARCHAR(500),
    TEXT,
    VARCHAR(100),
    VARCHAR(50),
    DECIMAL(18, 2),
    VARCHAR(150),
    VARCHAR(60),
    INT,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE,
    TIMESTAMP WITHOUT TIME ZONE
);

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
    requisition_id UUID,
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
        t.requisition_id,
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

COMMIT;
