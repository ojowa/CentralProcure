# Backend Consolidation Mapping (17 -> 5)

## Target Services
- `identity-service`
- `vendor-sourcing-service`
- `procurement-workflow-service`
- `post-award-service`
- `governance-service`

## Service Ownership Mapping
| Legacy Service (17) | Primary Routes | Target Service (5) | Rationale |
|---|---|---|---|
| `identity-access-service` | `/api/Auth/*` | `identity-service` | Authentication, role-based access and user identity boundary. |
| `vendor-management-service` | `/api/VendorManagement/*` | `vendor-sourcing-service` | Vendor profile/compliance belongs with sourcing lifecycle. |
| `tender-management-service` | `/api/TenderManagement/*` | `vendor-sourcing-service` | Tender publication and listing are sourcing-stage functions. |
| `bid-submission-service` | `/api/BidSubmission/*` | `vendor-sourcing-service` | Bid receipt is part of vendor sourcing. |
| `bid-opening-service` | `/api/bid-opening/sessions/*` | `vendor-sourcing-service` | Bid opening is the final sourcing checkpoint. |
| `requisition-service` | `/api/requisitions/*` | `procurement-workflow-service` | Requisition initiation and tracking are pre-award workflow. |
| `procurement-planning-service` | `/api/procurement-plans/*` | `procurement-workflow-service` | APP and planning controls stay in workflow domain. |
| `evaluation-service` | `/api/evaluations/*` | `procurement-workflow-service` | Technical/financial evaluation drives approval workflow. |
| `approval-workflow-service` | `/api/tenders-board-approvals/*`, `/api/cgis-approval/*`, `/api/workflow-actions/*`, `/api/workflow-runtime/*` | `procurement-workflow-service` | Formal board, CGIS, and workflow-driven threshold decisions. |
| `workflow-orchestration-service` | `/api/workflows/*` | `procurement-workflow-service` | Orchestration rules and sequencing engine. |
| `bpp-integration-service` | `/api/bpp/*` | `procurement-workflow-service` | No-objection/regulatory interaction during workflow. |
| `contract-management-service` | `/api/contracts/*` | `post-award-service` | Contract award and lifecycle are post-award activities. |
| `inspection-service` | `/api/inspections/*` | `post-award-service` | Delivery/acceptance governance after award. |
| `payment-tracking-service` | `/api/payments/*` | `post-award-service` | Payment state is contract execution/post-award. |
| `audit-compliance-service` | `/api/audit/*` | `governance-service` | Audit evidence and compliance reporting. |
| `notification-service` | `/api/notifications/*` | `governance-service` | Cross-cutting communication and policy alerts. |
| `monitoring-service` | `/api/monitoring/*` | `governance-service` | Health/telemetry/oversight controls. |

## Execution Order
1. Keep existing 17 services live while building compatibility endpoints inside the new 5 services.
2. Move data + handlers by target service domain (identity -> sourcing -> workflow -> post-award -> governance).
3. Preserve route contracts first; optimize internals after frontend and integration tests are green.

## Current Implementation Status
- `backend-consolidated/` now contains runnable .NET 10 skeleton hosts for all 5 target services.
- `run-microservices.ps1` supports two modes:
  - `legacy17` (existing setup)
  - `target5` (new consolidated service hosts)
- `target5` mode has been run successfully with startup log streaming and controlled shutdown.

## Next Development Actions
1. Add compatibility controllers in the new 5 services for existing frontend routes.
2. Move identity endpoints first (`/api/Auth/register`, `/api/Auth/login`) to reduce register/login instability.
3. Migrate tender and bid read paths next (`/api/TenderManagement/open`, `/api/BidSubmission/submitted`).
4. Add smoke-test script to validate critical UI-facing APIs after each migration batch.

## Recent Backend Update (2026-03-06)
- Build stabilization: added backend-wide global usings for ASP.NET Core types via `Backend/Directory.Build.props`.
- Middleware fixes: explicit usings added to shared middleware to ensure `HttpContext`, `RequestDelegate`, and `ILogger<>` resolve consistently.
- Static web assets build fix: set `PackageId` in `Backend/eProcurement.Api/eProcurement.Api.csproj` to prevent static web assets manifest errors.
- Build command now uses the local SDKs path and bundled versions props to avoid workload resolver and SDK path issues in the sandbox environment.
