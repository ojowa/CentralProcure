# CGIS Approval Consolidated Design Document
## Electronic Procurement System - Nigeria Immigration Service (NIS)

---

## Purpose

This document consolidates the CGIS approval proposal, wireframe definition, and implementation checklist into one reference.

It is intended for:

- product and compliance review
- stakeholder approval
- frontend and backend implementation
- QA and verification planning

This document consolidates the following source notes:

- [09_cgis_approval_workspace.md](./modules/09_cgis_approval_workspace.md)
- [cgis_approval_wireframes.md](./ui-ux/cgis_approval_wireframes.md)
- [cgis_approval_implementation_checklist.md](./compliance/cgis_approval_implementation_checklist.md)

---

## 1. Executive Summary

The system should not create a separate CGIS portal.

Instead, it should implement a dedicated `CGIS Approval` workspace inside the existing internal role-based portal for low-value procurements that route to direct executive approval.

The workspace should allow the approving authority to:

- review the recommendation pack quickly
- understand why the case reached `CGIS`
- make a controlled decision
- preserve an audit-grade record

The current workflow model already supports this direction because:

- low-value cases are distinguished as `CGIS Direct Approval`
- the workflow stage is already exposed in business language as `CGIS Approval`
- the internal shell already supports role-based module routing

---

## 2. Objective

Define and implement a `CGIS Approval` workspace that:

- surfaces only cases routed for direct CGIS approval
- provides a decision-ready executive summary
- exposes route diagnostics in plain language
- supports `Approve`, `Reject`, `Return for Clarification`, and controlled `Escalate`
- enforces policy server-side
- records a complete decision trail

---

## 3. Context and Workflow Position

The threshold-routing model already distinguishes:

- `CGIS Direct Approval`
- `NIS Tenders Board Review`
- `NIS Tenders Board + BPP No Objection`

For compatibility, the runtime stage key remains:

- `accounting_officer_review`

But the user-facing label should remain:

- `CGIS Approval`

Low-value route:

- `Evaluation -> CGIS Approval -> Award and Publication`

This makes CGIS an internal approval actor and stage, not a separate product surface.

---

## 4. Problem Statement

Without a dedicated CGIS workspace:

- executive users must work through generic approval screens
- route logic may be unclear
- decision rationale can be inconsistent
- audit history may be present but not decision-ready
- operational and executive actions may be mixed together

The CGIS actor needs a simpler, read-mostly decision environment.

---

## 5. Users and Roles

### 5.1 Primary actor
- `CGIS` executive approver

### 5.2 Current implementation mapping
Until a dedicated `CGIS` role exists, the workspace can remain mapped to the current `AccountingOfficer` approval slot and be labeled as `CGIS Approval` in the UI.

### 5.3 Supporting users
- `ProcurementOfficer`
- `ProcurementManager`
- `TechnicalEvaluator`
- `FinancialEvaluator`
- `TendersBoardSecretary`
- `AuditOfficer`
- `BPPLiaison`
- `ComplaintsReviewOfficer`
- `Admin`
- `SystemAdministrator`

These users may inspect, support, or audit the case, but they should not perform the executive decision unless explicitly authorized.

---

## 6. Scope

### In scope
- CGIS queue
- case detail workspace
- route diagnostics
- decision actions
- mandatory rationale capture
- documents and audit trail
- decision receipt
- notifications and downstream visibility

### Out of scope
- separate CGIS portal
- editing tender or evaluation records in the executive workspace
- board quorum management
- redesign of BPP integration
- mobile-native application

---

## 7. Design Principles

- `Decision-first`: recommendation and route explanation come before raw records.
- `Low cognitive load`: fewer clicks, less noise, limited actions.
- `Policy-visible`: threshold basis and approval authority must be obvious.
- `Traceable`: every action must be fully auditable.
- `Read-mostly`: the executive should review and decide, not rework operational data.

---

## 8. Information Architecture

### Portal placement
- `Internal Dashboard`
  - `CGIS Approval`
    - `CGIS Queue`
    - `CGIS Case Detail`
    - `Decision Confirmation`
    - `Decision Receipt`

### Related modules
- `Tenders Board Approval`
- `BPP Escalation`
- `Audit Dashboard`
- `Workflow Diagnostics`

---

## 9. UX Map

### 9.1 Screen 1: CGIS Queue

Purpose:
- show all procurement cases awaiting direct CGIS approval

Main sections:
- page header
- summary cards
- filter bar
- queue table
- inline actions

Summary cards:
- `Pending Decisions`
- `Due Today`
- `Average Decision Time`
- `Returned for Clarification`
- `Approved This Week`

Queue columns:
- case reference
- title
- department
- selected vendor
- amount
- route
- recommendation
- days pending
- risk flags
- actions

Filters:
- case reference
- department
- amount band
- procurement method
- risk level
- status
- date

Queue actions:
- `Open`
- `Flag for Follow-up`
- `Export`

Empty state:
- `No cases are currently awaiting CGIS approval.`

### 9.2 Sccoreen 2: CGIS Case Detail

Purpose:
- present one case in a decision-ready layout

Desktop layout:
- left column: executive summary and recommendation
- right column: documents, diagnostics, audit, and decision controls

Sections:

#### A. Case Header
- case reference
- title
- current stage
- department
- submission date
- pending duration
- route badge

Utility actions:
- `Print Brief`
- `Download Pack`
- `Open Audit History`

#### B. Executive Brief
- procurement purpose
- selected vendor
- recommended amount
- budget source
- procurement method
- delivery timeline
- short executive summary

#### C. Why This Reached CGIS
- threshold band matched
- approval authority label
- requires CGIS approval
- requires board review
- requires BPP prior review
- workflow note

#### D. Recommendation Snapshot
- evaluator recommendation
- procurement recommendation
- compliant bidders
- best-evaluated vendor
- price comparison summary
- reasons for recommendation

#### E. Compliance and Risk Checklist
- APP linkage confirmed
- budget availability confirmed
- legal review completed
- financial validation completed
- vendor compliance pack complete
- complaint pending
- exceptional approval note present

Statuses:
- `Pass`
- `Attention Required`
- `Not Applicable`

#### F. Supporting Pack
Tabs:
- `Evaluation Report`
- `Bid Opening Record`
- `Tender Summary`
- `Vendor File`
- `Internal Notes`
- `Award Draft`

#### G. Audit Trail
- stage transitions
- actor
- role
- action
- date and time
- note
- route diagnostics at movement time

#### H. Sticky Decision Panel
- current action eligibility
- allowed actions
- next-step preview
- rationale input

Primary actions:
- `Approve`
- `Reject`
- `Return for Clarification`
- `Escalate`

### 9.3 Screen 3: Decision Confirmation

Purpose:
- prevent accidental high-impact decisions

Required content:
- selected action
- mandatory rationale
- optional condition note
- next-stage preview
- confirmation controls

### 9.4 Screen 4: Decision Receipt

Purpose:
- provide a final summary of the decision outcome

Content:
- decision result
- actor
- role label
- timestamp
- rationale
- next workflow stage
- audit reference id

Actions:
- `Return to Queue`
- `View Audit History`
- `Download Decision Receipt`

---

## 10. UX States

The UI must support:

- loading state
- empty state
- error state
- access denied state
- already decided state

Responsive guidance:

- desktop-first
- tablet should stack the same content blocks
- mobile may remain read-only if executive approval on mobile is considered risky

---

## 11. Decision Actions

### Approve
Use when the route validly requires direct CGIS approval.

Result:
- record the approval
- move to `award_and_publication`
- persist decision metadata

### Reject
Use when the case should not proceed.

Requirements:
- mandatory rationale

Result:
- follow the configured rejection path
- notify relevant operational actors

### Return for Clarification
Use when the case may still proceed but requires more information.

Examples:
- incomplete memo
- route inconsistency
- unclear recommendation basis

Result:
- return to the correct operational stage
- record return note

### Escalate
Use only where policy allows exceptional routing.

Examples:
- route anomaly
- governance concern
- need for board or BPP consideration

Result:
- move to valid escalation stage
- record explicit override rationale

---

## 12. Required UI Data Contract

The detail page payload should expose the following groups:

### Case summary
- case id
- reference number
- title
- department
- method
- amount
- vendor
- created date
- pending since

### Route diagnostics
- approval route
- approval authority code
- approval authority label
- requires CGIS approval
- requires board
- requires BPP
- governance body name if applicable
- threshold note

### Recommendation details
- evaluator recommendation
- financial recommendation
- procurement recommendation
- selected vendor and score basis

### Compliance indicators
- APP linked
- budget confirmed
- legal review completed
- financial controls completed
- complaints open
- documentation complete

### Documents
- evaluation report
- bid opening summary
- vendor file
- approval memo
- award draft

### Audit metadata
- event id
- action by
- action role
- action at
- action note

### Allowed actions
- approve
- reject
- return
- escalate

The frontend must render only what the backend grants.

---

## 13. Backend Expectations

### Read endpoints
- queue endpoint for records at CGIS approval stage
- case detail endpoint
- audit history endpoint
- document metadata endpoint

### Write endpoints
- submit approval
- submit rejection
- return for clarification
- escalate

### Required server-side checks
- current stage is valid
- route requires CGIS approval where applicable
- user has decision authority
- action is allowed for current record state
- rationale is present
- next stage is valid

---

## 14. Permission Model

### Decision authority
Only the executive approval actor should submit decision actions.

### Read-only visibility
Read-only visibility may be granted to:

- `AuditOfficer`
- `Admin`
- `SystemAdministrator`
- `ProcurementManager`
- other explicitly approved oversight actors

### Operational editing restrictions
CGIS users should not:

- edit tender setup
- edit evaluation scores
- edit vendor data
- edit threshold configuration from the workspace

---

## 15. Audit and Compliance Requirements

Every decision must capture:

- actor identity
- displayed role
- decision type
- rationale
- timestamp
- originating route decision
- previous stage
- next stage
- case reference

The audit trail must be usable both as:

- a human decision history
- a machine-verifiable workflow record

---

## 16. Notifications

On approval:
- `ProcurementOfficer`
- `ProcurementManager`
- `ContractManager` when downstream work begins

On return:
- procurement owner
- evaluator where clarification is needed

On rejection:
- procurement owner
- oversight actors where policy requires

On escalation:
- target authority
- procurement owner
- audit observers

---

## 17. Security Considerations

- shorter session timeout for executive action flows
- CSRF and strong auth validation
- deliberate confirmation friction before final decision
- secure document access
- idempotent write behavior where possible

---

## 18. Reporting and Analytics

The module should support:

- total CGIS-routed cases
- approval turnaround time
- return rate
- rejection rate
- escalation rate
- department distribution
- threshold-band distribution

---

## 19. Implementation Plan

### Phase 0: Scope and Model Alignment
Tasks:
- [ ] confirm role mapping for current CGIS actor
- [ ] decide module identity and naming
- [ ] confirm valid decision actions
- [ ] define rejection and return destinations
- [ ] decide mobile policy

### Phase 1: Backend Read Model
Tasks:
- [ ] add queue query for `accounting_officer_review`
- [ ] include route diagnostics in queue payload
- [ ] define decision-ready case detail DTO
- [ ] include allowed actions and next-stage preview
- [ ] use business labels in payloads

### Phase 2: Backend Policy and Action Endpoints
Tasks:
- [ ] add or confirm action names
- [ ] implement approval endpoint
- [ ] implement rejection endpoint
- [ ] implement return endpoint
- [ ] implement escalation endpoint
- [ ] enforce mandatory rationale
- [ ] validate stage and route
- [ ] persist audit metadata

### Phase 3: Internal Module Registration
Tasks:
- [ ] add `CGIS Approval` module to internal catalog
- [ ] assign current allowed roles
- [ ] map action set
- [ ] place it correctly among approval modules
- [ ] hide it from unauthorized users

### Phase 4: Frontend Queue Screen
Tasks:
- [ ] add queue route
- [ ] render summary cards
- [ ] render filters and search
- [ ] render queue table
- [ ] support loading, empty, and error states
- [ ] link rows to detail page

### Phase 5: Frontend Case Detail
Tasks:
- [ ] render case header
- [ ] render executive brief
- [ ] render route explanation
- [ ] render recommendation snapshot
- [ ] render compliance checklist
- [ ] render supporting pack
- [ ] render audit timeline
- [ ] render sticky decision panel

### Phase 6: Confirmation and Receipt
Tasks:
- [ ] implement confirmation modal
- [ ] require rationale
- [ ] show next-stage preview
- [ ] render success and failure outcomes
- [ ] render decision receipt

### Phase 7: Notifications and Downstream Visibility
Tasks:
- [ ] define notification targets
- [ ] trigger notifications on all decision outcomes
- [ ] ensure downstream views reflect new state

### Phase 8: Audit and Observability
Tasks:
- [ ] log actor, action, rationale, and route diagnostics
- [ ] expose decision in audit history
- [ ] make final outcome visible in audit dashboards
- [ ] expose failure diagnostics
- [ ] verify idempotency behavior

### Phase 9: Seed Data and Demo Coverage
Tasks:
- [ ] seed at least one low-value case awaiting CGIS approval
- [ ] seed one approved case
- [ ] seed one returned-for-clarification case
- [ ] ensure complete supporting pack for at least one demo case
- [ ] verify threshold alignment

### Phase 10: End-to-End Verification
Tasks:
- [ ] verify only low-value cases appear in the queue
- [ ] verify board and BPP cases do not appear
- [ ] verify approval advances to `award_and_publication`
- [ ] verify rejection path
- [ ] verify return path
- [ ] verify escalation policy enforcement
- [ ] verify mandatory rationale
- [ ] verify unauthorized API denial
- [ ] verify audit history output

---

## 20. Acceptance Criteria

- a low-value procurement routed to direct CGIS approval appears in the queue
- the case detail clearly explains why board and BPP review are not required
- the approver can review summary, documents, and audit trail in one workspace
- every decision requires a rationale
- approval moves the record to the correct next stage
- invalid actions are blocked by backend policy
- the final decision is visible in audit history

---

## 21. Future Enhancements

- dedicated `CGIS` identity role
- delegated approval for acting executive
- printable executive memo pack
- digitally signed decision receipt
- aging and urgent case widgets
- side-by-side operational recommendation versus executive decision comparison

---

## 22. Recommendation

Implement `CGIS Approval` as a focused internal module, not as a separate product surface.

That approach:

- aligns with the current workflow model
- preserves the shared internal shell
- keeps permissions centralized
- reduces implementation risk
- gives CGIS a cleaner executive decision experience

---

## 23. Related Documents

- [09_cgis_approval_workspace.md](./modules/09_cgis_approval_workspace.md)
- [cgis_approval_wireframes.md](./ui-ux/cgis_approval_wireframes.md)
- [cgis_approval_implementation_checklist.md](./compliance/cgis_approval_implementation_checklist.md)
