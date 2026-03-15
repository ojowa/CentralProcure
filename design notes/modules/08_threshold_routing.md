# Proposal 8: CGIS, DCG Board, and BPP Threshold Routing

## 1. Objective
Align threshold-based procurement routing with the real NIS approval structure:

- low-value cases are approved directly by `CGIS`
- board-value cases are decided by the `NIS Tenders Board`
- the board is composed of `DCG` heads of directorates
- high-value cases proceed from board endorsement to `BPP No Objection`

This removes the current mismatch between the real organogram and the generic workflow model.

## 2. Current Gap
The existing project uses only:

- `approval_route`
- `requires_board`
- `requires_bpp`
- a generic `Accounting Officer Review` stage

That model cannot answer key governance questions:

- who is the actual approving authority for low-value cases
- which body is responsible for board review
- who sits on that body
- when a case stops at the board versus when it must proceed to BPP

## 3. Proposed Authority Model

### 3.1 Approval bands
- `CGIS Direct Approval`
  - route: `Evaluation -> CGIS Approval -> Award and Publication`
  - used for low-value cases
- `NIS Tenders Board`
  - route: `Evaluation -> Tenders Board Review -> Award and Publication`
  - used for board-final cases
- `NIS Tenders Board + BPP No Objection`
  - route: `Evaluation -> Tenders Board Review -> BPP No Objection -> Award and Publication`
  - used for prior-review cases

### 3.2 Governance structure
- `CGIS`
  - modeled as an executive position under `Comptroller General, NIS`
- `DCG` heads of directorates
  - modeled as positions attached to the directorate units
- `NIS Tenders Board`
  - modeled as a governance body
- board membership
  - seeded from the directorate `DCG` positions
- `Tenders Board Secretary`
  - modeled as a non-voting support position under `Procurement`

## 4. Implementation Proposal

### 4.1 Database model
Add:

- `identity.organizational_positions`
  - stores `CGIS`, `DCG_*`, and secretary positions
- `procurement_workflow.governance_bodies`
  - stores the `NIS_TENDERS_BOARD`
- `procurement_workflow.governance_body_memberships`
  - links the board to its member positions

Extend `procurement_workflow.approval_thresholds` with:

- `approval_authority_code`
- `approval_authority_label`
- `requires_cgis_approval`
- `governance_body_id`

### 4.2 Workflow rules
Keep the stage key `accounting_officer_review` for compatibility, but expose it as `CGIS Approval`.

Route control becomes explicit:

- if `requires_cgis_approval = true`
  - allow `evaluation -> accounting_officer_review`
  - block `evaluation -> tenders_board_review`
- if `requires_board = true` and `requires_bpp = false`
  - allow `evaluation -> tenders_board_review -> award_and_publication`
- if `requires_board = true` and `requires_bpp = true`
  - allow `evaluation -> tenders_board_review -> bpp_no_objection -> award_and_publication`

### 4.3 Admin and user-facing UI
Threshold configuration should show:

- approval authority code
- approval authority label
- governance body
- requires CGIS approval
- requires board
- requires BPP

Requisition routing views and diagnostics should show:

- approval authority
- governance body name
- whether CGIS approval is required
- whether board review is required
- whether BPP prior review is required

## 5. Default NIS Threshold Pattern
The implementation should normalize the threshold model to three authority outcomes:

1. `CGIS Direct Approval`
2. `NIS Tenders Board`
3. `NIS Tenders Board + BPP No Objection`

Where legacy threshold rows already exist, they should be updated into one of those three authority patterns instead of remaining generic.

## 6. Expected Benefits

- routing now reflects the real NIS organogram
- board approval becomes traceable to an actual governance body
- low-value approval is clearly attributable to `CGIS`
- BPP escalation becomes a first-class threshold outcome
- audit, diagnostics, and admin configuration become easier to defend

## 7. Implementation Steps

1. add governance tables and threshold authority columns
2. seed `CGIS`, directorate `DCG` positions, and `NIS Tenders Board`
3. normalize active threshold rows to `CGIS / Board / BPP`
4. update workflow stage titles, transitions, and fallback blueprint text
5. update backend DTOs, controllers, and policy guard logic
6. update frontend configuration and routing views
7. apply the migration and verify with builds and threshold resolution checks
