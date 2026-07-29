-- Migration 104: Needs Management (Collection → Analysis → Endorsement)
BEGIN;

-- ============================================================
-- Phase 1: Collection — units submit their procurement needs
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_workflow.needs_collection (
    collection_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id         UUID NOT NULL REFERENCES identity.organizational_units(unit_id),
    title           VARCHAR(255) NOT NULL,
    fiscal_year     INT NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'Draft',  -- Draft, Submitted
    remarks         TEXT NULL,
    submitted_at    TIMESTAMP WITHOUT TIME ZONE NULL,
    created_by      VARCHAR(255) DEFAULT CURRENT_USER,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.needs_collection_items (
    item_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   UUID NOT NULL REFERENCES procurement_workflow.needs_collection(collection_id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    quantity        DECIMAL(18,2) NOT NULL DEFAULT 1,
    unit            VARCHAR(50) NOT NULL,
    priority        VARCHAR(50) DEFAULT 'Normal',     -- Normal, Urgent, Strategic
    procurement_type VARCHAR(50) DEFAULT 'Goods',     -- Goods, Works, Services
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nc_unit_id ON procurement_workflow.needs_collection(unit_id);
CREATE INDEX IF NOT EXISTS idx_nc_status ON procurement_workflow.needs_collection(status);
CREATE INDEX IF NOT EXISTS idx_nc_fiscal_year ON procurement_workflow.needs_collection(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_nci_collection_id ON procurement_workflow.needs_collection_items(collection_id);

-- ============================================================
-- Phase 2: Assessment — procurement consolidates & endorses
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_workflow.needs_assessment (
    assessment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year     INT NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'Draft',  -- Draft, Endorsed, Rejected
    remarks         TEXT NULL,
    assessed_by     VARCHAR(255) NULL,
    assessed_at     TIMESTAMP WITHOUT TIME ZONE NULL,
    created_by      VARCHAR(255) DEFAULT CURRENT_USER,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.needs_assessment_items (
    item_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id   UUID NOT NULL REFERENCES procurement_workflow.needs_assessment(assessment_id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    quantity        DECIMAL(18,2) NOT NULL DEFAULT 1,
    unit            VARCHAR(50) NOT NULL,
    priority        VARCHAR(50) DEFAULT 'Normal',
    procurement_type VARCHAR(50) DEFAULT 'Goods',
    source_units    JSONB DEFAULT '[]',  -- which units requested this item
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_na_fiscal_year ON procurement_workflow.needs_assessment(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_na_status ON procurement_workflow.needs_assessment(status);
CREATE INDEX IF NOT EXISTS idx_nai_assessment_id ON procurement_workflow.needs_assessment_items(assessment_id);

-- ============================================================
-- Function: Analyze needs across all submitted collections
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.analyze_needs(
    p_fiscal_year INT,
    p_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
    item_description TEXT,
    procurement_type VARCHAR(50),
    unit VARCHAR(50),
    total_quantity DECIMAL(18,2),
    occurrence_count INT,
    priority_summary TEXT,
    source_units JSONB
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nci.description AS item_description,
        nci.procurement_type,
        nci.unit,
        SUM(nci.quantity) AS total_quantity,
        COUNT(DISTINCT nc.collection_id)::INT AS occurrence_count,
        STRING_AGG(DISTINCT nci.priority, ', ') AS priority_summary,
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('unitId', nc.unit_id, 'unitName', ou.unit_name)),
            '[]'::jsonb
        ) AS source_units
    FROM procurement_workflow.needs_collection_items nci
    JOIN procurement_workflow.needs_collection nc ON nc.collection_id = nci.collection_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = nc.unit_id
    WHERE nc.fiscal_year = p_fiscal_year
      AND nc.status = 'Submitted'
      AND (p_unit_id IS NULL OR nc.unit_id = p_unit_id)
    GROUP BY nci.description, nci.procurement_type, nci.unit
    ORDER BY total_quantity DESC;
$$;

-- ============================================================
-- Function: Create an assessment from analysis results
-- ============================================================
CREATE OR REPLACE FUNCTION procurement_workflow.create_assessment_from_analysis(
    p_fiscal_year INT,
    p_actor VARCHAR(255)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_assessment_id UUID;
    v_item RECORD;
BEGIN
    INSERT INTO procurement_workflow.needs_assessment (fiscal_year, status, created_by)
    VALUES (p_fiscal_year, 'Draft', p_actor)
    RETURNING assessment_id INTO v_assessment_id;

    FOR v_item IN
        SELECT * FROM procurement_workflow.analyze_needs(p_fiscal_year)
    LOOP
        INSERT INTO procurement_workflow.needs_assessment_items
            (assessment_id, description, quantity, unit, priority, procurement_type, source_units)
        VALUES
            (v_assessment_id, v_item.item_description, v_item.total_quantity,
             v_item.unit, v_item.priority_summary, v_item.procurement_type, v_item.source_units);
    END LOOP;

    RETURN v_assessment_id;
END;
$$;

COMMIT;
