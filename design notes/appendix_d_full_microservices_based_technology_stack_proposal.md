# Appendix D: Full Consolidated Microservices Technology Stack Proposal (5 Services)
## Electronic Procurement System - Nigeria Immigration Service (NIS)

---

## 1. Overview

This appendix presents the complete end-to-end consolidated microservices stack for the NIS Electronic Procurement System.

Design objectives:
- Enforce PPA 2007 controls through system behavior
- Sustain transparency, auditability, and separation of duties
- Improve reliability and maintainability by reducing service sprawl
- Support on-premise or hybrid deployment models

---

## 2. Consolidated Microservices Principle

The system is implemented as five domain services. Each service owns specific business responsibilities and exposes secure APIs.

Service domains:
- identity-service
- vendor-sourcing-service
- procurement-workflow-service
- post-award-service
- governance-service

This model reduces operational complexity while maintaining governance boundaries.

---

## 3. Logical Architecture Layers

### 3.1 Presentation Layer

Purpose: User interaction and role-based access.

Technologies:
- React + Next.js (internal and external portals)

Governance value:
- Clear role segregation
- Lower risk of unauthorized actions

---

### 3.2 API and Access Control Layer

Purpose: Secure entry and traffic control.

Capabilities:
- Authentication and token validation
- Rate limiting and request logging
- Routing to backend domain services

Governance value:
- Central access visibility
- Strong perimeter control

---

### 3.3 Domain Services Layer

Purpose: Execution of procurement business capabilities in five services.

Ownership model:
- Identity and access controls: `identity-service`
- Sourcing functions: `vendor-sourcing-service`
- Pre-award workflow and approvals: `procurement-workflow-service`
- Post-award operations: `post-award-service`
- Oversight and observability: `governance-service`

Governance value:
- Controlled boundaries per domain
- Easier accountability and change management

---

### 3.4 Data Layer

Purpose: Reliable and auditable record management.

Standards:
- PostgreSQL primary datastore
- Service-owned schemas
- Backups, retention, and access controls

Governance value:
- Traceable data ownership
- Reduced cross-domain data risk

---

### 3.5 Security Layer

Controls:
- JWT authentication
- RBAC authorization
- TLS encryption
- Structured logging and audit trails

Governance value:
- Defense in depth
- Compliance-ready evidence generation

---

### 3.6 Deployment and Operations Layer

Technologies:
- ASP.NET Core on .NET 10
- Container-ready services
- Health checks and centralized logs

Run modes supported in current development:
- `legacy17` (existing setup)
- `target5` (consolidated setup)

Governance value:
- Controlled migration path
- Faster operational diagnosis and recovery

---

### 3.7 Recent Backend Update (2026-03-06)
- Build stabilization: added backend-wide global usings for ASP.NET Core types via `Backend/Directory.Build.props`.
- Middleware fixes: explicit usings added to shared middleware to ensure `HttpContext`, `RequestDelegate`, and `ILogger<>` resolve consistently.
- Static web assets build fix: set `PackageId` in `Backend/eProcurement.Api/eProcurement.Api.csproj` to prevent static web assets manifest errors.
- Build command now uses the local SDKs path and bundled versions props to avoid workload resolver and SDK path issues in the sandbox environment.

---

## 4. Route Compatibility Policy

During migration, existing frontend route contracts remain available while internals are moved to the new five services.

Compatibility priorities:
- `/api/Auth/register`
- `/api/Auth/login`
- `/api/TenderManagement/open`
- `/api/BidSubmission/submit`
- `/api/VendorManagement/profile`

Cutover rule:
- No route is retired until validation is complete for both public and internal frontends.

---

## 5. Governance and Oversight Impact

The consolidated architecture provides:
- Lower technical fragmentation
- Faster and clearer incident ownership
- Stronger implementation governance
- Better long-term sustainability for ICT operations

---

## 6. Conclusion

The 5-service consolidated stack preserves legal compliance and control rigor while improving practical maintainability. It is a governance-aligned modernization path suitable for phased implementation in NIS.

---

**Document Type:** Appendix / Annex  
**Audience:** Management, ICT Leadership, Oversight Bodies  
**Format:** Markdown (.md)
