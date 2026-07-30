DROP FUNCTION IF EXISTS post_award.get_inspection_detail(character varying);

CREATE FUNCTION post_award.get_inspection_detail(p_inspection_id character varying)
RETURNS TABLE(
    inspection_id uuid,
    inspection_code character varying,
    contract_code character varying,
    tender_title character varying,
    vendor_name character varying,
    status character varying,
    scheduled_date timestamp without time zone,
    completed_date timestamp without time zone,
    inspector_name character varying,
    outcome character varying,
    location character varying,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.inspection_id,
        i.inspection_code,
        i.contract_code,
        i.tender_title,
        i.vendor_name,
        i.status,
        i.scheduled_date,
        i.completed_date,
        i.inspector_name,
        i.outcome,
        i.location,
        i.notes,
        i.created_at,
        i.updated_at
    FROM post_award.inspections i
    WHERE i.inspection_id = p_inspection_id::uuid
       OR i.inspection_code = p_inspection_id;
END;
$$;
