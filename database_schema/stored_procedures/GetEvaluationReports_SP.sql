-- Stored Procedure: Get Evaluation Reports (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_evaluation_reports_sp(
    IN p_status VARCHAR(50),
    IN p_query TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_evaluation_reports(p_status, p_query);
END;
$$;
