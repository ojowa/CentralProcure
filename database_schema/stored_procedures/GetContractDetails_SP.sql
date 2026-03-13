-- Stored Procedure: Get Contract Detail (PostgreSQL)
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
