CREATE OR REPLACE FUNCTION procurement_workflow.sync_procurement_plan_total_budget(
    p_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE procurement_workflow.procurement_plans p
    SET total_budget = COALESCE((
            SELECT SUM(i.estimated_amount)
            FROM procurement_workflow.procurement_plan_items i
            WHERE i.plan_id = p_plan_id
        ), 0),
        updated_at = NOW()
    WHERE p.plan_id = p_plan_id;
END;
$$;
