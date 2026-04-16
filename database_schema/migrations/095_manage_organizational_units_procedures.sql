BEGIN;

-- Procedure to Create or Update an Organizational Unit
CREATE OR REPLACE FUNCTION identity.manage_organizational_unit_sp(
    p_unit_id UUID,
    p_unit_code VARCHAR(60),
    p_unit_name VARCHAR(150),
    p_unit_type VARCHAR(50),
    p_parent_unit_id UUID,
    p_sort_order INT,
    p_is_assignable BOOLEAN,
    p_is_active BOOLEAN,
    p_updated_by VARCHAR(255)
) RETURNS refcursor AS $$
DECLARE
    v_result_cursor refcursor := 'unit_result';
BEGIN
    IF p_unit_id IS NULL THEN
        -- Insert new unit
        INSERT INTO identity.organizational_units (
            unit_code,
            unit_name,
            unit_type,
            parent_unit_id,
            sort_order,
            is_assignable,
            is_active,
            created_by,
            updated_by
        )
        VALUES (
            p_unit_code,
            p_unit_name,
            p_unit_type,
            p_parent_unit_id,
            p_sort_order,
            p_is_assignable,
            p_is_active,
            p_updated_by,
            p_updated_by
        )
        RETURNING unit_id INTO p_unit_id;
    ELSE
        -- Update existing unit
        UPDATE identity.organizational_units
        SET
            unit_code = p_unit_code,
            unit_name = p_unit_name,
            unit_type = p_unit_type,
            parent_unit_id = p_parent_unit_id,
            sort_order = p_sort_order,
            is_assignable = p_is_assignable,
            is_active = p_is_active,
            updated_by = p_updated_by,
            updated_at = NOW()
        WHERE unit_id = p_unit_id;
    END IF;

    OPEN v_result_cursor FOR
    SELECT 
        ou.unit_id, 
        ou.unit_name, 
        ou.unit_code, 
        ou.unit_type, 
        ou.parent_unit_id, 
        parent.unit_name AS parent_unit_name, 
        ou.sort_order, 
        ou.is_assignable
    FROM identity.organizational_units ou
    LEFT JOIN identity.organizational_units parent ON parent.unit_id = ou.parent_unit_id
    WHERE ou.unit_id = p_unit_id;

    RETURN v_result_cursor;
END;
$$ LANGUAGE plpgsql;

COMMIT;
