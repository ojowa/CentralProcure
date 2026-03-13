-- Migration 004: Vendor Sourcing Tenders (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS vendor_sourcing;

CREATE TABLE IF NOT EXISTS vendor_sourcing.tenders (
    tender_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft',
    budget DECIMAL(18, 2),
    specifications TEXT,
    eligibility_criteria TEXT,
    evaluation_criteria TEXT,
    publish_date TIMESTAMP WITHOUT TIME ZONE,
    opening_date TIMESTAMP WITHOUT TIME ZONE,
    closing_date TIMESTAMP WITHOUT TIME ZONE,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tenders_status_chk'
          AND conrelid = 'vendor_sourcing.tenders'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.tenders
            ADD CONSTRAINT tenders_status_chk
            CHECK (status IN ('Draft', 'Published', 'Closed', 'Awarded', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tenders_budget_chk'
          AND conrelid = 'vendor_sourcing.tenders'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.tenders
            ADD CONSTRAINT tenders_budget_chk
            CHECK (budget IS NULL OR budget >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tenders_dates_chk'
          AND conrelid = 'vendor_sourcing.tenders'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.tenders
            ADD CONSTRAINT tenders_dates_chk
            CHECK (
                closing_date IS NULL
                OR opening_date IS NULL
                OR closing_date >= opening_date
            );
    END IF;
END
$$;

-- get_tenders function
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

-- get_tenders_count function
CREATE OR REPLACE FUNCTION vendor_sourcing.get_tenders_count(
    p_status VARCHAR(50) DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM vendor_sourcing.tenders t
    WHERE
        (p_status IS NULL OR t.status ILIKE p_status)
        AND (p_category IS NULL OR t.category ILIKE '%' || p_category || '%')
        AND (
            p_query IS NULL
            OR t.title ILIKE '%' || p_query || '%'
            OR t.description ILIKE '%' || p_query || '%'
        );

    RETURN v_count;
END;
$$;

-- get_tenders stored procedure
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

-- create_tender function
CREATE OR REPLACE FUNCTION vendor_sourcing.create_tender(
    p_title VARCHAR(500),
    p_description TEXT,
    p_category VARCHAR(100),
    p_status VARCHAR(50),
    p_budget DECIMAL(18, 2),
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
BEGIN
    INSERT INTO vendor_sourcing.tenders (
        title,
        description,
        category,
        status,
        budget,
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
        COALESCE(p_status, 'Draft'),
        p_budget,
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    )
    RETURNING tenders.tender_id INTO v_tender_id;

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
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

-- create_tender stored procedure
CREATE OR REPLACE PROCEDURE vendor_sourcing.create_tender_sp(
    IN p_title VARCHAR(500),
    IN p_description TEXT,
    IN p_category VARCHAR(100),
    IN p_status VARCHAR(50),
    IN p_budget DECIMAL(18, 2),
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
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;

-- update_tender function
CREATE OR REPLACE FUNCTION vendor_sourcing.update_tender(
    p_tender_id UUID,
    p_title VARCHAR(500),
    p_description TEXT,
    p_category VARCHAR(100),
    p_status VARCHAR(50),
    p_budget DECIMAL(18, 2),
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
    UPDATE vendor_sourcing.tenders
    SET
        title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        category = COALESCE(p_category, category),
        status = COALESCE(p_status, status),
        budget = COALESCE(p_budget, budget),
        specifications = COALESCE(p_specifications, specifications),
        eligibility_criteria = COALESCE(p_eligibility_criteria, eligibility_criteria),
        evaluation_criteria = COALESCE(p_evaluation_criteria, evaluation_criteria),
        publish_date = COALESCE(p_publish_date, publish_date),
        opening_date = COALESCE(p_opening_date, opening_date),
        closing_date = COALESCE(p_closing_date, closing_date),
        updated_at = NOW()
    WHERE tender_id = p_tender_id;

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
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

-- update_tender stored procedure
CREATE OR REPLACE PROCEDURE vendor_sourcing.update_tender_sp(
    IN p_tender_id UUID,
    IN p_title VARCHAR(500),
    IN p_description TEXT,
    IN p_category VARCHAR(100),
    IN p_status VARCHAR(50),
    IN p_budget DECIMAL(18, 2),
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
        p_specifications,
        p_eligibility_criteria,
        p_evaluation_criteria,
        p_publish_date,
        p_opening_date,
        p_closing_date
    );
END;
$$;

-- publish_tender function
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
    UPDATE vendor_sourcing.tenders
    SET
        status = 'Published',
        publish_date = COALESCE(p_publish_date, NOW()),
        opening_date = COALESCE(p_opening_date, opening_date),
        closing_date = COALESCE(p_closing_date, closing_date),
        updated_at = NOW()
    WHERE tender_id = p_tender_id;

    RETURN QUERY
    SELECT
        t.tender_id,
        t.title,
        t.description,
        t.category,
        t.status,
        t.budget,
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

-- publish_tender stored procedure
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

COMMIT;

