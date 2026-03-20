BEGIN;

UPDATE procurement_workflow.budget_commitments c
SET appropriation_id = a.appropriation_id,
    updated_at = CURRENT_TIMESTAMP
FROM procurement_workflow.budget_appropriations a
WHERE c.appropriation_id IS NULL
  AND a.status = 'Active'
  AND a.budget_code = c.budget_code
  AND a.department = c.department
  AND a.fiscal_year = c.fiscal_year;

COMMIT;
