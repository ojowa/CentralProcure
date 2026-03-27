# Workflow and Architecture Diagram References
## Electronic Procurement System – Nigeria Immigration Service (NIS)

---

## 1. Purpose of This Document

This document provides **formal references and explanations** for the **Procurement Workflow Diagram** and **System Architecture Diagram** that support the proposed Electronic Procurement System for the Nigeria Immigration Service.

It is intended for:
- Top Management and CGIS
- Procurement and Tenders Board Members
- ICT and System Architects
- Bureau of Public Procurement (BPP) and oversight reviewers

The diagrams referenced here are designed to demonstrate **legal compliance, process integrity, and technical soundness** in line with the Public Procurement Act (PPA) 2007.

---

## 2. Procurement Workflow Diagram – Reference Description

### 2.1 Diagram Title
**End-to-End PPA-Compliant Procurement Workflow**

### 2.2 Diagram Objective

The Procurement Workflow Diagram illustrates the complete lifecycle of a procurement activity within the Nigeria Immigration Service, from needs identification to final audit and reporting. It demonstrates how the proposed system enforces:

- Mandatory procurement planning
- Budget control and approval thresholds
- Open competitive bidding
- Separation of technical and financial evaluations
- Mandatory approvals and BPP “No Objection”
- Traceable contract execution and payment

---

### 2.3 Workflow Stages Represented

The diagram contains the following major stages:

1. **Needs Identification by User Department**  
   Business need is formally identified and documented.

2. **Annual Procurement Plan (APP) Validation**  
   The system validates that the request exists within an approved APP, in compliance with Section 16 of the PPA.

3. **Procurement Request Initiation**  
   Electronic submission of procurement request with justification and cost estimate.

4. **Budget Availability and Threshold Check**  
   Automated verification of budget provision and approval authority based on monetary thresholds.

5. **Approval by CGIS**  
   Mandatory authorization before tendering activities commence.

6. **Tender Advertisement**  
   Publication of procurement opportunities using Open Competitive Bidding as the default method.

7. **Vendor Registration and Bid Submission**  
   Registered vendors submit encrypted bids electronically within defined timelines.

8. **Public Bid Opening**  
   System-controlled bid opening at the advertised time, with automatic generation of bid opening records.

9. **Technical Evaluation**  
   Independent assessment of technical compliance without access to financial data.

10. **Financial Evaluation**  
    Evaluation of financial bids for technically qualified vendors only.

11. **Tenders Board Review and Approval**  
    Review of evaluation outcomes and recommendation of award.

12. **BPP “No Objection” Processing**  
    Submission of procurement dossier and receipt of statutory clearance where applicable.

13. **Contract Award**  
    Issuance of award letter and contract documentation.

14. **Contract Execution and Monitoring**  
    Tracking of deliverables, milestones, and variations.

15. **Inspection, Acceptance, and Payment**  
    Certification of performance prior to payment.

16. **Audit and Compliance Reporting**  
    Availability of immutable records for internal and external oversight.

---

### 2.4 Compliance Justification

This workflow directly reflects the requirements of the Public Procurement Act by ensuring that:
- No procurement occurs outside approved plans and budgets
- No bid is accessed before the official opening date
- No contract is awarded without required approvals
- All actions are logged and auditable

---

## 3. System Architecture Diagram – Reference Description

### 3.1 Diagram Title
**Layered Architecture for the NIS Electronic Procurement System**

### 3.2 Diagram Objective

The System Architecture Diagram presents a high-level technical view of how system components interact to support secure, scalable, and compliant electronic procurement operations within the Nigeria Immigration Service.

It demonstrates separation of concerns, system governance, and secure integration with external platforms.

---

### 3.3 Architectural Layers Represented

#### 1. Presentation Layer

Provides user interfaces for all stakeholders:
- Internal NIS users (procurement officers, evaluators, management)
- External vendors and contractors

This layer handles user interaction only and contains no business rules.

---

#### 2. Application Layer

The core logic layer responsible for:
- Workflow orchestration
- Business rule enforcement
- Approval routing and threshold validation
- Procurement method control

This layer ensures that all actions comply with PPA and internal regulations.

---

#### 3. Data Layer

Stores all procurement-related data, including:
- Procurement plans and requests
- Bids and evaluation records
- Contracts and performance data
- System and audit logs

The design principle is immutability of critical records to preserve audit integrity.

---

#### 4. Integration Layer

Handles secure communication with external and supporting systems, including:
- Bureau of Public Procurement (BPP)
- Email and SMS notification services
- Document management and digital signature services
- Financial and payment systems (where applicable)

---

### 3.4 Security and Governance Representation

The architecture diagram highlights:
- Role-Based Access Control (RBAC)
- Separation of duties across modules
- Encrypted data flow between layers
- Read-only audit access for oversight bodies

---

## 4. How the Diagrams Support Management Decision-Making

Together, the workflow and architecture diagrams:

- Provide visual assurance of legal and regulatory compliance
- Demonstrate control points that reduce fraud and abuse
- Show clear accountability at every procurement stage
- Support ICT planning, budgeting, and phased implementation

They enable management to understand **both the process flow and the technical structure** without requiring deep technical knowledge.

---

## 4.1 Recent Backend Update (2026-03-06)
- Backend build hardening completed; diagram scope and governance assumptions remain unchanged.

---

## 5. Conclusion

The referenced Procurement Workflow and System Architecture diagrams are integral to understanding how the proposed Electronic Procurement System will operate in practice. They demonstrate a strong alignment between legal requirements, operational processes, and technical implementation.

These diagrams serve as reliable tools for approval, oversight, system development, and future audits.

---

**Document Type:** Diagram Reference Note  
**Audience:** Top Management, Procurement Oversight, ICT Teams  
**Format:** Markdown (.md)
