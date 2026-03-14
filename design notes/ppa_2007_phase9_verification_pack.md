# Phase 9 Verification Pack

This pack is the repeatable evidence set for the PPA 2007 workflow implementation.

Artifacts:
- [verify-phase9-workflow.ps1](C:\Users\OJOWA\Documents\Project 4\CentralProcure\scripts\verify-phase9-workflow.ps1)
- [phase9-workflow-scenarios.json](C:\Users\OJOWA\Documents\Project 4\CentralProcure\scripts\phase9-workflow-scenarios.json)

## Scope

The verification run checks:
- service reachability via `/health` and `/api/_migration/status`
- seeded vendor and internal logins
- threshold resolution for low-value, board-level, and BPP-level examples
- workflow runtime and route decisions for seeded requisition, award, and contract records
- complaint-branch action availability
- payment tracking and closeout readiness on the completed seeded contract
- audit summary, audit history, and per-entity workflow diagnostics
- optional local database schema presence when `psql.exe` is available
- optional mutation coverage for closeout creation

## Local Run

Prerequisites:
- backend running locally, default `http://localhost:5000`
- local database reachable with the configured credentials
- seed data applied from `database_schema/seed`

Command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-phase9-workflow.ps1 -IncludeDatabaseChecks
```

Optional mutation run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-phase9-workflow.ps1 -IncludeDatabaseChecks -IncludeMutations
```

Output:
- JSON report in `artifacts/verification/phase9`
- Markdown summary in `artifacts/verification/phase9`

## Render Run

Run the same pack against the deployed backend by overriding `-BaseUrl`.

Example:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-phase9-workflow.ps1 `
  -BaseUrl "https://centralprocure-backend.onrender.com"
```

Notes:
- database checks are local-only unless Render database access is available from the runner
- mutation mode should only be used against Render when the environment is explicitly prepared for verification data changes

## Seed Scenarios

The scenario manifest anchors the verification run to these seeded records:
- low-threshold requisition: `Emergency Communication Radios`
- board-threshold award: `HQ Network Refresh`
- BPP-threshold award: `Border Surveillance Sensor Maintenance`
- closeout path contract: `CON-2026-0120`
- accepted inspection: `INSP-2026-0019`
- complaint-capable tender: `Training Simulation Labs`

Accounts used by default:
- `vendor1@example.com / password123`
- `ict@nis.gov.ng / password123`
- `procurement@nis.gov.ng / password123`
- `finance@nis.gov.ng / password123`
- `inspectionofficer@nis.gov.ng / password123`
- `accountingofficer@nis.gov.ng / password123`

## Expected Evidence

A clean Phase 9 run should produce:
- passing reachability and login checks
- threshold results that distinguish low, board, and BPP cases
- runtime and routing responses for the seeded entities
- audit history and diagnostics responses for at least one seeded high-value award
- payment tracking evidence that the completed accepted contract is closeout-ready or already archived

If failures occur, the generated report is the first debugging artifact. Pair it with the live diagnostics endpoint before inspecting the database directly.
