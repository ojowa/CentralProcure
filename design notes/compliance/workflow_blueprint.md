# PPA 2007 Holistic Workflow Blueprint

This note documents the unified internal workflow for the CentralProcure platform based on the Public Procurement Act, 2007 as captured in [PPA2007.md](./PPA2007.md). It is intended to be the design source for:

- the BPMN-style process flow
- the backend workflow state machine
- the workflow database model
- the role-to-task matrix used by the internal portal

## Statutory Basis

The workflow is primarily derived from:

- `Section 16`: procurement must be based on procurement plans backed by appropriation, available funds, and the required BPP no-objection gate where applicable
- `Section 18`: procurement planning, needs assessment, market survey, costing, aggregation, and budget integration
- `Section 19`: advertisement, observers, evaluation, approvals, debriefing, complaints, BPP no-objection, award publication, and contract execution
- `Section 21`: Procurement Planning Committee
- `Section 22`: Tenders Board
- `Sections 24-43`: procurement methods for goods and works
- `Sections 44-52`: consultant services workflow
- `Section 54`: administrative review and complaints

## Workflow Scope

This blueprint covers three linked layers:

1. `APP layer`
   - annual planning, budgeting, packaging, and APP approval
2. `Threshold control layer`
   - approval route, board review, BPP prior review, and method controls
3. `Procurement execution layer`
   - requisition, solicitation, opening, evaluation, approval, award, contract management, and complaints

## BPMN-Style Flow

The supporting diagram is in [ppa-2007-holistic-workflow.mmd](./diagrams/ppa-2007-holistic-workflow.mmd).

```text
Department Need -> Department Head Endorsement -> Budget Allocation and Confirmation -> Comptroller Procurement Review -> Planning Committee Review -> APP Approval (CGIS)
-> Procurement Initiation -> Threshold Resolution -> Method Validation -> Solicitation
-> Bid Receipt/Opening -> Evaluation -> Tenders Board Review -> CGIS Approval
-> BPP No Objection when required -> Award/Publication -> Contract Execution
-> Inspection/Payment -> Closeout/Audit

Exception branch: Complaint -> CGIS Approval -> BPP Review -> Court
```

## Proposed Backend State Machine

### Phases

1. `app_planning`
2. `threshold_control`
3. `procurement_execution`
4. `post_award`
5. `review_and_oversight`

### Core States

| Sequence | State Key | Phase | Primary Owners | Notes |
| --- | --- | --- | --- | --- |
| 1 | `department_need_capture` | `app_planning` | requisitioning_officer | Department raises yearly need |
| 2 | `department_head_endorsement` | `app_planning` | department_head | Department head endorsement of the need |
| 3 | `budget_allocation_and_confirmation` | `app_planning` | financial_unit_officer | Budget code assignment and budget confirmation are handled together in the current implementation |
| 4 | `comptroller_procurement_review` | `app_planning` | procurement_officer | Comptroller Procurement approval before committee review |
| 5 | `planning_committee_review` | `app_planning` | procurement_officer, planning_statistics_officer, financial_unit_officer, legal_reviewer | Section 21 committee review |
| 6 | `app_approval` | `app_planning` | comptroller_procurement, accounting_officer | Comptroller Procurement forwards the planning committee-approved plan to CGIS for approval before procurement initiation |
| 7 | `procurement_initiation` | `threshold_control` | requisitioning_officer, procurement_officer | Approved APP line moves into execution |
| 8 | `threshold_resolution` | `threshold_control` | procurement_officer, procurement_manager | Determine route, board, and BPP needs |
| 9 | `method_validation` | `threshold_control` | procurement_officer, legal_reviewer | Open bidding default, exceptions justified |
| 10 | `solicitation` | `procurement_execution` | procurement_officer | Advert/invite/EOI/RFP issued |
| 11 | `bid_opening` | `procurement_execution` | procurement_officer, evaluation_committee | Public opening and records |
| 12 | `evaluation` | `procurement_execution` | technical_evaluator, financial_evaluator, evaluation_committee | Objective published criteria only |
| 13 | `tenders_board_review` | `procurement_execution` | tenders_board, tenders_board_secretary | Threshold-based board decision |
| 14 | `accounting_officer_review` | `procurement_execution` | accounting_officer | Statutory accountability gate |
| 15 | `bpp_no_objection` | `procurement_execution` | bpp_liaison, bpp_reviewer | Prior review path where required |
| 16 | `award_and_publication` | `post_award` | procurement_officer, procurement_manager | Award notice and debriefing |
| 17 | `contract_execution` | `post_award` | contract_manager, procurement_officer | Performance guarantee, mobilisation, milestones |
| 18 | `inspection_and_payment` | `post_award` | inspection_officer, payment_officer | Acceptance and payment controls |
| 19 | `closeout_and_audit` | `review_and_oversight` | audit_oversight, admin | Completion, archive, audit trail |
| 20 | `administrative_review` | `review_and_oversight` | complaints_review_officer, accounting_officer, bpp_reviewer | Section 54 complaint branch |

### Transition Rules

| From | To | Condition |
| --- | --- | --- |
| `department_need_capture` | `department_head_endorsement` | Requisition officer submits departmental need |
| `department_head_endorsement` | `budget_allocation_and_confirmation` | Department head endorsement completed |
| `budget_allocation_and_confirmation` | `comptroller_procurement_review` | Budget allocation and confirmation completed |
| `comptroller_procurement_review` | `planning_committee_review` | Comptroller Procurement approves for committee review |
| `planning_committee_review` | `app_approval` | Planning Committee finalizes the plan and Comptroller Procurement forwards it to CGIS for approval |
| `app_approval` | `procurement_initiation` | CGIS approves the plan and procurement may now be initiated |
| `procurement_initiation` | `threshold_resolution` | Requisition or procurement request created |
| `threshold_resolution` | `method_validation` | Threshold and route resolved |
| `method_validation` | `solicitation` | Method is lawful and approved |
| `solicitation` | `bid_opening` | Submission deadline reached |
| `bid_opening` | `evaluation` | Opening minutes completed |
| `evaluation` | `tenders_board_review` | Evaluation report submitted |
| `tenders_board_review` | `accounting_officer_review` | Board escalation or accounting officer gate required |
| `tenders_board_review` | `award_and_publication` | Board approval is sufficient within threshold |
| `accounting_officer_review` | `bpp_no_objection` | Prior review threshold requires BPP |
| `accounting_officer_review` | `award_and_publication` | BPP prior review not required |
| `bpp_no_objection` | `award_and_publication` | No-objection issued |
| `award_and_publication` | `contract_execution` | Contract signed |
| `contract_execution` | `inspection_and_payment` | Delivery/milestone reached |
| `inspection_and_payment` | `closeout_and_audit` | Final acceptance and payment complete |
| `solicitation` | `administrative_review` | Complaint filed |
| `evaluation` | `administrative_review` | Complaint filed |
| `award_and_publication` | `administrative_review` | Complaint filed |

## Database Model

### Existing Operational Tables

- `procurement_workflow.procurement_plans`
- `procurement_workflow.procurement_plan_items`
- `procurement_workflow.approval_thresholds`
- `procurement_workflow.requisitions`
- `procurement_workflow.requisition_line_items`
- `procurement_workflow.tenders`
- `procurement_workflow.bid_opening_sessions`
- `procurement_workflow.evaluation_reports`
- `procurement_workflow.bpp_no_objections`
- `procurement_workflow.contract_awards`
- `procurement_workflow.contracts`
- `procurement_workflow.inspections`
- `procurement_workflow.budget_commitments`

### Added Workflow Blueprint Tables

These tables support explicit workflow configuration and documentation:

1. `procurement_workflow.workflow_stage_catalog`
   - canonical state definitions
2. `procurement_workflow.workflow_stage_transitions`
   - valid state-to-state paths and gate conditions
3. `procurement_workflow.workflow_role_tasks`
   - role-to-stage responsibilities and expected outcomes

This keeps the workflow model explicit instead of hiding it in frontend conditionals.

## Role-to-Task Matrix

| Role | Main Responsibilities |
| --- | --- |
| `requisitioning_officer` | Draft department need, create requisition, track progress |
| `department_head` | Endorse department need and monitor APP readiness |
| `procurement_officer` | Manage APP items, solicitation, opening, award publication |
| `procurement_manager` | Oversee planning, thresholds, route validation, and award readiness |
| `planning_statistics_officer` | Validate demand planning, aggregation, and annual plan coherence |
| `financial_unit_officer` | Confirm appropriation, releases, and affordability |
| `legal_reviewer` | Validate method legality, bid documents, and contract exposure |
| `technical_evaluator` | Technical scoring and compliance review |
| `financial_evaluator` | Commercial review and arithmetic checks |
| `evaluation_committee` | Consolidate technical and financial outputs into recommendation |
| `tenders_board` | Review and decide within threshold authority |
| `tenders_board_secretary` | Prepare board packs, minutes, and decision trace |
| `accounting_officer` | Final accountable decision and escalation for high-value cases |
| `bpp_liaison` | Prepare and submit BPP prior-review packs |
| `bpp_reviewer` | Record BPP queries, no-objection outcomes, and regulatory remarks |
| `contract_manager` | Post-award milestone control and variations |
| `inspection_officer` | Inspection, acceptance, and delivery evidence |
| `payment_officer` | Payment readiness and disbursement tracking |
| `complaints_review_officer` | Administrative review under Section 54 |
| `audit_oversight` | Audit trail, compliance review, and exception monitoring |
| `admin` / `ict_admin` | Policy, workflow configuration, and platform governance |

## Implementation Mapping

The implementation added in this change set should expose:

1. a backend `workflow blueprint` endpoint for the internal portal
2. a role-aware UI module that displays:
   - APP stages
   - threshold bands and approval routes
   - procurement execution states
   - role tasks
   - database tables backing the workflow
3. schema artifacts for the workflow blueprint tables

## Workflow Configuration Console

The admin-facing `Workflow Configuration` module should function as the operational control room for workflow policy, not as a static dashboard card. It should let `Admin` and `System Administrator` users:

- inspect live approval thresholds and BPP-triggered bands
- update workflow stage metadata such as owner, sequence, phase, and statutory reference
- add or remove routing transitions between stages
- maintain the role-to-task responsibility matrix
- refresh configuration from the backend without leaving the workspace

This is implemented through a dedicated backend configuration endpoint and an internal admin console, rather than embedding static configuration text in the UI.

## Design Rules

- `APP controls whether procurement may start`
- `thresholds control who may approve`
- `procurement method controls which process path is legal`
- `BPP no-objection is a conditional gate, not a universal gate`
- `complaints are a suspension/escalation branch, not a normal happy-path stage`
- `role visibility and role actions must come from the backend, not hardcoded frontend aliases`
