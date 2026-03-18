# CGIS Approval Implementation Checklist

This file is the execution checklist for implementing the `CGIS Approval` workspace described in:

- [09_cgis_approval_workspace.md](../modules/09_cgis_approval_workspace.md)
- [cgis_approval_wireframes.md](../ui-ux/cgis_approval_wireframes.md)

It is intentionally execution-focused:

- each phase should produce code, schema, or verification evidence
- backend policy remains the source of truth
- frontend work is only complete when driven by backend-issued state and actions

## Current Snapshot

What already exists in the repo:

- threshold routing distinguishes `CGIS Direct Approval`, board review, and BPP prior review
- the workflow stage label is already exposed as `CGIS Approval` while keeping compatibility with `accounting_officer_review`
- internal shell routing already supports role-based module rendering
- approval-oriented modules already exist for board and BPP flows
- threshold diagnostics and workflow audit visibility already exist in multiple parts of the internal portal

What is still missing for a complete CGIS workspace:

- a dedicated internal module entry for `CGIS Approval`
- a queue endpoint focused on CGIS-routed cases
- a decision-ready detail payload tailored to executive review
- backend-issued action set for approve, reject, return, and controlled escalation
- a final decision receipt flow specific to CGIS actions

## Rules

- backend policy and workflow state are the source of truth
- the UI must render only actions granted by backend
- approval submission requires mandatory rationale
- route diagnostics must be visible in the UI and validated on the server
- executive review must remain read-mostly

## Phase 0: Scope and Model Alignment

Goal:
- define exactly how `CGIS Approval` fits the current role and workflow model

Tasks:
- [x] confirm whether the current `AccountingOfficer` role remains the effective CGIS actor for now
- [x] decide whether `CGIS Approval` should appear as a new internal module id or as a relabel of an existing approval module
- [x] confirm which actions are valid in the CGIS stage: approve, reject, return, escalate
- [x] define the exact rejection and return workflow destinations
- [x] define whether mobile read-only or mobile approval is acceptable

Deliverable:
- agreed module and policy contract for CGIS approval

Acceptance:
- product, workflow, and engineering all agree on one authoritative CGIS action model

## Phase 1: Backend Read Model

Goal:
- expose all data needed to render the queue and detail screens

Tasks:
- [x] define queue query for records currently at `accounting_officer_review`
- [x] include threshold diagnostics in the queue response
- [x] define case detail DTO with executive brief, recommendation, compliance flags, documents, and audit summary
- [x] ensure the payload includes allowed actions and next-stage preview
- [x] ensure the payload uses business labels such as `CGIS Approval` instead of internal-only workflow naming

Deliverable:
- queue and detail read endpoints for CGIS approval

Acceptance:
- the frontend can render the queue and detail pages without extra role-based guesswork

## Phase 2: Backend Policy and Action Endpoints

Goal:
- allow only valid CGIS decisions and block all invalid workflow actions

Tasks:
- [x] add or confirm action names for CGIS stage decisions
- [x] implement action endpoint for approval
- [x] implement action endpoint for rejection
- [x] implement action endpoint for return for clarification
- [x] implement controlled escalation endpoint
- [x] enforce mandatory rationale on every decision
- [x] validate current workflow stage before any write
- [x] validate that the active threshold route really requires direct CGIS approval where applicable
- [x] persist audit-grade metadata for each decision

Deliverable:
- policy-enforced decision endpoints for CGIS approval

Acceptance:
- invalid or stale-stage decisions are rejected by backend validation

## Phase 3: Internal Module Registration

Goal:
- register CGIS approval as a first-class internal module in the portal

Tasks:
- [x] add module definition for `CGIS Approval` in the internal module catalog
- [x] assign allowed roles for current implementation
- [x] map the module to the correct action set
- [x] decide how it appears alongside board and BPP modules
- [x] ensure non-authorized roles do not see the module

Deliverable:
- internal module visibility and action issuance for CGIS users

Acceptance:
- a user with CGIS decision authority sees the module and other users do not

## Phase 4: Frontend Queue Screen

Goal:
- implement the CGIS queue page from the wireframe spec

Tasks:
- [x] add queue route in the internal dashboard shell
- [x] render summary cards
- [x] render filter bar and search
- [x] render queue table with aging and risk indicators
- [x] support empty, loading, and error states
- [x] add navigation from queue row to case detail

Deliverable:
- usable queue page for executive approval cases

Acceptance:
- seeded low-value cases routed to CGIS appear correctly in the queue

## Phase 5: Frontend Case Detail Screen

Goal:
- implement a decision-ready case detail screen

Tasks:
- [x] render case header with route badge
- [x] render executive brief card
- [x] render `Why this case reached CGIS` block
- [x] render recommendation snapshot (Recommended Vendor card)
- [x] render compliance and risk checklist (Document Pack)
- [x] render supporting pack tabs or panels (CgisDocumentsPanel)
- [ ] render audit timeline (History exists in DB but not yet explicitly in this view's detail DTO)
- [x] render sticky decision panel

Deliverable:
- case detail page aligned to the executive review wireframe

Acceptance:
- the approver can understand the case, route, recommendation, and risk state from one page

## Phase 6: Decision Confirmation and Receipt

Goal:
- complete the approval interaction flow safely

Tasks:
- [x] implement confirmation modal before final submission
- [x] require rationale text before submission
- [x] show next-stage preview before confirmation
- [x] implement success and failure handling
- [ ] render a decision receipt page or success panel with audit reference (Handled by success message for now)

Deliverable:
- complete decision flow from review to persisted outcome

Acceptance:
- every decision ends with a visible, traceable result

## Phase 7: Notifications and Downstream Visibility

Goal:
- make CGIS decisions visible to the correct downstream actors

Tasks:
- [x] define notification targets for approval
- [x] define notification targets for rejection
- [x] define notification targets for return for clarification
- [x] define notification targets for escalation
- [x] ensure downstream modules reflect the new workflow state after decision (Award auto-creation implemented)

Deliverable:
- downstream operational awareness after executive action

Acceptance:
- procurement actors can see the decision outcome without direct database inspection

## Phase 8: Audit and Observability

Goal:
- ensure CGIS actions are defensible during review and investigation

Tasks:
- [x] log actor, role, action, rationale, timestamp, and route diagnostics
- [x] include decision records in audit history endpoints
- [x] make the final decision visible in audit dashboards
- [x] expose failure diagnostics for invalid or blocked approval attempts
- [x] confirm that repeated submissions do not create inconsistent workflow movement

Deliverable:
- audit-grade traceability for CGIS decisions

Acceptance:
- any CGIS action can be reconstructed from persisted records and audit views

## Phase 9: Seed Data and Demo Coverage

Goal:
- ensure the workspace can be demonstrated and tested with realistic data

Tasks:
- [x] add or confirm at least one seeded low-value case currently awaiting CGIS approval
- [x] add or confirm a case already approved by CGIS
- [x] add or confirm a case returned for clarification
- [x] ensure queue and detail views include complete supporting pack data for at least one scenario
- [x] ensure the seeded decision path matches threshold rules

Deliverable:
- repeatable demo and QA data for the CGIS module

Acceptance:
- the module can be verified locally from seeded data without manual DB repair

## Phase 10: End-to-End Verification

Goal:
- prove that the CGIS workspace behaves correctly across policy, UI, and workflow transition layers

Tasks:
- [x] verify only low-value cases route into the CGIS queue
- [x] verify board-routed and BPP-routed cases do not appear in the CGIS queue
- [x] verify approval advances to `award_and_publication`
- [x] verify rejection follows the configured rejection path
- [x] verify return for clarification moves to the correct operational stage
- [x] verify escalation is blocked unless policy allows it
- [x] verify rationale is mandatory for every action
- [x] verify unauthorized users cannot call the action endpoints directly
- [x] verify audit history shows the exact CGIS decision event (PowerShell verification script provided)

Deliverable:
- repeatable test checklist and verification evidence

Acceptance:
- CGIS approval behavior is proven by execution, not just by screen rendering

## Implementation Notes by Layer

### Backend
- workflow action issuance
- queue and detail queries
- decision endpoints
- transition and policy validation
- audit logging

### Frontend
- module registration
- queue screen
- detail screen
- confirmation modal
- decision receipt
- loading, empty, and error states

### Data and Schema
- confirm route diagnostics availability
- confirm audit fields are sufficient
- confirm seeded low-value scenario coverage

### QA
- seeded scenario verification
- permission tests
- stale-state tests
- route-accuracy tests

## Suggested Execution Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9
11. Phase 10

## Immediate Next Step

Start with a hard implementation decision on role mapping and module identity:

- either keep `AccountingOfficer` as the effective CGIS actor and introduce a new UI module label
- or add a dedicated `CGIS` role and map it to the same stage with clearer executive semantics

The first option is lower risk and matches the current codebase more closely.

## Done Definition

`CGIS Approval` is done when:

- the correct actor sees a dedicated module in the internal portal
- low-value routed cases appear in the queue
- the case detail screen clearly explains why the case reached CGIS
- the actor can approve, reject, return, or escalate only when policy allows
- every decision captures a rationale and produces an audit-grade record
- the next workflow stage updates correctly and is visible to downstream users
