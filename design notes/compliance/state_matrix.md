# PPA 2007 State Coverage Matrix

This matrix reflects the current workflow implementation against
[workflow_blueprint.md](./workflow_blueprint.md).

Status meanings:
- `implemented`: state has canonical workflow runtime persistence, backend transition or stage-aware handling, and frontend or API visibility
- `partial`: state is represented through current status codes or module-local handling, but not yet as a strong dedicated workflow step
- `missing`: no clear runtime carrier or stage-specific backend path

| Blueprint State | Current Implementation Mapping | Existing Table(s) | Existing Backend Endpoint(s) | Existing Frontend Module/Page | Status | Notes / Remaining Gap |
| --- | --- | --- | --- | --- | --- | --- |
| `department_need_capture` | Requisition status `Draft` | `procurement_workflow.requisitions`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/requisitions` | `Create Requisition`, `Requisition History`, `Requisition Tracking` | partial | Canonically mapped in runtime, but still mainly a generic draft state rather than a dedicated stage action |
| `department_head_endorsement` | Requisition status `Submitted` | `procurement_workflow.requisitions`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/requisitions`, `POST /api/requisitions/{requisitionId}/department-head-review` | `Department Head Review`, requisition workspaces | partial | Stage exists in runtime mapping, but endorsement still behaves mostly as a status progression |
| `budget_allocation_and_confirmation` | Requisition status `Endorsed` | `procurement_workflow.requisitions`, `procurement_workflow.workflow_instances`, `procurement_workflow.budget_commitments` | `GET/POST/PUT /api/requisitions`, budget ledger endpoints | budget officer views, requisition workspaces | partial | Current implementation merges budget code assignment and funds confirmation into one effective stage |
| `comptroller_procurement_review` | Requisition status `Initial` | `procurement_workflow.requisitions`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/requisitions` | admin and requisition review views | partial | Present as a canonical stage, but still advanced through coarse requisition status changes |
| `planning_committee_review` | Requisition or plan status `Under Review` | `procurement_workflow.procurement_plans`, `procurement_workflow.planning_committee_member_reviews`, `procurement_workflow.planning_committee_member_status`, `procurement_workflow.workflow_instances` | `GET /api/planning-committee/queue`, `POST /api/planning-committee/submit-member-review`, `POST /api/planning-committee/submit-committee-decision` | `APP Planning`, planning committee workspace | implemented | Dedicated committee review records, runtime sync, role coverage, and final decision handling are in place |
| `app_approval` | Comptroller forwards the planning committee-approved plan to CGIS for approval before procurement initiation | `procurement_workflow.procurement_plans`, `procurement_workflow.workflow_instances` | `POST /api/procurement-plans/{planId}/approval-decision`, `POST /api/procurement-plans/{planId}/recommend-for-approval`, yearly APP approval endpoints | `APP Planning`, procurement plan workspaces | implemented | Runtime-backed and decision-driven, with CGIS approval required before initiation |
| `procurement_initiation` | Approved APP line activated | `procurement_workflow.procurement_plans`, `procurement_workflow.workflow_instances` | `POST /api/procurement-plans/{planId}/initiate-procurement` | procurement plan workspaces | implemented | Explicit transition into live procurement exists |
| `threshold_resolution` | Route decision resolved from thresholds | `procurement_workflow.approval_thresholds`, `procurement_workflow.workflow_instances` | `GET /api/workflow-routing/{entityType}/{entityId}`, `GET/PUT /api/workflow-configurations`, `POST /api/procurement-plans/{planId}/initiate-procurement` | `Workflow Configuration`, requisition tracking, audit diagnostics | implemented | Live route decision and threshold-based workflow handling are implemented |
| `method_validation` | Tender status `Draft` | `vendor_sourcing.tenders`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/tenders` | `Create Tender`, `Tender Management` | implemented | Canonical tender runtime maps draft tenders into method validation |
| `solicitation` | Tender status `Published` | `vendor_sourcing.tenders`, `procurement_workflow.workflow_instances` | `POST /api/tenders/{tenderId}/publish` | `Publish Tender`, tender management pages | implemented | Transition-checked and runtime-backed |
| `bid_opening` | Tender status `Closed` and bid opening sessions | `vendor_sourcing.bid_opening_sessions`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/bid-opening/sessions` | `Bid Opening` | implemented | Bid opening records sync into the unified workflow runtime |
| `evaluation` | Evaluation actions and reports | `procurement_workflow.evaluation_reports`, `procurement_workflow.workflow_instances` | `GET /api/evaluation-reports`, `POST /api/evaluations/actions` | `Technical Evaluation`, `Financial Evaluation`, `Evaluation Report` | implemented | Evaluation workflow movement is explicit |
| `tenders_board_review` | Board-routed approval path | `procurement_workflow.evaluation_reports`, `procurement_workflow.workflow_instances`, `procurement_workflow.approval_thresholds` | evaluation action endpoints, workflow action endpoints | `Tenders Board Approval`, audit and tracking views | implemented | Runtime path exists through evaluation escalation and board action grants |
| `accounting_officer_review` | CGIS approval path | `procurement_workflow.workflow_instances`, `procurement_workflow.approval_thresholds`, `procurement_workflow.requisitions` | `POST /api/cgis-approval/approve`, `reject`, `return`, `escalate` | `CGIS Approval` | implemented | Direct executive approval flow is implemented |
| `bpp_no_objection` | BPP prior review path | `procurement_workflow.bpp_no_objections`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/bpp-no-objections` | `BPP Escalation` | implemented | Dedicated entity and runtime sync exist |
| `award_and_publication` | Tender award and contract award publication | `post_award.contract_awards`, `vendor_sourcing.tenders`, `procurement_workflow.workflow_instances` | `GET /api/contracts/awards`, `POST /api/contracts/awards/{awardId}/publish`, CGIS approval endpoints | `Contract Award` | implemented | Award publication is runtime-backed and linked to approval completion |
| `contract_execution` | Active contract management | `post_award.contracts`, `post_award.contract_milestones`, `procurement_workflow.workflow_instances` | `GET /api/contracts`, `POST /api/contracts/{contractId}/milestones` | `Contract Management` | implemented | Milestone logging updates workflow state |
| `inspection_and_payment` | Inspection and payment readiness | `post_award.inspections`, `post_award.contracts`, `procurement_workflow.workflow_instances` | `GET/PUT /api/inspections`, `GET/POST /api/payments` | `Inspection Acceptance`, `Payment Tracking` | implemented | Inspection and payment actions both sync workflow state |
| `closeout_and_audit` | Closeout archive | `procurement_workflow.procurement_closeouts`, `procurement_workflow.workflow_instances` | `POST /api/audit/closeouts` | audit dashboard, payment tracking closeout flow | implemented | Transition enforcement and closeout creation are implemented |
| `administrative_review` | Complaint branch | `procurement_workflow.procurement_complaints`, `procurement_workflow.workflow_instances` | `GET/POST/PUT /api/administrative-reviews` | `AdministrativeReviewModule` | implemented | Filing, resolution, and parent workflow re-entry are implemented |

## Coverage Summary

- `implemented`: 15
- `partial`: 5
- `missing`: 0

## Early-Stage Status Mapping

The current requisition implementation realizes the early blueprint stages using the following status mapping:

- `Draft` -> `department_need_capture`
- `Submitted` -> `department_head_endorsement`
- `Endorsed` -> `budget_allocation_and_confirmation`
- `Initial` -> `comptroller_procurement_review`
- `Under Review` -> `planning_committee_review`

This mapping is the authoritative interpretation for the current project implementation.

## Immediate Engineering Conclusions

1. The workflow runtime carrier is now implemented and actively used across planning, tendering, approvals, complaints, and post-award modules.
2. The strongest implementation coverage begins at `planning_committee_review` and continues through post-award and closeout.
3. The weakest area remains the early requisition planning chain, where several blueprint stages are still represented primarily through coarse status values rather than stage-specific actions.
4. `budget_allocation_and_confirmation` is intentionally documented as a merged implementation stage in the current blueprint and matrix.
