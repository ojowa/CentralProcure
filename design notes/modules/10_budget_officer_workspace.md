# Proposal 10: Budget Officer Workspace

## 1. Objective
Define a dedicated `Budget Officer` workspace inside the internal portal for budget confirmation, affordability review, and funding control across APP and requisition stages.

The workspace should let the budget actor:

- review APP and requisition items requiring budget confirmation
- see appropriation, release, commitment, and available balance in one place
- approve, hold, return, or reject items with accountable rationale
- preserve a clear audit trail for financial control decisions

## 2. Naming and Recognition
For distinct business recognition in the UI and documentation, use the name `Budget Officer`.

Current implementation alignment:

- backend role key remains `FinancialUnitOfficer`
- frontend normalized role key remains `financial_unit_officer`
- workflow stage remains `budget_allocation_and_confirmation`
- business-facing label becomes `Budget Officer`

This keeps technical compatibility while giving the role clearer product identity.

## 3. Problem Statement
Budget functionality is currently fragmented.

Current state:

- requisition creation shows an inline budget check
- APP screens capture budget codes and estimated values
- workflow defines a budget-confirmation stage
- there is no dedicated budget workspace for the assigned role

This creates several implementation gaps:

- no unified queue for items awaiting budget review
- no clear decision surface for budget confirmation
- no role-specific budget dashboard
- limited visibility into commitment history and variance
- budget actions are not presented as a first-class workflow responsibility

## 4. Role in the Procurement Process
Within this project, the `Budget Officer` is responsible for the financial gate before APP approval and downstream procurement activation.

Core role responsibilities:

- participate in planning committee review
- confirm appropriation and affordability
- validate funding readiness and releases
- block or return items that are not financially supportable
- record budget decision notes for audit purposes

## 5. Scope

### 5.1 In scope
- `Budget Officer` dashboard and work queue
- APP budget confirmation view
- requisition budget confirmation view
- budget position and variance panels
- decision actions: confirm, hold, return, reject
- budget note capture and audit trail integration
- fiscal-year, department, and budget-code filtering

### 5.2 Out of scope
- full general ledger implementation
- payment disbursement redesign
- external finance-system integration
- budget creation and appropriation authoring UI
- replacing procurement planning or requisition modules

## 6. UX Direction
The workspace should feel operational and decision-oriented, not like a generic form page.

### 6.1 Primary pages
1. `Budget Officer Dashboard`
2. `Budget Confirmation Queue`
3. `Budget Case Detail`
4. `Decision Confirmation`
5. `Decision Receipt / Audit Summary`

### 6.2 Dashboard content
- KPI strip: `Appropriated`, `Released`, `Committed`, `Available`, `Pending Review`, `At Risk`
- queue snapshot by status
- department exposure summary
- top over-allocated or near-limit budget codes
- pending APP items and pending requisitions

### 6.3 Queue content
- reference number
- entity type: `APP Item` or `Requisition`
- department
- budget code
- fiscal year
- requested amount
- available balance
- variance
- current workflow stage
- age in queue
- decision status

### 6.4 Case detail layout
Use a three-zone layout:

- top: executive financial summary
- left: entity details and APP/requisition linkage
- right: decision rail and audit context

Case detail sections:

- `Budget Position`
- `APP Linkage`
- `Request Details`
- `Commitment and Release History`
- `Variance Analysis`
- `Previous Notes`
- `Decision Action Panel`

## 7. Proposed Module and Navigation
Add a dedicated internal module:

- module id: `budget-confirmation`
- title: `Budget Officer Workspace`
- section: `Procurement Planning Committee` or `Financial Control`

Recommended role access:

- primary: `FinancialUnitOfficer`
- optional read-only secondary visibility: `ProcurementManager`, `CGIS`, `AuditOfficer`

## 8. Frontend Implementation Plan

### 8.1 New components
- `BudgetOfficerWorkspacePage.tsx`
- `BudgetKpiStrip.tsx`
- `BudgetConfirmationQueue.tsx`
- `BudgetCaseDetailPanel.tsx`
- `BudgetLedgerTimeline.tsx`
- `BudgetDecisionPanel.tsx`

### 8.2 Supporting updates
- extend `InternalShellLayout.tsx` to mount the new module
- add module metadata in internal module data if the frontend keeps a local registry
- add budget workspace styles to `portal.css`
- reuse existing tags, cards, queue patterns, and alert styles

### 8.3 UX behavior
- default view opens the queue
- selecting a row loads case detail without leaving the workspace
- detail panel supports optimistic status refresh after action
- all decisions require notes except a pure confirm when policy allows otherwise

## 9. Backend Implementation Plan

### 9.1 New API endpoints
- `GET /api/budget/confirmations`
- `GET /api/budget/confirmations/{entityType}/{entityId}`
- `POST /api/budget/confirmations/{entityType}/{entityId}/decision`
- `GET /api/budget/ledger/{budgetCode}`
- `GET /api/budget/dashboard`

### 9.2 Expected backend capabilities
- fetch queue for budget-review items
- resolve current budget position by code, department, and fiscal year
- return APP/requisition context with workflow stage
- store decision note, actor, timestamp, and next status
- enforce role and workflow action checks for `budget.confirm`

## 10. Database and Workflow Work

### 10.1 Data requirements
- queue query across APP items and requisitions in budget-related states
- budget ledger summary by budget code
- release and commitment history query
- decision history records

### 10.2 Workflow alignment
Preserve the existing workflow key:

- stage: `budget_allocation_and_confirmation`
- actor key: `financial_unit_officer`

But expose it in UI copy as:

- stage label: `Budget Confirmation`
- actor label: `Budget Officer`

### 10.3 Recommended migration work
- add read models or views for budget queue aggregation
- add decision logging procedure if not already covered by workflow runtime history
- add any missing indexes on budget code, fiscal year, department, and workflow stage

## 11. Delivery Phases

### Phase 1: Read-only visibility
- add module shell
- add dashboard KPIs
- add queue view
- add detail panel with budget position and linkage

### Phase 2: Decision workflow
- add confirm, hold, return, and reject actions
- write notes to workflow history
- refresh queue and detail state after action

### Phase 3: Ledger insight
- add commitment and release timeline
- add variance trend and department exposure panels
- add export for queue and decision summary

### Phase 4: Naming consolidation
- update visible role labels to `Budget Officer`
- keep technical role keys unchanged unless a deliberate auth migration is approved

## 12. Acceptance Criteria
- `FinancialUnitOfficer` users see the module labeled `Budget Officer Workspace`
- users can load a queue of items awaiting budget confirmation
- selecting an item shows request, APP, and budget context together
- users can record a budget decision with note and audit traceability
- queue and detail views reflect updated workflow state after action
- no existing requisition or APP flow is broken by the new workspace

## 13. Risks and Controls
- Risk: business naming diverges from technical role keys
  Control: keep explicit mapping in UI and documentation

- Risk: budget data is available only as summary, not ledger detail
  Control: deliver read-only summary first, then add ledger endpoints

- Risk: overlapping authority with procurement or accounting roles
  Control: restrict decision actions to the mapped budget workflow action

- Risk: queue logic becomes inconsistent across APP and requisition entities
  Control: create a single backend aggregation model for budget-review work items

## 14. Recommended Next Step
Implement Phase 1 first:

- add the `budget-confirmation` module
- present the role in the UI as `Budget Officer`
- build a read-only queue and detail workspace on top of existing budget summary data

That provides immediate role recognition and a clean foundation for decision actions in Phase 2.
