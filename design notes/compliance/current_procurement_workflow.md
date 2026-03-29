# Current Procurement Workflow

This document summarizes the current procurement workflow implemented in the CentralProcure project. It combines:

- a business-facing summary of the procurement lifecycle
- a technical flowchart of the active system stages
- references to the backend controllers and workflow logic that currently drive the process

## 1. Business Summary

The current procurement workflow is organized around compliance gates. Each step controls who can act, when a record may advance, and what approval route applies under the Public Procurement Act-driven workflow model.

1. A department raises a procurement need through a requisition.
2. The department head endorses the requisition.
3. Budget availability and budget code alignment are confirmed.
4. Comptroller Procurement reviews the requisition before committee consideration.
5. The Planning Committee reviews each requisition.
6. If the committee recommends the requisition, the system creates an APP item from it.
7. Once all linked requisitions are cleared, the APP is recommended for approval.
8. APP approval is then granted, returned, or rejected at the plan level.
9. Only after APP approval can procurement be initiated.
10. The system resolves the approval route based on live thresholds:
    - CGIS-only route
    - Tenders Board route
    - BPP prior-review route
11. A tender is prepared and published.
12. Bids are opened and evaluated.
13. Evaluation outcomes move the case to Tenders Board where required.
14. CGIS and or BPP act depending on the threshold route.
15. Once approved, award is published.
16. The contract moves into execution, inspection, and payment.
17. Complaints can interrupt the normal flow through administrative review.
18. Final payment and closeout complete the process, with workflow history preserved.

In practical terms, the system treats procurement as three linked layers:

- APP planning and approval
- threshold-based approval routing
- tender-to-contract execution and oversight

## 2. Technical Flowchart

```text
[Requisition Created]
  status: Draft
  stage: department_need_capture
        |
        v
[Submitted by Requesting Officer]
  status: Submitted
  stage: department_head_endorsement
        |
        v
[Department Head Endorsement]
  status: Endorsed
  stage: budget_allocation_and_confirmation
        |
        v
[Budget Confirmed]
  status: Initial
  stage: comptroller_procurement_review
        |
        v
[Planning Committee Review]
  status: Under Review
  stage: planning_committee_review
        |
        +------------------------------+
        |                              |
        | Recommended                  | Returned / Rejected
        v                              v
[APP Item Created]               [Back to Department / Stop]
[Requisition status: Approved]
        |
        v
[Plan Recommendation]
  controller: ProcurementPlanRecommendationsController
  next stage: app_approval
        |
        v
[APP Approval Decision]
  controller: ProcurementPlansController
        |
        +------------------------------+
        | Approve                      | Return / Reject
        v                              v
[procurement_initiation]         [Back to planning committee]
        |
        v
[threshold_resolution]
  route resolved from approval_thresholds
        |
        +------------------------------+
        | Low value                    | Board route / High value
        |                              |
        v                              v
[method_validation]               [method_validation]
        |                              |
        v                              v
[solicitation / tender published]
  tender status: Published
        |
        v
[bid_opening]
  tender status: Closed
        |
        v
[evaluation]
        |
        +------------------------------+
        | Recommend / Escalate         | Clarification / non-compliance
        v                              v
[tenders_board_review]            [stay in evaluation / exception handling]
        |
        +------------------------------+
        | Board sufficient             | BPP required
        v                              v
[award_and_publication]           [bpp_no_objection]
        |                              |
        |                              v
        +------------------------> [award_and_publication]
                                       |
                                       v
                               [contract_execution]
                                       |
                                       v
                               [inspection_and_payment]
                                       |
                                       v
                                   [completed]
```

## 3. Current Implementation Notes

### 3.1 Requisition and APP Planning

The canonical workflow blueprint defines the high-level sequence:

`Department Need -> Department Head Endorsement -> Budget Allocation and Confirmation -> Comptroller Procurement Review -> Planning Committee Review -> APP Approval (CGIS) -> Procurement Initiation`

In the live implementation, requisition statuses are mapped into workflow stages as follows:

- `Draft` -> `department_need_capture`
- `Submitted` -> `department_head_endorsement`
- `Endorsed` -> `budget_allocation_and_confirmation`
- `Initial` -> `comptroller_procurement_review`
- `Under Review` -> `planning_committee_review`
- `Approved` -> route-dependent downstream approval stage

Planning Committee finalization currently works like this:

- `Recommended`
  - creates an APP item for the requisition if one does not yet exist
  - sets requisition status to `Approved`
  - keeps the plan in `planning_committee_review`
- `ReturnedToDepartment`
  - sets requisition status to `Draft`
  - sends the workflow back to `department_head_endorsement`
- any other non-recommended outcome
  - sets requisition status to `Rejected`

The APP can only be recommended for approval when all tracked requisitions have a final `Recommended` outcome and corresponding APP items.

### 3.2 APP Approval and Procurement Initiation

After planning committee readiness is satisfied:

- the Procurement Secretary recommends the APP for approval
- the workflow stage becomes `app_approval`
- an approval decision is then taken at the plan level

When approved:

- the plan moves to `procurement_initiation`
- procurement can then be initiated
- the next workflow stage becomes `threshold_resolution`

When returned:

- linked planning committee reviews are reopened
- affected requisitions are reset to `Under Review`
- the plan returns to the planning loop

### 3.3 Threshold Resolution

The approval route is resolved from `procurement_workflow.approval_thresholds` using:

- amount
- procurement type
- route metadata such as:
  - approval route
  - approval authority code
  - approval authority label
  - whether board review is required
  - whether BPP no-objection is required

The workflow policy guard enforces route-specific constraints. For example:

- CGIS direct approval cannot incorrectly follow Tenders Board review
- records that require BPP no-objection cannot move straight to award publication
- records that do not require BPP cannot be forced through that stage

### 3.4 Tender Execution

Tender workflow is currently mapped from tender status like this:

- `Draft` -> `method_validation`
- `Published` -> `solicitation`
- `Closed` -> `bid_opening`
- `Awarded` -> `award_and_publication`

The operational path is:

`method_validation -> solicitation -> bid_opening -> evaluation -> tenders_board_review -> award_and_publication`

Evaluation actions can push a tender into Tenders Board review. In the current implementation:

- `RecommendAward` -> `tenders_board_review`
- `EscalateToBoard` -> `tenders_board_review`

### 3.5 CGIS and BPP Approval

CGIS approval is implemented as explicit workflow actions:

- `approve` -> `award_and_publication`
- `return` -> `evaluation`
- `reject` -> `evaluation`
- `escalate` -> `tenders_board_review`

If CGIS approves a tender into `award_and_publication`, the system also ensures a contract award record exists.

BPP prior review is implemented through explicit `bpp_no_objections` records that:

- can be created against a requisition or tender
- are tracked in the workflow runtime as `bpp_no_objection`
- act as a formal gate before award publication where thresholds require it

### 3.6 Post-Award

After award publication, the project continues into post-award operations:

- contracts run in `contract_execution`
- inspections can move a contract into `inspection_and_payment`
- final payment marks the contract workflow as completed at the `inspection_and_payment` stage with status `Completed`

### 3.7 Complaints and Administrative Review

Administrative review is an exception branch, not part of the normal happy path.

Complaints may only be filed when the parent record is currently in:

- `solicitation`
- `evaluation`
- `award_and_publication`

Once filed, the complaint enters `administrative_review` and is managed separately from the normal procurement progression.

## 4. Key Code References

### Blueprint and design notes

- `design notes/compliance/workflow_blueprint.md`

### Requisition and APP planning

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/RequisitionsController.Workflow.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/PlanningCommitteeWorkspaceController.Finalize.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/ProcurementPlanRecommendationsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/ProcurementPlansController.Workflow.cs`

### Threshold routing and workflow guard

- `Backend/Shared/Workflow/WorkflowPolicyGuard.cs`
- `Backend/Shared/Workflow/WorkflowRuntimeTracker.cs`

### Tender execution

- `Backend/Modules/eProcurement.Modules.VendorSourcing/Controllers/TendersController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/EvaluationsController.cs`

### Approvals

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/CgisApprovalController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/BppNoObjectionsController.cs`

### Post-award and complaints

- `Backend/Modules/eProcurement.Modules.PostAward/Controllers/ContractsController.cs`
- `Backend/Modules/eProcurement.Modules.PostAward/Controllers/InspectionsController.cs`
- `Backend/Modules/eProcurement.Modules.PostAward/Controllers/PaymentsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.Write.cs`
