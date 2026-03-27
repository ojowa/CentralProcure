# Comprehensive System Design & Architecture
## Electronic Procurement System (e-Procurement) for the Nigeria Immigration Service (NIS)

---

## 1. Introduction & Executive Summary

### 1.1. Purpose

Public procurement is a critical, high-risk government activity. The **Public Procurement Act (PPA) 2007** was established to mandate transparency, accountability, competition, and value for money in the use of public funds. The Nigeria Immigration Service (NIS), as a key Federal Government agency, conducts significant procurement activities that are often manual or semi-manual, leading to risks of non-compliance, delays, and weak audit trails.

This document presents the comprehensive system design for a **PPA-compliant Electronic Procurement System (e-Procurement)**. It is designed to automate, standardize, and secure all procurement activities within the NIS, serving as a single source of truth for management, technical teams, and oversight bodies.

### 1.2. System Objectives

The primary objective is to create a governance framework implemented through technology. The system will:

- Ensure **full and auditable compliance** with the Public Procurement Act (PPA) 2007.
- Promote **transparency and fairness** through open, competitive processes.
- Enforce **approval thresholds and separation of duties** automatically.
- Provide **end-to-end traceability** of every procurement action.
- **Reduce procurement cycle times** and administrative overhead.
- **Prevent fraud and manipulation** by making non-compliant actions technically impossible.
- Improve **data-driven decision-making** for management and oversight.

---

## 2. Legal and Governance Framework

### 2.1. Guiding Regulations

The system's design and workflows are strictly guided by:

- The **Public Procurement Act (PPA) 2007**
- Bureau of Public Procurement (BPP) Guidelines and Circulars
- Financial Regulations of the Federal Government
- The Nigerian Data Protection Act (NDPA)

### 2.2. Core Principle: Compliance by Design

The foundational principle of this architecture is **"Compliance by Design."** This means the system is engineered to enforce legal and regulatory requirements automatically. Actions not permitted by the PPA 2007 are technically impossible to perform, shifting the burden of compliance from manual oversight to automated system controls. This ensures that every procurement process is repeatable, lawful, and auditable by default.

---

## 3. End-to-End PPA-Compliant Procurement Workflow

The system digitizes and enforces the complete, end-to-end lifecycle of a procurement activity, from initial need to final audit. The workflow ensures that no single individual can control the process, embedding checks and balances at every stage.

### 3.1. Workflow Stages and Governance Value

**1. Needs Identification by User Department**  
A business need is formally identified and documented electronically.
*Governance Value:* Prevents arbitrary or undocumented spending.

**2. Annual Procurement Plan (APP) Validation**  
The system validates that the request exists within an approved APP, as required by **Section 16 of the PPA**. The process is halted if the item is not on the plan.
*Governance Value:* Eliminates off-plan and unbudgeted procurements.

**3. Procurement Request Initiation**  
An electronic procurement request is submitted with justification and cost estimates.
*Governance Value:* Creates a permanent, traceable record of intent and responsibility.

**4. Budget Availability and Threshold Check**  
The system automatically verifies budget provision and determines the correct approval authority based on monetary thresholds.
*Governance Value:* Prevents spending without appropriation and mitigates contract splitting.

**5. Approval by CGIS**  
The Comptroller General of Immigration Service provides mandatory authorization before tendering can commence, confirming compliance.
*Governance Value:* Establishes accountability at the highest responsible level.

**6. Tender Advertisement**  
Procurement opportunities are published using **Open Competitive Bidding** as the default method.
*Governance Value:* Promotes fairness, competition, and value for money.

**7. Vendor Registration and Bid Submission**  
Registered vendors submit encrypted bids electronically within defined timelines. Bids are inaccessible until the official opening.
*Governance Value:* Prevents bid tampering, late submissions, and unauthorized access.

**8. Public Bid Opening**  
The system performs a controlled bid opening at the exact advertised time, automatically generating a public bid opening record.
*Governance Value:* Guarantees transparency and public confidence in the process.

**9. Technical Evaluation**  
An independent committee assesses technical compliance without any access to financial data.
*Governance Value:* Prevents financial bids from influencing technical compliance decisions.

**10. Financial Evaluation**  
Only the financial bids of technically qualified vendors are opened and evaluated.
*Governance Value:* Protects the integrity and fairness of the evaluation outcome.

**11. Tenders Board Review and Approval**  
The appropriate Tenders Board reviews the evaluation outcomes and recommends an award.
*Governance Value:* Enforces collective decision-making to reduce individual bias.

**12. BPP “No Objection” Processing**  
Where thresholds are met, the procurement dossier is submitted to the Bureau of Public Procurement (BPP) for statutory clearance.
*Governance Value:* Provides external oversight and legal validation.

**13. Contract Award**  
An award letter and contract are issued only after all mandatory approvals and clearances are secured.
*Governance Value:* Prevents premature or unlawful contract awards.

**14. Contract Execution and Monitoring**  
The system tracks deliverables, milestones, and performance against the contract.
*Governance Value:* Links procurement decisions to actual service delivery and outcomes.

**15. Inspection, Acceptance, and Payment**  
Payment is processed only after goods, works, or services are certified as delivered and accepted.
*Governance Value:* Ensures value for money and prevents payment for non-performance.

**16. Audit and Compliance Reporting**  
All records, decisions, and actions are preserved in an immutable, time-stamped log for internal and external oversight.
*Governance Value:* Guarantees full transparency and provides a permanent institutional memory.

---

## 4. System Architecture

The system is designed using a modern, layered, microservices-based architecture to ensure security, scalability, and clear separation of concerns.

### 4.1. Architectural Principles

- **Microservices:** The system is decomposed into small, independent services, each responsible for a specific business capability (e.g., Bidding, Evaluation). This isolates failures, enhances security, and allows for independent upgrades.
- **Layered Design:** Functionality is separated into distinct layers (Presentation, Application, Data, Integration) to ensure that business logic is decoupled from user interfaces and data storage.
- **Security First:** The architecture prioritizes security at every layer, with encrypted communications, strong access control, and immutable audit logs.
- **Separation of Duties:** Both the workflow and the technical architecture enforce separation of duties, preventing any single role from controlling a process end-to-end.

### 4.2. High-Level Architectural Layers

**1. Presentation Layer**  
Provides secure, role-based web portals for all users. It handles user interaction only and contains no business logic.
*Stakeholders:* Internal NIS users (Procurement, Finance, Management) and External Vendors.

**2. Application (Business Logic) Layer**  
The core of the system, responsible for orchestrating workflows, enforcing PPA business rules, managing approval routing, and validating thresholds. This layer ensures all actions are compliant.

**3. Data Layer**  
Securely stores all procurement-related data, including plans, bids, evaluation records, contracts, and immutable audit logs. The design principle is the immutability of critical records to preserve audit integrity.

**4. Integration Layer**  
Manages secure communication with external and supporting systems, such as the Bureau of Public Procurement (BPP), email/SMS notification gateways, and financial systems.

---

## 5. Detailed Microservices Technology Stack

This section details the production-grade technology stack chosen to implement the architecture. The stack prioritizes open standards, long-term maintainability, and avoidance of vendor lock-in.

### 5.1. Naming Conventions

To ensure consistency across the entire ecosystem, the following naming conventions are strictly enforced:

- **Frontend (React/TypeScript):** All components, variables, properties, and types must use **PascalCase**.
- **Backend (.NET/C#):** All classes, methods, variables, and properties must use **PascalCase**.
- **Database (PostgreSQL):** All schemas, tables, and columns must use **snake_case**.

Mapping between backend PascalCase and database snake_case is handled at the data access layer (e.g., using Dapper or Entity Framework configurations).

### 5.2. Technology Stack Overview

| Layer | Proposed Technology | Justification |
|-------------------|---------------------------------------------|------------------------------------------------|
| **Frontend** | React + TypeScript | Modern, type-safe UI for complex applications. |
| **API Gateway** | Kong API Gateway | Centralized security, routing, and traffic control. |
| **Backend Services** | .NET 8 (Primary) / Java Spring Boot | Robust, enterprise-grade frameworks common in govt. |
| **Workflow Engine** | Camunda BPMN Engine | Explicit, auditable modeling of PPA workflows. |
| **Databases** | PostgreSQL (Primary), SQL Server (Legacy) | Open-source, reliable, and strong transactional integrity. |
| **Messaging** | RabbitMQ | Reliable, asynchronous communication between services. |
| **Authentication** | Keycloak (OIDC/OAuth2) | Centralized identity and access management (IAM). |
| **Containerization** | Docker | Standardized packaging for all microservices. |
| **Orchestration** | Kubernetes | Automated deployment, scaling, and management. |
| **Monitoring** | Prometheus + Grafana | Real-time visibility into system health and performance. |
| **Logging & Audit** | ELK Stack (Elasticsearch, Logstash, Kibana) | Centralized, searchable, and tamper-evident logging. |

### 5.2. Presentation Layer & Sitemap

The user interface is strictly role-driven, ensuring users only see and interact with functions relevant to their mandate.

#### 5.2.1. Public / Vendor Portal
- **Homepage:** Public tender listings.
- **Registration/Login:** For new and existing vendors.
- **Vendor Dashboard:**
  - Profile & Compliance Document Management
  - Tender Listings & Details
  - Secure Bid Submission Interface
  - Status of Submitted Bids

#### 5.2.2. Internal NIS System
- **General:** Role-Based Dashboard, Notifications, User Profile.
- **Requisitioning Departments:** Create & Track Requisitions.
- **Procurement Unit:** Manage Annual Procurement Plan (APP), Create & Publish Tenders, Manage Bid Opening.
- **Evaluation Committees:** Access Assigned Tenders, Perform Technical & Financial Evaluations.
- **Tenders Board / Approvers:** Review Evaluation Reports, Approve/Reject Recommendations.
- **CGIS:** Final review and approval for high-value tenders.
- **Post-Award Management:** Contract Generation, Milestone Tracking, Inspection & Acceptance.
- **Audit & Oversight:** Read-only access to audit trails and compliance reports.
- **System Administration (ICT):** User & Role Management, Workflow Configuration, System Health.

#### 5.2.3. Internal User Roles (Portal Access)
Internal users are provisioned in the Identity Service with strict role separation. Each role only sees the screens and actions required for its mandate.

- **Requisitioning Officer:** Initiate and track procurement requisitions for a department.
- **Department Head:** Review and approve departmental requisitions before procurement processing.
- **Procurement Officer:** Maintain APP, create tenders, publish adverts, manage bid opening sessions.
- **Procurement Manager:** Oversight of procurement operations, escalations, and compliance checks.
- **Technical Evaluator:** Conduct technical evaluation only (no access to financial bids).
- **Financial Evaluator:** Conduct financial evaluation only (only after technical qualification).
- **Tenders Board Member:** Review evaluation outcomes and approve or reject recommendations.
- **Tenders Board Secretary:** Manage board records, minutes, and formal submissions.
- **CGIS:** Final approval for high-value or regulated procurements.
- **BPP Liaison:** Submit and track "No Objection" requests and responses.
- **Contract Manager:** Generate awards and manage contract administration.
- **Inspection Officer:** Record inspection and acceptance of deliverables.
- **Payment Officer:** Track payment status post-acceptance.
- **Audit / Compliance Officer:** Read-only access to audit trails and compliance reports.
- **System Administrator (ICT):** User, role, and system configuration management.

### 5.3. Backend Microservices

The system's logic is encapsulated in the following core microservices. Each service is an independent component with its own data schema, enforcing a specific business capability.

| Microservice | Responsibility |
|----------------------------|----------------------------------------------------|
| **Identity Service** | Manages users, roles, and permissions (RBAC). |
| **Procurement Planning Service** | Manages Annual Procurement Plans (APPs). |
| **Request Service** | Handles procurement request initiation and validation. |
| **Budget & Threshold Service** | Verifies budget and checks approval thresholds. |
| **Tender Service** | Manages tender creation, advertisement, and lifecycle. |
| **Vendor Service** | Handles vendor registration, pre-qualification, and status. |
| **Bid Service** | Ensures secure, encrypted bid submission and storage. |
| **Evaluation Service** | Manages technical & financial evaluation processes. |
| **Approval Service** | Orchestrates Tenders Board and CGIS approvals. |
| **BPP Integration Service** | Manages "No Objection" processing with the BPP. |
| **Contract Service** | Handles contract award, generation, and management. |
| **Inspection Service** | Records inspection and acceptance of deliverables. |
| **Payment Tracking Service** | Tracks payment status against accepted deliverables. |
| **Audit & Compliance Service** | Provides immutable logs and generates compliance reports. |
| **Notification Service** | Sends email and SMS alerts for required actions. |

### 5.4. UI-to-Microservice Mapping

This table demonstrates the clear separation of duties by mapping user actions to the responsible backend service. This ensures no UI can bypass the required business logic.

| UI / Screen | Primary Microservice(s) | Governance & Control Purpose |
|----------------------------|-------------------------------|------------------------------------------------|
| **Login & Authentication** | Identity Service | Enforce strong, role-based access control. |
| **Procurement Requisition** | Request Service | Control the initiation of any procurement action. |
| **Procurement Planning (APP)** | Procurement Planning Service | Enforce legal compliance with PPA Section 16. |
| **Tender Creation** | Tender Service | Enforce correct procurement method and thresholds. |
| **Bid Submission** | Bid Service | Guarantee secure, confidential, and timely bid receipt. |
| **Bid Opening** | Tender Service / Bid Service | Ensure a timed, transparent, and public opening. |
| **Technical Evaluation** | Evaluation Service | Isolate technical scoring from financial influence. |
| **Financial Evaluation** | Evaluation Service | Ensure only technically qualified bids are evaluated. |
| **Approval Dashboard** | Approval Service | Route decisions to the correct Tenders Board/AO. |
| **BPP No-Objection** | BPP Integration Service | Fulfill statutory regulatory compliance checks. |
| **Contract Award** | Contract Service | Prevent award without all mandatory approvals. |
| **Inspection & Acceptance** | Inspection Service | Link payment directly to verified performance. |
| **Audit Trail Viewer** | Audit & Compliance Service | Provide immutable evidence for oversight. |
| **User & Role Management** | Identity Service | Enforce strict separation of duties. |

---

## 6. Security Architecture & Data Protection

Security is integral to the design, not an afterthought. The system implements a multi-layered security strategy to protect sensitive procurement data and ensure process integrity.

### 6.1. Core Security Controls

- **Authentication & Authorization:**
  - **Keycloak** provides centralized identity management using **OAuth2/OIDC** standards.
  - **Role-Based Access Control (RBAC)** is strictly enforced by the API Gateway and individual microservices. Users can only access data and functions permitted by their role.

- **Data Protection:**
  - **Encryption in Transit:** All communication between the frontend, API Gateway, and microservices is encrypted using **TLS 1.2/1.3**.
  - **Encryption at Rest:** Sensitive data within databases, especially bid information, is encrypted.
  - **Data Immutability:** Critical records (e.g., bids, approvals, audit logs) are designed to be immutable to prevent tampering.

- **Process Integrity:**
  - **JWT (JSON Web Tokens):** Securely transmit identity and permissions between services.
  - **Digital Signatures & Timestamps:** Used for critical actions like approvals and bid submissions to ensure non-repudiation.

- **Compliance:**
  - The architecture is designed to comply with the **Nigerian Data Protection Act (NDPA)**, ensuring lawful processing and protection of personal and corporate data.

---

## 7. Deployment, Hosting, and Operations

### 7.1. Containerization and Orchestration

- **Docker:** All microservices are packaged into standardized, lightweight Docker containers. This ensures consistency across development, testing, and production environments.
- **Kubernetes:** Kubernetes is used to orchestrate the containers, providing automated deployment, scaling, self-healing, and high availability.

### 7.2. Hosting Model

The system is designed for flexible deployment to meet government data sovereignty and security requirements.

- **Option 1: On-Premise Government Data Centre (Recommended):** Provides full control over infrastructure and data, ensuring data residency and maximum security.
- **Option 2: Hybrid Cloud:** A model where sensitive services (e.g., Bidding, Databases) are hosted on-premise, while less sensitive components (e.g., public-facing web servers) can reside in a secure, certified government or private cloud.

### 7.3. Monitoring, Logging, and Auditability

Operational transparency is critical for governance and troubleshooting.

- **Monitoring:** **Prometheus** collects real-time metrics from all system components, and **Grafana** provides dashboards for visualizing system health, performance, and alerts.
  *Governance Value:* Enables proactive identification of issues and provides visibility into system usage.

- **Logging:** The **ELK Stack (Elasticsearch, Logstash, Kibana)** provides a centralized logging solution. All actions, errors, and system events are collected, indexed, and made searchable.
  *Governance Value:* Creates a tamper-evident, centralized audit trail that serves as irrefutable evidence for any investigation or compliance review. Auditors can be given read-only access to specific dashboards.

---

### 7.4. Recent Backend Update (2026-03-06)
- Build stabilization: added backend-wide global usings for ASP.NET Core types via `Backend/Directory.Build.props`.
- Middleware fixes: explicit usings added to shared middleware to ensure `HttpContext`, `RequestDelegate`, and `ILogger<>` resolve consistently.
- Static web assets build fix: set `PackageId` in `Backend/eProcurement.Api/eProcurement.Api.csproj` to prevent static web assets manifest errors.
- Build command now uses the local SDKs path and bundled versions props to avoid workload resolver and SDK path issues in the sandbox environment.

---

## 8. Conclusion: A Framework for Governance

The proposed Electronic Procurement System is more than a tool for automation; it is a **governance framework implemented through technology**.

By embedding the requirements of the Public Procurement Act directly into a secure, resilient, and transparent microservices architecture, the Nigeria Immigration Service can achieve significant benefits:

- **Improved Governance:** Drastically reduces opportunities for fraud, waste, and abuse.
- **Enhanced Transparency:** Builds public trust and provides clear visibility for oversight bodies.
- **Operational Efficiency:** Reduces procurement cycle times and frees up personnel for strategic tasks.
- **Stronger Accountability:** Creates an immutable record that clearly assigns responsibility for every action and decision.

This system positions the NIS as a leader in digital public sector reform and procurement best practices, ensuring that the use of public funds is efficient, effective, and fully compliant with the law.
