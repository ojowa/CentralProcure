# Proposal for an Electronic Procurement System (e-Procurement)
## Nigeria Immigration Service (NIS)

---

## 1. Introduction

Public procurement remains one of the most sensitive and high-risk activities in government institutions. The **Public Procurement Act (PPA) 2007** was enacted to ensure transparency, accountability, competitiveness, and value for money in the use of public funds.

The Nigeria Immigration Service (NIS), as a critical Federal Government agency, undertakes significant procurement activities annually, ranging from ICT systems and border security infrastructure to logistics, uniforms, and services. Currently, many procurement processes are still manual or semi-manual, creating risks of delays, errors, weak audit trails, and non-compliance.

This proposal presents a **PPA-compliant Electronic Procurement System (e-Procurement)** designed to automate, standardize, and secure procurement activities within the Nigeria Immigration Service.

---

## 2. Objectives of the System

The proposed system aims to:

- Ensure full compliance with the **Public Procurement Act (PPA) 2007**
- Promote transparency and fairness in procurement
- Enforce approval thresholds and separation of duties
- Provide end-to-end traceability and auditability
- Reduce procurement cycle time and administrative costs
- Prevent procurement-related fraud and manipulation
- Improve data-driven decision-making and reporting

---

## 3. Scope of the System

The e-Procurement System shall cover:

- Annual Procurement Planning (APP)
- Procurement request initiation and approvals
- Tender advertisement and bidding
- Vendor registration and management
- Electronic bid submission and opening
- Technical and financial evaluation
- Tenders Board and CGIS approvals
- BPP "No Objection" processing
- Contract award and management
- Inspection, acceptance, and payment tracking
- Audit, compliance, and reporting

The system will apply to all procurement activities funded wholly or partly with Federal Government funds.

---

## 4. Legal and Regulatory Framework

The system is guided by the following:

- Public Procurement Act (PPA) 2007
- Bureau of Public Procurement (BPP) Guidelines
- Financial Regulations of the Federal Government
- Nigerian Data Protection Act (NDPA)
- Relevant circulars and procurement thresholds

The design principle is **compliance by design**, ensuring that actions not permitted by law are technically impossible within the system.

---

## 5. High-Level System Architecture

The system adopts a layered architecture:

1. **Presentation Layer** – Web portals for internal users and vendors
2. **Application Layer** – Business logic, workflows, and rule enforcement
3. **Data Layer** – Secure databases and audit logs
4. **Integration Layer** – External systems (BPP, email, SMS, document management)

---

## 6. Core System Modules

### 6.1 User and Role Management

- Role-Based Access Control (RBAC)
- Separation of duties enforced by system rules
- Roles include:
  - User Department Officers
  - Procurement Officers
  - Evaluation Committee Members
  - Tenders Board Members
  - CGIS
  - Auditors
  - Vendors/Contractors

---

### 6.2 Annual Procurement Planning (APP) Module

- Creation and approval of Annual Procurement Plans
- Linkage of each procurement request to an approved APP item
- Budget line and funding verification
- Automatic blocking of off-plan procurements

---

### 6.3 Procurement Request & Approval Module

- Electronic initiation of procurement requests
- Cost estimation and justification
- Automated determination of procurement method
- Threshold-based approval routing
- CGIS authorization

---

### 6.4 Tender Management Module

- Open Competitive Bidding as default method
- Tender advertisement publication
- Downloadable bidding documents
- Deadline enforcement and tender closure

---

### 6.5 Vendor Management Module

- Vendor registration and categorization
- Upload and validation of statutory documents
- Vendor status tracking (active, suspended, blacklisted)
- Secure vendor dashboard

---

### 6.6 Bid Submission & Opening Module

- Electronic bid submission
- Encryption of bids at rest and in transit
- Automatic bid opening at scheduled time
- Generation of bid opening registers
- Public transparency reports

---

### 6.7 Evaluation Module

- Separation of technical and financial evaluations
- Independent evaluator scoring
- Automated scoring and ranking
- Disqualification and compliance checks
- Red-flag detection for abnormal bids

---

### 6.8 Approval & Compliance Module

- Tenders Board review and approvals
- CGIS final authorization
- BPP "No Objection" request tracking
- Prevention of contract award without required approvals

---

### 6.9 Contract Management Module

- Contract award generation
- Contract documentation and signing
- Milestone and deliverables tracking
- Contract variation controls

---

### 6.10 Inspection, Payment & Performance Module

- Inspection and acceptance reports
- Linkage of payment to certified performance
- Payment status tracking
- Procurement-to-delivery visibility

---

### 6.11 Audit & Reporting Module

- Immutable system audit logs
- Read-only auditor access
- Compliance dashboards
- Procurement performance analytics
- Exportable reports for oversight agencies

---

## 7. Security and Data Protection

The system will implement:

- Secure authentication and authorization
- Encryption of sensitive data
- Digital signatures and timestamps
- Immutable audit trails
- Regular backups and disaster recovery
- Compliance with the Nigerian Data Protection Act

---

## 8. Deployment Strategy

The system may be deployed using:

- Government-owned data centre (on-premise), or
- Hybrid cloud infrastructure

Containerization (Docker) is recommended for scalability, security, and ease of deployment.

---

## 9. Technology Stack (Proposed)

| Layer | Technology |
|------|-----------|
| Frontend | React / Angular |
| Backend | .NET / Java Spring / Node.js |
| Database | PostgreSQL |
| Workflow | BPMN or Custom Engine |
| Security | JWT, RBAC |
| Hosting | On-Premise / Hybrid Cloud |

---

## 10. Benefits to Nigeria Immigration Service

- Improved transparency and public trust
- Strong compliance with procurement laws
- Reduced procurement cycle time
- Enhanced audit readiness
- Reduced fraud and manual interference
- Centralized and reliable procurement data

---

## 11. Implementation Roadmap

1. Approval of system concept
2. Detailed requirements and stakeholder engagement
3. System design and architecture
4. Development and testing
5. Pilot deployment
6. Training and change management
7. Full rollout and continuous improvement

---

## 11.1 Recent Backend Update (2026-03-06)
- Backend build hardening completed to improve reliability; no changes to functional scope or governance controls.

---

## 12. Conclusion

The proposed Electronic Procurement System offers the Nigeria Immigration Service a robust, transparent, and legally compliant platform for managing public procurement. By embedding the requirements of the Public Procurement Act directly into system workflows, the NIS will significantly strengthen governance, accountability, and operational efficiency.

This system positions the Service as a leader in digital public sector reform and procurement best practices.

---

**Prepared for:** Nigeria Immigration Service  
**Document Type:** System Proposal  
**Format:** Markdown (.md)

