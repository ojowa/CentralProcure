# CentralProcure Project TODO

## Current Status (2026-03-15)
The project is currently in the middle of a major **Internal Shell Restructure**.
- **Backend:** Core PPA 2007 workflow modules are implemented and building successfully.
- **Database:** Schema migrations (up to 029) and extensive stored procedures are in place.
- **Frontend:** Transitioning to a modular, role-based "workspace" architecture.

## Immediate Tasks

### 1. Fix Frontend Build Failures
- [x] Resolve TypeScript errors in internal components:
    - [x] `AdministrativeReviewModule.tsx` (snake_case to PascalCase).
    - [x] `BidOpeningModule.tsx` (snake_case to PascalCase).
    - [x] `BppEscalationModule.tsx` (snake_case to PascalCase, Budget fallback).
    - [x] `ContractManagementModule.tsx` (Missing types, snake_case to PascalCase).
    - [x] `EvaluationScoringModule.tsx` (ClosingDate to SubmissionDeadline).
    - [x] `TendersBoardApprovalModule.tsx` (ReportCode in EvaluationReportItem).
    - [x] `InternalShellLayout.tsx` (Duplicate renderer, token/role optionality).
- [x] Verify frontend build with `npm run build` (Succeeded).

### 2. Finalize Internal Shell Restructure
- [x] Integrate and verify components in `InternalShellLayout.tsx`:
    - [x] `ProcurementPlanModule.tsx`
    - [x] `TenderManagementModule.tsx`
    - [x] `EvaluationScoringModule.tsx`
    - [x] `BidOpeningModule.tsx`
    - [x] `ContractManagementModule.tsx`
    - [x] `BppEscalationModule.tsx`
- [x] Ensure role-task mappings are correctly enforced in the UI.
- [x] Update all internal modules to use `PascalCase` for form/request properties to match backend DTOs.
- [x] Corrected `submitAdministrativeReviewDecision` service logic.

### 3. Workflow Verification (Phase 9)
- [ ] Run `scripts/verify-phase9-workflow.ps1` locally.
- [ ] Validate threshold-based routing (Low-value, Board, BPP).
- [ ] Confirm administrative review (complaint) branch logic.
- [ ] Verify post-award closeout readiness.

### 4. Operational Cleanup (Phase 0)
- [ ] Complete the mapping of every operational table/controller to the 18 blueprint states.
- [ ] Identify and fix any hardcoded role checks that bypass the backend action model.

## Future Phases
- [ ] **Phase 7:** Full Post-Award Sequence (Contract -> Inspection -> Payment -> Closeout).
- [ ] **Phase 8:** Audit Trail and Operational Observability (History views, diagnostics).
