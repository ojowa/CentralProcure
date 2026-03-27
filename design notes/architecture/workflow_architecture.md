# Appendix A: Procurement Workflow and System Architecture Explanation
## (Plain, PPA-Aligned Reference for Management and Oversight)

---

## 1. Purpose of This Appendix

This appendix explains, in plain and legally aligned language, the Procurement Workflow Diagram and the System Architecture Diagram for the Electronic Procurement System of the Nigeria Immigration Service (NIS).

It is written to:
- Support top management decision-making
- Assist Tenders Boards and CGIS
- Provide clarity for BPP, auditors, and oversight agencies
- Demonstrate how the system enforces the Public Procurement Act (PPA) 2007

This appendix avoids technical complexity and focuses on process integrity, control points, and governance value.

---

## 2. Explanation of the Procurement Workflow Diagram

### 2.1 What the Workflow Diagram Represents

The Procurement Workflow Diagram presents the end-to-end sequence of activities required to carry out lawful public procurement under the PPA 2007.

It demonstrates that procurement within NIS:
- Is planned before execution
- Is budget-backed
- Is competitive and transparent
- Passes through mandatory approvals
- Is fully traceable and auditable

The workflow ensures no single individual or office can control the process from start to finish.

---

### 2.2 Step-by-Step Explanation (PPA-Aligned)

1. Identification of need by user department
2. Validation against the Annual Procurement Plan (APP)
3. Procurement request initiation
4. Budget availability and threshold verification
5. Approval by CGIS
6. Tender advertisement (open competitive bidding)
7. Vendor registration and electronic bid submission
8. Public bid opening
9. Technical evaluation
10. Financial evaluation
11. Tenders Board review and approval
12. BPP no-objection (where required)
13. Contract award
14. Contract execution and monitoring
15. Inspection, acceptance, and payment
16. Audit and compliance reporting

Each step is controlled and logged to preserve legal defensibility, transparency, and accountability.

---

## 3. Explanation of the System Architecture Diagram (Non-Technical)

### 3.1 What the Architecture Diagram Shows

The System Architecture Diagram shows how procurement services are organised to enforce control, security, and reliability.

The architecture is layered into:
1. User Interface Layer
2. Business Rules and Workflow Layer
3. Records and Data Layer
4. Integration and Support Services Layer

---

### 3.2 Consolidated Backend Design Modification (2026)

The backend architecture has been consolidated from many narrowly scoped services into five domain services for simpler operations while preserving governance controls.

The five service domains are:
- identity-service
- vendor-sourcing-service
- procurement-workflow-service
- post-award-service
- governance-service

Governance effect of consolidation:
- Separation of duties remains enforced at route, role, and workflow levels
- Operational complexity is reduced (fewer deployments and integrations)
- Auditability is maintained through centralized logging and immutable records
- Migration can proceed in phases without breaking current user flows

---

## 4. Compliance, Control Points, and Governance Value

Key control points include:
- Mandatory planning and budgeting checks
- Automated approval thresholds
- Separation of technical and financial evaluations
- Restricted access to bids before opening
- External oversight through BPP clearance
- Immutable audit trails

Together, these controls ensure:
- Procurement abuse is technically difficult
- Accountability is clearly assigned
- Oversight bodies can verify compliance efficiently

---

## 4.1 Recent Backend Update (2026-03-06)
- Backend build hardening completed; procurement workflow and governance controls remain unchanged.

---

## 5. Conclusion

The Electronic Procurement System is a governance framework implemented through technology. By aligning every procurement step with the PPA and embedding controls into workflow and architecture, NIS is positioned for stronger transparency, accountability, and value for public funds.

---

**Document Type:** Appendix / Annex  
**Audience:** Top Management, Tenders Boards, Oversight Bodies  
**Format:** Markdown (.md)
