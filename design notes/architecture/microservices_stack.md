# Appendix C: Detailed Consolidated Microservices Technology Stack (5 Services)
## Electronic Procurement System - Nigeria Immigration Service (NIS)

---

## 1. Purpose of This Appendix

This appendix provides the detailed technology stack for implementing the NIS Electronic Procurement System using a consolidated microservices model (5 domain services).

The design priorities are:
- Compliance with the Public Procurement Act (PPA) 2007
- High availability and scalability
- Strong security and separation of duties
- Audit readiness and governance oversight
- Long-term maintainability

---

## 2. Architectural Approach: Consolidated Microservices

The system uses five domain-aligned services instead of many narrowly scoped services.

Benefits:
- Reduced operational overhead
- Faster release and support cycles
- Clear domain ownership
- Preserved control boundaries through role and workflow enforcement

---

## 3. High-Level Technology Stack Overview

| Layer | Proposed Technology |
|---|---|
| Frontend | React + Next.js |
| API Access | API gateway or reverse proxy (optional by environment) |
| Backend Services | ASP.NET Core (.NET 10) |
| Data | PostgreSQL |
| Security | JWT, RBAC, TLS encryption |
| Messaging | Event-driven messaging (optional, as needed) |
| Hosting | On-premise or hybrid government cloud |
| Monitoring | Health endpoints + centralized structured logs |

---

## 4. Backend Domain Services (Target Model)

| Service | Primary Responsibilities | Representative Routes |
|---|---|---|
| `identity-service` | Authentication, authorization, account identity | `/api/Auth/*` |
| `vendor-sourcing-service` | Vendor profile/compliance, tenders, bid submission/opening | `/api/VendorManagement/*`, `/api/TenderManagement/*`, `/api/BidSubmission/*`, `/api/bid-opening/sessions/*` |
| `procurement-workflow-service` | Requisitions, planning, evaluation, Tenders Board approvals, CGIS approvals, BPP/workflow orchestration | `/api/requisitions/*`, `/api/procurement-plans/*`, `/api/evaluations/*`, `/api/tenders-board-approvals/*`, `/api/cgis-approval/*`, `/api/workflow-actions/*`, `/api/workflow-runtime/*`, `/api/bpp-no-objections/*` |
| `post-award-service` | Contract lifecycle, inspection, payment tracking | `/api/contracts/*`, `/api/inspections/*`, `/api/payments/*` |
| `governance-service` | Audit, notifications, monitoring | `/api/audit/*`, `/api/notifications/*`, `/api/monitoring/*` |

---

## 5. Runtime and Platform Standards

- Runtime: .NET 10
- Service style: REST APIs with domain ownership
- **Naming Conventions:**
  - **Frontend/Backend:** Use **PascalCase** for all code-level identifiers.
  - **Database:** Use **snake_case** for all schema-level identifiers.
- Logging: structured console/file logging with service labels
- Health: `/health` per service and operational startup logs
- Deployment: container-ready, environment-specific configuration

---

## 6. Security Controls

- JWT authentication and RBAC authorization
- Encrypted transport (TLS)
- Strong password and session controls
- Request logging and trace correlation
- Read-only views for audit functions where required

---

## 7. Data and Integration Approach

- PostgreSQL as primary relational data store
- Schema ownership by service domain
- Integration patterns:
  - Synchronous API calls for immediate workflow steps
  - Asynchronous events where eventual consistency is acceptable

---

## 8. Migration and Compatibility Strategy

- Keep legacy route contracts active during transition
- Migrate by domain in this order:
  1. identity-service
  2. vendor-sourcing-service
  3. procurement-workflow-service
  4. post-award-service
  5. governance-service
- Validate frontend-critical APIs at each migration stage

Critical APIs to preserve early:
- `/api/Auth/register`
- `/api/Auth/login`
- `/api/TenderManagement/open`
- `/api/BidSubmission/submit`
- `/api/VendorManagement/profile`

---

## 8.1 Recent Backend Update (2026-03-06)
- Build stabilization: added backend-wide global usings for ASP.NET Core types via `Backend/Directory.Build.props`.
- Middleware fixes: explicit usings added to shared middleware to ensure `HttpContext`, `RequestDelegate`, and `ILogger<>` resolve consistently.
- Static web assets build fix: set `PackageId` in `Backend/eProcurement.Api/eProcurement.Api.csproj` to prevent static web assets manifest errors.
- Build command now uses the local SDKs path and bundled versions props to avoid workload resolver and SDK path issues in the sandbox environment.

---

## 9. Governance Benefits

The 5-service consolidated stack:
- Preserves legal and policy control points
- Improves maintainability and supportability
- Reduces service sprawl risk
- Supports stronger operational governance with fewer moving parts

---

**Document Type:** Appendix / Annex  
**Focus:** Detailed Technology Stack (Consolidated Microservices)  
**Audience:** ICT Leadership, Management, Oversight Bodies  
**Format:** Markdown (.md)
