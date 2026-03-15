# PPA 2007 Implementation TODO

This file is the execution checklist for implementing the workflow described in
[workflow_blueprint.md](./workflow_blueprint.md).

It is intentionally pragmatic:
- each phase has a concrete output
- each checklist item should end in code, schema, or verification
- "done" means enforced by backend behavior, not only shown in UI

## Current Snapshot

What already exists in the repo:
- workflow blueprint catalog in backend
- workflow blueprint endpoint and frontend blueprint module
- workflow configuration console for thresholds, stages, transitions, and role tasks
- core operational modules for requisitions, tenders, bid opening, evaluations, BPP no-objection, contract award, contracts, inspections
- workflow blueprint schema artifacts in [023_procurement_workflow_blueprint_tables.sql](../../database_schema/migrations/023_procurement_workflow_blueprint_tables.sql)
- runtime workflow instance and history tables in [024_workflow_runtime_tracking.sql](../../database_schema/migrations/024_workflow_runtime_tracking.sql)
- complaint and closeout schema artifacts in [025_administrative_reviews_and_closeouts.sql](../../database_schema/migrations/025_administrative_reviews_and_closeouts.sql)
- workflow runtime API plus controller-level transition checks and runtime sync in procurement plan, requisition, tender, BPP no-objection, contract award, and contract milestone flows
- administrative review endpoint support for complaint filing/resolution and governance audit/closeout endpoints
- a repeatable Phase 9 verification pack in [verify-phase9-workflow.ps1](../../scripts/verify-phase9-workflow.ps1) and [phase9_verification.md](./phase9_verification.md)

What is still incomplete:
- explicit runtime enforcement of workflow stage transitions across every operational API
- full backend-issued action gating across all internal modules
- UI integration for complaint review, closeout, and audit views
- consistent local/Render verification that live databases carry all workflow blueprint artifacts

## Status Check (2026-03-14)

Current implementation level by phase:

| Phase | Status | Notes |
| --- | --- | --- |
| 0 | Partial | The codebase now exposes enough modules to build the matrix, but the matrix itself is not yet documented in this file. |
| 1 | Implemented | Blueprint tables, runtime tracking, complaint/closeout migrations, and bootstrap ordering are in place. |
| 2 | Implemented | Live workflow state is persisted through `workflow_instances` and `workflow_instance_history`. |
| 3 | Implemented | Transition validation now covers procurement plan, requisition, tender, evaluation action, BPP no-objection, award publication, contract milestone, inspection update, complaint resolution, and closeout movement. |
| 4 | Implemented | Threshold resolution now drives live route decisions through the shared workflow policy guard, and workflow routing can be queried from backend runtime state. |
| 5 | Implemented | Backend-issued workflow actions are now derived from role-task mappings and used for internal module action issuance plus key workflow-moving API endpoints. |
| 6 | Implemented | Complaint filing, parent workflow suspension into `administrative_review`, resolution branching, and internal administrative review workspace coverage are now in place. |
| 7 | Implemented | Inspection updates, payment readiness visibility, explicit closeout actions, and audit dashboard closeout visibility are now wired into live backend and internal portal flows. |
| 8 | Implemented | Audit history search, per-entity workflow diagnostics, live audit trail views, and compliance reporting now expose runtime history and actionable transition diagnostics without DB inspection. |
| 9 | Implemented | A repeatable verification pack now covers seeded scenario checks for threshold routing, runtime state, complaint action availability, post-award closeout readiness, audit diagnostics, and optional mutation evidence. |

## Rules

- backend state and permissions are the source of truth
- frontend only renders actions already granted by backend
- transitions must be validated server-side
- threshold and BPP gates must influence real workflow movement
- auditability matters as much as happy-path completion

## Phase 0: Baseline Audit

Goal:
- produce a hard gap map between the blueprint and the current codebase

Tasks:
- [ ] inventory every operational table and controller that maps to a blueprint state
- [ ] map each current API to one of the 18 blueprint states
- [ ] identify which states already have data persistence, UI, and backend enforcement
- [ ] identify where state exists only in frontend logic or naming conventions
- [ ] identify all routes where role checks are still hardcoded without backend action alignment

Deliverable:
- a matrix of `state -> table(s) -> controller(s) -> UI module -> enforcement status`

Acceptance:
- every blueprint state is marked `implemented`, `partial`, or `missing`

## Phase 1: Workflow Data Model Hardening

Goal:
- make the workflow blueprint tables complete, seeded, and reliable in every environment

Tasks:
- [ ] verify [023_procurement_workflow_blueprint_tables.sql](../../database_schema/migrations/023_procurement_workflow_blueprint_tables.sql) exactly matches the blueprint note
- [ ] add any missing columns needed for runtime enforcement, ownership, or auditability
- [ ] ensure workflow stage rows, transitions, and role tasks are seeded idempotently
- [ ] ensure `render-bootstrap.sql` includes all required workflow migrations in the correct order
- [ ] confirm local and Render databases both contain the workflow blueprint tables and seed rows

Deliverable:
- stable schema and seed data for workflow stages, transitions, and role tasks

Acceptance:
- a fresh database bootstrap yields all blueprint tables and catalog rows without manual intervention

## Phase 2: Runtime Workflow State Tracking

Goal:
- connect live procurement records to explicit workflow states

Tasks:
- [ ] decide the canonical runtime state carrier for live records
- [ ] add missing state fields or linkage tables for requisitions, tenders, evaluations, awards, contracts, and complaints
- [ ] define how records move from APP planning into procurement execution
- [ ] define how the complaint branch suspends or diverts the normal path
- [ ] define how closeout and audit are marked complete

Deliverable:
- persistent workflow state for live records

Acceptance:
- any active procurement item can be queried for its current blueprint state and valid next transitions

## Phase 3: Backend Transition Enforcement

Goal:
- prevent illegal workflow moves in backend APIs

Tasks:
- [ ] add a workflow transition service that validates `from -> to` against `workflow_stage_transitions`
- [ ] wire transition checks into requisition, tender, evaluation, BPP, award, contract, inspection, and review endpoints
- [ ] enforce threshold-based branching from board review to accounting officer and BPP paths
- [ ] enforce method validation before solicitation
- [ ] enforce contract signing before contract execution
- [ ] enforce inspection/payment completion before closeout

Deliverable:
- server-side transition validation across operational controllers

Acceptance:
- illegal stage movement returns clear backend validation errors
- legal movement updates the runtime workflow state consistently

## Phase 4: Threshold and Approval Route Integration

Goal:
- make approval thresholds drive actual workflow behavior, not just configuration display

Tasks:
- [ ] connect `approval_thresholds` lookup to procurement initiation and route resolution
- [ ] ensure Tenders Board vs Accounting Officer vs BPP routing is decided from live threshold data
- [ ] ensure threshold configuration edits affect subsequent workflow routing
- [ ] add audit fields for threshold resolution decisions on live records

Deliverable:
- threshold-driven approval and escalation path selection

Acceptance:
- the same procurement record follows different valid routes when threshold data changes

## Phase 5: Role-to-Task and Action Enforcement

Goal:
- align all internal module actions with backend-issued permissions

Tasks:
- [ ] audit every internal module for backend action gating
- [ ] remove leftover frontend-only role assumptions
- [ ] ensure role-task catalog is reflected in module action issuance
- [ ] ensure operational endpoints enforce the same action model used by the internal portal
- [ ] add missing actions for complaint review, closeout, and audit modules

Deliverable:
- backend-issued actions consistently control UI and API behavior

Acceptance:
- a role with no granted action cannot trigger the workflow move from UI or direct API call

## Phase 6: Complaint, Suspension, and Review Branch

Goal:
- implement the Section 54 branch as a real workflow path

Tasks:
- [ ] create or complete complaint data model and controller endpoints
- [ ] allow complaints to be filed from solicitation, evaluation, and award states
- [ ] suspend or branch the affected procurement flow when complaint review starts
- [ ] record Accounting Officer and BPP review outcomes where applicable
- [ ] restore or terminate the main flow based on complaint resolution

Deliverable:
- operational administrative review branch

Acceptance:
- complaint initiation and resolution visibly affect the parent procurement workflow state

## Phase 7: Award, Contract, Inspection, Closeout

Goal:
- finish the post-award sequence so it is fully state-driven

Tasks:
- [ ] verify award publication updates workflow state
- [ ] verify contract execution milestones update workflow state
- [ ] verify inspection and payment update workflow state
- [ ] add explicit closeout action and archival step
- [ ] expose closeout/audit visibility in the internal portal

Deliverable:
- complete post-award and closeout flow

Acceptance:
- a procurement item can move from award to closeout with full state traceability

## Phase 8: Audit Trail and Operational Observability

Goal:
- make workflow movement provable and supportable

Tasks:
- [ ] capture state transition audit entries with actor, timestamp, and reason
- [ ] log threshold resolution decisions and BPP gate outcomes
- [ ] add admin/audit views for workflow history per procurement item
- [ ] expose actionable diagnostics for failed workflow transitions

Deliverable:
- audit-grade workflow trace

Acceptance:
- any stage change can be explained from persisted records and logs

## Phase 9: End-to-End Verification

Goal:
- prove the blueprint is implemented in behavior, not only in structure

Tasks:
- [ ] define seed scenarios for low-threshold, board-threshold, and BPP-threshold procurements
- [ ] verify the happy path from APP to closeout
- [ ] verify complaint branch from solicitation, evaluation, and award
- [ ] verify role restrictions across all major stages
- [ ] verify local bootstrap and Render deployment both behave consistently

Deliverable:
- repeatable verification checklist and test evidence

Acceptance:
- all key blueprint branches can be exercised without manual DB repair

## Execution Order

Recommended implementation sequence:
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

## Immediate Next Step

Continue with operational cleanup:
- execute the Phase 9 pack against the active local backend and, when ready, the Render deployment
- commit the current workflow, post-award, audit, and verification artifacts after reviewing any intentionally local-only files
1