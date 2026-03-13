-- Stored Procedure: Publish Contract Award (PostgreSQL)
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
