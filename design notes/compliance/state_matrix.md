# PPA 2007 State Coverage Matrix

This matrix is the Phase 0 baseline for the workflow in
[workflow_blueprint.md](./workflow_blueprint.md).

Status meanings:
- `implemented`: state has clear persistence, backend route coverage, and workflow-aware handling
- `partial`: state exists through module-local status or screens, but not as a canonical workflow state
- `missing`: no concrete runtime carrier or no clear backend path

| Blueprint State | Existing Table(s) | Existing Backend Endpoint(s) | Existing Frontend Module/Page | Status | Missing Work |
| --- | --- | --- | --- | --- | --- |
| `department_need_capture` | `procurement_workflow.procurement_plans` | `GET/POST/PUT /api/procurement-plans` | `APP Planning`, `Create Requisition` | partial | Plan draft state is persisted, but not as a canonical workflow stage |
| `planning_committee_review` | `procurement_workflow.procurement_plans` | `PUT /api/procurement-plans/{planId}` | `APP Planning` | partial | No dedicated committee review record, actor trace, or transition enforcement |
| `budget_confirmation` | `procurement_workflow.procurement_plan_items`, `procurement_workflow.budget_commitments` | `GET /api/procurement-plans`, budget ledger endpoints | `APP Planning`, budget views | partial | Budget gate is implied by plan items and ledger data, not tracked as a workflow state |
| `app_approval` | `procurement_workflow.procurement_plans` | `PUT /api/procurement-plans/{planId}` | `APP Planning` | partial | Approval is stored in plan status, but there is no canonical workflow instance or approval route trace |
| `procurement_initiation` | `procurement_workflow.requisitions` | `GET/POST/PUT /api/requisitions` | `Create Requisition`, `Requisition History` | partial | Requisition status is persisted, but blueprint stage linkage is only implicit |
| `threshold_resolution` | `procurement_workflow.approval_thresholds`, `procurement_workflow.requisitions` | `GET /api/approval-thresholds`, `GET/POST/PUT /api/requisitions` | `Workflow Configuration`, requisition tracking | partial | Threshold data exists, but live records do not persist resolved route decisions as workflow movement |
| `method_validation` | `vendor_sourcing.tenders` | `GET/POST/PUT /api/tenders` | `Create Tender` | partial | Tender drafting implies method validation, but no explicit method gate or transition rule is enforced centrally |
| `solicitation` | `vendor_sourcing.tenders` | `POST /api/tenders/{tenderId}/publish`, public tender routes | `Publish Tender`, `/tenders` | partial | Publication state exists, but no canonical workflow instance or complaint branch hook |
| `bid_opening` | `vendor_sourcing.bid_opening_sessions` | `GET/POST/PUT /api/bid-opening/sessions` | `Bid Opening` | partial | Session state is well-validated locally, but not linked to a unified workflow record |
| `evaluation` | `procurement_workflow.evaluation_reports` | `GET /api/evaluation-reports`, evaluation assignment endpoints | `Assigned Tenders`, `Technical Evaluation`, `Financial Evaluation`, `Evaluation Report` | partial | Evaluation artifacts exist, but there is no canonical procurement item state transition into or out of evaluation |
| `tenders_board_review` | `procurement_workflow.evaluation_reports`, `procurement_workflow.approval_thresholds` | approval review endpoints, evaluation report reads | `Tender Review`, `Board Decisions` | partial | Board stage is represented in UI and thresholds, but backend runtime stage is not persisted centrally |
| `accounting_officer_review` | `procurement_workflow.requisitions`, `procurement_workflow.approval_thresholds` | approval review endpoints, requisition updates | `High Value Tenders` | partial | Escalation logic is not consistently materialized as a workflow state per live item |
| `bpp_no_objection` | `procurement_workflow.bpp_no_objections` | `GET/POST/PUT /api/bpp-no-objections` | `BPP Escalation` | partial | BPP records exist, but they are not yet the canonical continuation of a parent procurement workflow |
| `award_and_publication` | `post_award.contract_awards`, `vendor_sourcing.tenders` | `GET /api/contracts/awards`, `POST /api/contracts/awards/{awardId}/publish` | `Contract Award` | partial | Award publication exists, but parent procurement progression and complaint branch re-entry are not unified |
| `contract_execution` | `post_award.contracts`, `post_award.contract_milestones` | `GET /api/contracts`, `POST /api/contracts/{contractId}/milestones` | `Contract Management` | partial | Contract progress exists, but milestone progression is not tied to the blueprint stage machine |
| `inspection_and_payment` | `post_award.inspections` | `GET /api/inspections` | `Inspection Acceptance` | partial | Inspection data exists, but payment readiness and closeout transition are not enforced as blueprint movement |
| `closeout_and_audit` | `procurement_workflow.procurement_closeouts` | `POST /api/audit/closeouts` | audit dashboard | partial | Closeout records exist and API is implemented, but stage transition enforcement needs verification |
| `administrative_review` | `procurement_workflow.procurement_complaints` | `GET/POST/PUT /api/administrative-reviews` | `AdministrativeReviewModule` | partial | Complaint filing and resolution implemented, but frontend complaint filing button integration pending |

## Coverage Summary

- `implemented`: 0
- `partial`: 18
- `missing`: 0

## Immediate Engineering Conclusions

1. The blueprint catalog is already in the database and backend.
2. Operational modules already hold most domain data needed for the workflow.
3. The main missing layer is the canonical runtime workflow carrier that links real records to blueprint stages and transition history.
4. `closeout_and_audit` and `administrative_review` remain the clearest functional gaps after the runtime carrier is introduced.
