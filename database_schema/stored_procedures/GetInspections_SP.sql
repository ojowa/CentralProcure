-- Stored Procedure: Get Inspections (PostgreSQL)
CREATE OR REPLACE PROCEDURE post_award.get_inspections_sp(
    IN p_status VARCHAR(50),
    IN p_query TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_inspections(p_status, p_query);
END;
$$;
