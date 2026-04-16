-- Migration 098: Need Assessment Collection
BEGIN;

-- Table for Need Assessments
CREATE TABLE IF NOT EXISTS procurement_workflow.need_assessments (
    need_assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES identity.organizational_units(unit_id),
    title VARCHAR(255) NOT NULL,
    fiscal_year INT NOT NULL,
    total_estimated_cost DECIMAL(18, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- Draft, Submitted, Endorsed, Consolidated, Rejected
    remarks TEXT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    endorsed_at TIMESTAMP WITHOUT TIME ZONE NULL,
    endorsed_by VARCHAR(255) NULL,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Table for Need Assessment Items
CREATE TABLE IF NOT EXISTS procurement_workflow.need_assessment_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    need_assessment_id UUID NOT NULL REFERENCES procurement_workflow.need_assessments(need_assessment_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(18, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL,
    estimated_unit_cost DECIMAL(18, 2) NOT NULL DEFAULT 0,
    estimated_total_cost DECIMAL(18, 2) GENERATED ALWAYS AS (quantity * estimated_unit_cost) STORED,
    priority VARCHAR(50) DEFAULT 'Normal', -- Normal, Urgent, Strategic
    procurement_type VARCHAR(50) DEFAULT 'Goods', -- Goods, Works, Services
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS ix_need_assessments_unit_id ON procurement_workflow.need_assessments(unit_id);
CREATE INDEX IF NOT EXISTS ix_need_assessments_status ON procurement_workflow.need_assessments(status);
CREATE INDEX IF NOT EXISTS ix_need_assessment_items_assessment_id ON procurement_workflow.need_assessment_items(need_assessment_id);

-- Function to create/update need assessment
CREATE OR REPLACE FUNCTION procurement_workflow.upsert_need_assessment(
    p_need_assessment_id UUID,
    p_unit_id UUID,
    p_title VARCHAR(255),
    p_fiscal_year INT,
    p_status VARCHAR(50),
    p_remarks TEXT,
    p_actor VARCHAR(255)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_need_assessment_id IS NULL THEN
        INSERT INTO procurement_workflow.need_assessments (
            unit_id, title, fiscal_year, status, remarks, created_by, updated_by
        ) VALUES (
            p_unit_id, p_title, p_fiscal_year, p_status, p_remarks, p_actor, p_actor
        ) RETURNING need_assessment_id INTO v_id;
    ELSE
        UPDATE procurement_workflow.need_assessments
        SET title = p_title,
            fiscal_year = p_fiscal_year,
            status = p_status,
            remarks = p_remarks,
            updated_by = p_actor,
            updated_at = NOW()
        WHERE need_assessment_id = p_need_assessment_id
        RETURNING need_assessment_id INTO v_id;
    END IF;
    RETURN v_id;
END;
$$;

-- Stored Procedure for Need Assessment
CREATE OR REPLACE PROCEDURE procurement_workflow.upsert_need_assessment_sp(
    IN p_need_assessment_id UUID,
    IN p_unit_id UUID,
    IN p_title VARCHAR(255),
    IN p_fiscal_year INT,
    IN p_status VARCHAR(50),
    IN p_remarks TEXT,
    IN p_actor VARCHAR(255),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT procurement_workflow.upsert_need_assessment(
        p_need_assessment_id, p_unit_id, p_title, p_fiscal_year, p_status, p_remarks, p_actor
    );
END;
$$;

-- Grant access to roles via internal_module_grants
-- (We use the module_id 'needs-collection' which will be defined in the C# catalog)
DO $$
DECLARE
    v_module_id VARCHAR := 'needs-collection';
    v_role_record RECORD;
BEGIN
    FOR v_role_record IN 
        SELECT role_id FROM identity.roles 
        WHERE role_name IN ('FormationOfficer', 'FormationHead', 'RequisitioningOfficer', 'DepartmentHead', 'ComptrollerProcurement', 'Admin', 'SystemAdministrator')
    LOOP
        INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
        VALUES (v_role_record.role_id, v_module_id, TRUE)
        ON CONFLICT (role_id, module_id) DO UPDATE SET is_enabled = TRUE;
    END LOOP;
END $$;

COMMIT;
