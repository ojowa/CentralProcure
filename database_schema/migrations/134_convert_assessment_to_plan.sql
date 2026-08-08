-- Function to convert an endorsed assessment into a procurement plan
CREATE OR REPLACE FUNCTION procurement_workflow.convert_assessment_to_plan(
    p_assessment_id UUID,
    p_actor VARCHAR(255)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_id UUID;
    v_assessment RECORD;
    v_item RECORD;
    v_item_code TEXT;
    v_counter INT := 0;
BEGIN
    -- Get assessment details
    SELECT * INTO v_assessment
    FROM procurement_workflow.needs_assessment
    WHERE assessment_id = p_assessment_id AND status = 'Endorsed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found or not endorsed';
    END IF;

    -- Create procurement plan
    INSERT INTO procurement_workflow.procurement_plans (
        plan_title, department, fiscal_year, status, notes, created_by
    ) VALUES (
        'Plan from Assessment FY' || v_assessment.fiscal_year,
        'Consolidated',
        v_assessment.fiscal_year,
        'Draft',
        'Auto-generated from endorsed needs assessment ' || p_assessment_id,
        p_actor
    )
    RETURNING plan_id INTO v_plan_id;

    -- Convert assessment items to plan items
    FOR v_item IN
        SELECT * FROM procurement_workflow.needs_assessment_items
        WHERE assessment_id = p_assessment_id
    LOOP
        v_counter := v_counter + 1;
        v_item_code := 'NP-' || LPAD(v_counter::TEXT, 3, '0');

        INSERT INTO procurement_workflow.procurement_plan_items (
            plan_id, item_code, description, procurement_type, estimated_amount,
            department, fiscal_year, status, notes, created_by
        ) VALUES (
            v_plan_id,
            v_item_code,
            v_item.description,
            v_item.procurement_type,
            CASE
                WHEN v_item.quantity > 0 THEN v_item.quantity * 1000
                ELSE 0
            END,
            'Consolidated',
            v_assessment.fiscal_year,
            'Draft',
            'Priority: ' || v_item.priority || ', Qty: ' || v_item.quantity || ' ' || v_item.unit ||
            ', Source units: ' || COALESCE(v_item.source_units::TEXT, '[]'),
            p_actor
        );
    END LOOP;

    RETURN v_plan_id;
END;
$$;
