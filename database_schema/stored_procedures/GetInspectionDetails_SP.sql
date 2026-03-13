-- Stored Procedure: Get Inspection Detail (PostgreSQL)
CREATE OR REPLACE PROCEDURE post_award.get_inspection_detail_sp(
    IN p_inspection_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM post_award.get_inspection_detail(p_inspection_code);
END;
$$;
