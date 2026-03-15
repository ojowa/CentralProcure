# Budget Implementation Gaps And PPA 2007 Guidance

This document summarizes budget-related implementation gaps in the current project and highlights budget-focused guidance from the Public Procurement Act (PPA) 2007.

## Budget Implementation Gaps In The Current Project

1. No budget/appropriation ledger or availability check before a requisition or tender moves forward.
2. Procurement plans are header-only; there is no APP line-item structure or APP-to-requisition validation.
3. Threshold-based approval routing is not implemented (only a `ThresholdNote` exists).
4. Budget utilization/commitment tracking is static in the UI and has no backend computation.
5. BPP “No Objection” flow is referenced by the UI but no backend endpoint exists.

## PPA 2007 Budget-Related Guidance (High-Level)

1. Procurement must be based on procurement plans supported by prior budgetary appropriations; no procurement should be formalized until funds are available.
2. Procurement planning must integrate procurement expenditure into the yearly budget.
3. Procurement implementation requires approval of the approving authority before award and obtaining a “No Objection” certificate within prior review thresholds.
4. The accounting officer must ensure adequate appropriation for procurement, integrate procurement expenditure into the yearly budget, and prevent splitting or value reduction to evade the appropriate procurement method.

## Suggested Implementation Backlog (Optional)

1. Budget Ledger + Availability Checks
   - Table for appropriations, releases, commitments, and expenditures.
   - Stored procedures to reserve/commit budget at requisition and tender stages.
   - API enforcement to block workflow when funds are insufficient.
2. APP Line Items + Validation
   - APP items table linked to procurement plans.
   - Requisitions reference APP items and validate budget code and plan status.
3. Threshold Routing + BPP “No Objection”
   - Threshold table and policy engine.
   - Approvals routing API and BPP escalation endpoint.
4. Real Budget Utilization Metrics
   - Compute utilization from commitments/eCONTINxpenditures.
   - Replace static UI values with live data.

## Needed TODO List

### Backend

1. Confirm PPA 2007 clauses and internal policy sources to support budget controls and “No Objection” thresholds.
2. Define budget data model fields and status transitions (appropriation, release, commitment, expenditure, reversal).
3. Draft workflow rules for budget availability checks at requisition creation, tender initiation, and award.
4. Specify APP line-item structure, required fields, and validation rules linking APP items to requisitions.
5. Define threshold routing matrix, approval roles, and escalation conditions for BPP “No Objection”.
6. Add API endpoints and service methods for availability checks and commitment reservations.
7. Add audit logging requirements for budget holds, releases, and overrides.
8. Write unit and integration tests for budget check enforcement and threshold routing.
9. Create seed data and migration plan for legacy procurement plans and budget codes.

### Frontend

1. Update requisition and tender forms to surface budget availability checks and blocking errors.
2. Add APP line-item selection and validation feedback in requisition creation.
3. Add threshold routing visibility to approvals UI, including “No Objection” status and escalation steps.
4. Replace static utilization figures with live computed metrics and historical drill-downs.
5. Add audit log views for budget holds, releases, overrides, and BPP actions.

## Backend Implementation Scope (Phase 1)

1. Budget ledger foundation (appropriations, releases, commitments, expenditures) with constraints and indices.
2. Budget availability computation by fiscal year, department, and budget code.
3. Budget reservation and release logic tied to requisition status transitions.
4. Backend enforcement to block non-draft requisitions when budget is missing or insufficient.
5. Stored procedures and migration scripts to align with the existing database workflow.

## Recent Backend Update (2026-03-06)
- Build stabilization: added backend-wide global usings for ASP.NET Core types via `Backend/Directory.Build.props`.
- Middleware fixes: explicit usings added to shared middleware to ensure `HttpContext`, `RequestDelegate`, and `ILogger<>` resolve consistently.
- Static web assets build fix: set `PackageId` in `Backend/eProcurement.Api/eProcurement.Api.csproj` to prevent static web assets manifest errors.
- Build command now uses the local SDKs path and bundled versions props to avoid workload resolver and SDK path issues in the sandbox environment.
