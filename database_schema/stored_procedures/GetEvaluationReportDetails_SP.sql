-- Stored Procedure: Get Evaluation Report Detail (PostgreSQL)
CREATE OR REPLACE PROCEDURE procurement_workflow.get_evaluation_report_sp(
    IN p_report_code VARCHAR(50),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM procurement_workflow.get_evaluation_report(p_report_code);
END;
$$;
