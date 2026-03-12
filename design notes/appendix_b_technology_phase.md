# Appendix B: Technology Phase
## Electronic Procurement System - Nigeria Immigration Service (NIS)

---

## 1. Purpose of the Technology Phase

The Technology Phase describes how the Electronic Procurement System will be implemented, deployed, secured, and sustained. It translates approved business processes and legal requirements into a reliable digital platform.

This appendix is written for:
- Top Management and Accounting Officers
- ICT Directors and System Owners
- Oversight and audit stakeholders

The emphasis is on control, reliability, security, and sustainability.

---

## 2. Guiding Principles

- Compliance by Design: Technology enforces the Public Procurement Act (PPA) 2007 automatically.
- Security First: Procurement data is treated as sensitive government information.
- Separation of Duties: System components prevent concentration of power.
- Scalability: The system supports growth in users, vendors, and procurement volume.
- Auditability: Every action is traceable and preserved.

---

## 3. Technology Layers (High-Level View)

1. User Access Layer
2. Application and Workflow Layer
3. Data and Records Layer
4. Integration and Support Services Layer

This layered approach simplifies oversight and reduces operational risk.

---

## 4. User Access Layer

### Key Characteristics
- Single Next.js app with public and internal route groups (public at `/`, internal at `/internal`)
- Role-based access per user mandate
- Secure login and session controls

### Governance Value
- Prevents unauthorized access
- Supports separation of duties
- Protects sensitive procurement information

---

## 5. Application and Workflow Layer

### Key Functions
- Enforcement of procurement workflow steps
- Automatic routing of approvals based on thresholds
- Enforcement of deadlines and timelines
- Control of procurement methods

### Governance Value
- Eliminates discretionary bypass of procedures
- Ensures consistent application of procurement rules
- Reduces human error and manipulation

---

## 6. Data and Records Layer

### Data Covered
- Annual Procurement Plans
- Procurement requests and approvals
- Bids and evaluation reports
- Contracts and performance records
- Audit logs and system activity records

### Governance Value
- Creates a single source of truth
- Preserves records for audits and investigations
- Supports transparency and accountability

---

## 7. Integration and Support Services Layer

### Supported Integrations
- BPP documentation submission
- Email and SMS notification services
- Document management and digital signing
- Payment and financial systems (where applicable)

### Governance Value
- Strengthens coordination with oversight bodies
- Improves communication without manual intervention
- Preserves data integrity during exchanges

---

## 8. Security and Control Measures

- Role-Based Access Control (RBAC)
- Encrypted storage and transmission
- Time-stamped system actions
- Read-only access for auditors
- Continuous monitoring and log retention

---

## 9. Deployment Approach

### Deployment Options
- Government Data Centre (On-Premise)
- Hybrid Deployment

### Deployment Controls
- Controlled release and change management
- Regular system backups
- Disaster recovery and business continuity planning

---

## 10. Technology Standards and Tools

| Component | Standard / Tool |
|---|---|
| Frontend | React + Next.js (single app with public/internal route groups) |
| Backend Services | ASP.NET Core (.NET 10) |
| Database | PostgreSQL |
| Security | JWT, RBAC, encryption, audit logging |
| Hosting | On-premise or hybrid infrastructure |
| Monitoring | Structured logs + health monitoring |

---

## 11. Implementation Phases

1. System configuration and setup
2. Workflow and rule configuration
3. Security hardening and access definition
4. Testing and validation
5. Pilot deployment
6. Full rollout
7. Ongoing support and improvement

---

## 12. Governance and Oversight During Technology Phase

- ICT and procurement joint steering committee
- Change control and approval process
- Documentation of system configurations
- Independent testing and validation

---

## 13. Design Modification Update (Consolidated 5-Service Model)

The architecture has been modified from a broad multi-service layout to five domain services:
- identity-service
- vendor-sourcing-service
- procurement-workflow-service
- post-award-service
- governance-service

Operational impact:
- Lower deployment and support overhead
- Clearer domain ownership
- Faster incident response
- Better maintainability without reducing governance controls

Migration policy:
- Existing routes remain available through compatibility endpoints during transition
- Critical frontend flows (register, login, tenders, bids) are prioritized
- Validation is required before each phase cutover

### 13.1 Recent Backend Update (2026-03-06)
- Build stabilization: added backend-wide global usings for ASP.NET Core types via `Backend/Directory.Build.props`.
- Middleware fixes: explicit usings added to shared middleware to ensure `HttpContext`, `RequestDelegate`, and `ILogger<>` resolve consistently.
- Static web assets build fix: set `PackageId` in `Backend/eProcurement.Api/eProcurement.Api.csproj` to prevent static web assets manifest errors.
- Build command now uses the local SDKs path and bundled versions props to avoid workload resolver and SDK path issues in the sandbox environment.

---

## 14. Conclusion

The Technology Phase ensures procurement reform is institutionalized through secure, governed digital controls. The 5-service consolidation strengthens maintainability and delivery speed while preserving legal compliance and auditability.

---

**Document Type:** Appendix / Annex  
**Focus:** Technology Implementation and Governance  
**Audience:** Top Management, ICT Leadership, Oversight Bodies  
**Format:** Markdown (.md)
