UPDATE procurement_workflow.planning_committee_decisions
SET overall_decision = 'ReturnedToDepartment'
WHERE overall_decision = 'Returned';

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP CONSTRAINT IF EXISTS committee_decision_overall_chk;

ALTER TABLE procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT committee_decision_overall_chk
    CHECK (overall_decision IN ('Recommended', 'ReturnedToDepartment', 'Rejected'));
