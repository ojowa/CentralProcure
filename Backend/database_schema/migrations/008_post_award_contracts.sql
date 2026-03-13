-- Migration 008: Post-Award Contracts (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS post_award;

CREATE TABLE IF NOT EXISTS post_award.contract_awards (
    award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_code VARCHAR(50) NOT NULL UNIQUE,
    tender_title VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    award_value DECIMAL(18, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    award_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    contract_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    contract_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    funding_source VARCHAR(120) NOT NULL,
    notes TEXT NULL,
    published_at TIMESTAMP WITHOUT TIME ZONE NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_award.contracts (
    contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_code VARCHAR(50) NOT NULL UNIQUE,
    tender_title VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    contract_value DECIMAL(18, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    start_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    contract_manager VARCHAR(150) NOT NULL,
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
        WHERE conname = 'contract_awards_status_chk'
          AND conrelid = 'post_award.contract_awards'::regclass
    ) THEN
        ALTER TABLE post_award.contract_awards
            ADD CONSTRAINT contract_awards_status_chk
            CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Published', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'contract_awards_value_chk'
          AND conrelid = 'post_award.contract_awards'::regclass
    ) THEN
        ALTER TABLE post_award.contract_awards
            ADD CONSTRAINT contract_awards_value_chk
            CHECK (award_value >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'contracts_status_chk'
          AND conrelid = 'post_award.contracts'::regclass
    ) THEN
        ALTER TABLE post_award.contracts
            ADD CONSTRAINT contracts_status_chk
            CHECK (status IN ('Active', 'On Hold', 'Completed', 'Terminated'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'contracts_value_chk'
          AND conrelid = 'post_award.contracts'::regclass
    ) THEN
        ALTER TABLE post_award.contracts
            ADD CONSTRAINT contracts_value_chk
            CHECK (contract_value >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'contracts_progress_chk'
          AND conrelid = 'post_award.contracts'::regclass
    ) THEN
        ALTER TABLE post_award.contracts
            ADD CONSTRAINT contracts_progress_chk
            CHECK (progress BETWEEN 0 AND 100);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION post_award.get_contract_awards(
    p_status VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    award_id UUID,
    award_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    award_value DECIMAL(18, 2),
    status VARCHAR(50),
    award_date TIMESTAMP WITHOUT TIME ZONE,
    contract_start TIMESTAMP WITHOUT TIME ZONE,
    contract_end TIMESTAMP WITHOUT TIME ZONE,
    funding_source VARCHAR(120),
    notes TEXT,
    published_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.award_id,
        a.award_code,
        a.tender_title,
        a.vendor_name,
        a.award_value,
        a.status,
        a.award_date,
        a.contract_start,
        a.contract_end,
        a.funding_source,
        a.notes,
        a.published_at,
        a.created_at,
        a.updated_at
    FROM post_award.contract_awards a
    WHERE
        (p_status IS NULL OR a.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR a.award_code ILIKE '%' || p_query || '%'
            OR a.tender_title ILIKE '%' || p_query || '%'
            OR a.vendor_name ILIKE '%' || p_query || '%'
        )
    ORDER BY a.award_date DESC, a.created_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_contract_awards_sp(
    IN p_status VARCHAR(50),
    IN p_query TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_awards(p_status, p_query);
END;
$$;

CREATE OR REPLACE FUNCTION post_award.get_contract_award(
    p_award_code VARCHAR(50)
)
RETURNS TABLE (
    award_id UUID,
    award_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    award_value DECIMAL(18, 2),
    status VARCHAR(50),
    award_date TIMESTAMP WITHOUT TIME ZONE,
    contract_start TIMESTAMP WITHOUT TIME ZONE,
    contract_end TIMESTAMP WITHOUT TIME ZONE,
    funding_source VARCHAR(120),
    notes TEXT,
    published_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.award_id,
        a.award_code,
        a.tender_title,
        a.vendor_name,
        a.award_value,
        a.status,
        a.award_date,
        a.contract_start,
        a.contract_end,
        a.funding_source,
        a.notes,
        a.published_at,
        a.created_at,
        a.updated_at
    FROM post_award.contract_awards a
    WHERE a.award_code = p_award_code;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_contract_award_sp(
    IN p_award_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_award(p_award_code);
END;
$$;

CREATE OR REPLACE FUNCTION post_award.publish_contract_award(
    p_award_code VARCHAR(50)
)
RETURNS TABLE (
    award_id UUID,
    award_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    award_value DECIMAL(18, 2),
    status VARCHAR(50),
    award_date TIMESTAMP WITHOUT TIME ZONE,
    contract_start TIMESTAMP WITHOUT TIME ZONE,
    contract_end TIMESTAMP WITHOUT TIME ZONE,
    funding_source VARCHAR(120),
    notes TEXT,
    published_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE post_award.contract_awards
    SET
        status = 'Published',
        published_at = NOW(),
        updated_at = NOW()
    WHERE award_code = p_award_code
      AND status <> 'Published';

    RETURN QUERY
    SELECT
        a.award_id,
        a.award_code,
        a.tender_title,
        a.vendor_name,
        a.award_value,
        a.status,
        a.award_date,
        a.contract_start,
        a.contract_end,
        a.funding_source,
        a.notes,
        a.published_at,
        a.created_at,
        a.updated_at
    FROM post_award.contract_awards a
    WHERE a.award_code = p_award_code;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.publish_contract_award_sp(
    IN p_award_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.publish_contract_award(p_award_code);
END;
$$;

CREATE OR REPLACE FUNCTION post_award.get_contracts(
    p_status VARCHAR(50) DEFAULT NULL,
    p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    contract_id UUID,
    contract_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    contract_value DECIMAL(18, 2),
    status VARCHAR(50),
    start_date TIMESTAMP WITHOUT TIME ZONE,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    progress INTEGER,
    contract_manager VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status,
        c.start_date,
        c.end_date,
        c.progress,
        c.contract_manager,
        c.notes,
        c.created_at,
        c.updated_at
    FROM post_award.contracts c
    WHERE
        (p_status IS NULL OR c.status ILIKE p_status)
        AND (
            p_query IS NULL
            OR c.contract_code ILIKE '%' || p_query || '%'
            OR c.tender_title ILIKE '%' || p_query || '%'
            OR c.vendor_name ILIKE '%' || p_query || '%'
        )
    ORDER BY c.start_date DESC, c.created_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_contracts_sp(
    IN p_status VARCHAR(50),
    IN p_query TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contracts(p_status, p_query);
END;
$$;

CREATE OR REPLACE FUNCTION post_award.get_contract_detail(
    p_contract_code VARCHAR(50)
)
RETURNS TABLE (
    contract_id UUID,
    contract_code VARCHAR(50),
    tender_title VARCHAR(255),
    vendor_name VARCHAR(255),
    contract_value DECIMAL(18, 2),
    status VARCHAR(50),
    start_date TIMESTAMP WITHOUT TIME ZONE,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    progress INTEGER,
    contract_manager VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status,
        c.start_date,
        c.end_date,
        c.progress,
        c.contract_manager,
        c.notes,
        c.created_at,
        c.updated_at
    FROM post_award.contracts c
    WHERE c.contract_code = p_contract_code;
END;
$$;

CREATE OR REPLACE PROCEDURE post_award.get_contract_detail_sp(
    IN p_contract_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_contract_detail(p_contract_code);
END;
$$;

COMMIT;
