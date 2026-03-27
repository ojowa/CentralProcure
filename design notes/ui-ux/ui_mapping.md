# Appendix E: UI-to-Microservice Mapping Table (Consolidated 5-Service Model)
## Electronic Procurement System - Nigeria Immigration Service (NIS)

---

## Purpose

This appendix maps each User Interface (UI) to the backend domain service responsible for controls, approvals, security, and audit behavior in the consolidated 5-service architecture.

This mapping:
- Preserves separation of duties
- Maintains traceability from UI actions to backend enforcement
- Supports migration from legacy service sprawl to stable domain ownership

---

## UI to Microservice Mapping

| UI / Screen | Primary Domain Service | Governance and Control Purpose |
|---|---|---|
| Login and Authentication | `identity-service` | Access control, credential verification, session governance |
| User Profile | `identity-service` | Role visibility and account integrity |
| User and Role Management | `identity-service` | Separation of duties and privilege governance |
| Vendor Registration | `vendor-sourcing-service` | Vendor onboarding and due diligence |
| Vendor Profile and Compliance Documents | `vendor-sourcing-service` | Supplier compliance controls |
| Tender Creation | `vendor-sourcing-service` | Tender method and publication controls |
| Tender Publication | `vendor-sourcing-service` | Controlled public disclosure |
| Tender Listing (Public) | `vendor-sourcing-service` | Transparency and equal access |
| Bid Submission | `vendor-sourcing-service` | Secure bid receipt, timestamping, and locking |
| Bid Opening | `vendor-sourcing-service` | Timed opening and committee-governed process |
| Department Dashboard | `procurement-workflow-service` | Controlled initiation visibility |
| Procurement Requisition | `procurement-workflow-service` | Formal request initiation and workflow control |
| Requisition Tracking | `procurement-workflow-service` | Process traceability and status control |
| Procurement Planning (APP) | `procurement-workflow-service` | Legal planning compliance |
| Technical Evaluation | `procurement-workflow-service` | Objective technical scoring |
| Financial Evaluation | `procurement-workflow-service` | Controlled financial comparison |
| Evaluation Report | `procurement-workflow-service` | Consolidated evidence for approvals |
| Approval Dashboard | `procurement-workflow-service` | Threshold-based decisions |
| CGIS Final Approval | `procurement-workflow-service` | CGIS authority enforcement |
| BPP No-Objection | `procurement-workflow-service` | Regulatory compliance pathway |
| Workflow Configuration | `procurement-workflow-service` | Policy-aligned orchestration governance |
| Contract Award | `post-award-service` | Lawful award transition to execution |
| Contract Management | `post-award-service` | Contract lifecycle governance |
| Inspection and Acceptance | `post-award-service` | Delivery verification and acceptance control |
| Payment Tracking | `post-award-service` | Financial transparency and status control |
| Notifications Centre | `governance-service` | Traceable communications and alerts |
| Audit Dashboard | `governance-service` | Oversight monitoring and compliance visibility |
| Audit Trail Viewer | `governance-service` | Immutable evidence access |
| System Monitoring and Health | `governance-service` | Operational oversight and reliability controls |

---

## Migration Note

Legacy routes remain active during migration through compatibility endpoints and phased cutover. UI behavior is expected to remain stable while backend ownership is consolidated into the five domain services.

---

## Recent Backend Update (2026-03-06)
- Backend build hardening completed; UI-to-service ownership remains unchanged.

---

## Governance Summary

This consolidated mapping ensures:
- Every UI action is governed by a defined domain service
- No UI bypasses approval or compliance logic
- Full traceability remains available for internal and external oversight

---

**Document Type:** Appendix / Annex  
**Audience:** ICT, Auditors, Oversight Bodies  
**Format:** Markdown (.md)
