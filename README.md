# Project: PPA-Compliant Electronic Procurement System for the Nigeria Immigration Service (NIS)

## 1. Overview

This repository contains the complete system design and architecture documentation for a PPA-compliant Electronic Procurement System (e-Procurement) for the Nigeria Immigration Service (NIS). The system's primary objective is to automate, standardize, and secure all procurement activities, ensuring full compliance with the **Public Procurement Act (PPA) 2007**.

The core principle of this project is **"Compliance by Design,"** meaning the system is engineered to make non-compliant actions technically impossible, thereby embedding governance and transparency directly into the technology.

## 2. Documentation Guide

This project is documented across several markdown files, each tailored for a specific audience and purpose. For a complete understanding, it is recommended to start with the comprehensive design document.

### Primary Document

-   **`comprehensive_system_design_and_architecture.md`**: This is the master document. It integrates all aspects of the system design, from the legal framework and workflow to the detailed microservices architecture and technology stack. **All stakeholders should start here.**

### Appendices & Supporting Documents

These documents provide deeper dives into specific areas and were used to create the comprehensive document.

-   **`electronic_procurement_system_proposal_nigeria_immigration_service.md`**: The original high-level proposal outlining the project's objectives, scope, and benefits.
    -   *Audience: Management, Decision-Makers*

-   **`appendix_a_procurement_workflow_and_system_architecture_explanation.md`**: A plain-language explanation of the procurement workflow and system architecture, aligned with the PPA 2007.
    -   *Audience: Management, Tenders Boards, Oversight Bodies*

-   **`appendix_b_technology_phase.md`**: A high-level overview of the technology implementation phase, focusing on governance, security, and reliability.
    -   *Audience: Management, ICT Leadership*

-   **`appendix_c_detailed_microservices_technology_stack.md`** & **`appendix_d_full_microservices_based_technology_stack_proposal.md`**: Detailed proposals for the production-grade microservices technology stack.
    -   *Audience: Architects, Technical Leads, ICT Leadership*

-   **`appendix_e_ui_to_microservice_mapping_table.md`**: A crucial table that maps user interface screens to their governing backend microservices, demonstrating the enforcement of separation of duties.
    -   *Audience: Architects, Developers, Auditors*

-   **`appendix_f_ui_wireframe_list_and_sitemap.md`**: A sitemap and list of UI wireframes, illustrating user navigation and the role-based structure of the application.
    -   *Audience: UI/UX Designers, Frontend Developers, Product Managers*

-   **`workflow_and_architecture_diagram_references.md`**: Formal descriptions of the workflow and architecture diagrams used throughout the documentation.
    -   *Audience: All stakeholders needing to understand the diagrams.*

## 3. Core Architectural Concepts

-   **Layered Architecture**: The system is separated into Presentation, Application, Data, and Integration layers to ensure a clear separation of concerns.
-   **Microservices**: The backend is decomposed into small, independent services, each responsible for a specific business capability (e.g., Bidding, Evaluation, Approvals). This enhances security, scalability, and maintainability.

## 4. Technology Stack Summary

-   **Frontend**: The project has two separate frontend applications:
    -   `public-frontend`: A React (TypeScript) application for vendors.
    -   `internal-frontend`: A placeholder for the internal NIS staff UI, also to be built with React (TypeScript).
-   **Backend**: C#/.NET
-   **API Gateway**: Kong
-   **Database**: PostgreSQL (Primary)
-   **Authentication**: JWT (for backend statelessness)
-   **Workflow**: Camunda BPMN Engine
-   **Messaging**: RabbitMQ
-   **Containerization**: Docker & Kubernetes
-   **Monitoring & Logging**: Prometheus, Grafana, ELK Stack

## 5. Instructions for Gemini (and other AI Assistants)

When asked to analyze, summarize, or generate code for this project, please adhere to the following:

1.  **Prioritize `comprehensive_system_design_and_architecture.md`** as the single source of truth for the overall design.
2.  Use the appendices (`appendix_*.md` files) for more granular detail on specific topics when required.
3.  Recognize the strict "Compliance by Design" principle. All generated code, workflows, or suggestions must align with the PPA-compliant workflow described in the documents.
4.  The technology stack is explicitly defined. Do not suggest alternative technologies unless specifically asked to.
5.  Maintain the principle of separation of duties in any proposed architecture or code, referencing the UI-to-Microservice mapping in `appendix_e_ui_to_microservice_mapping_table.md` as a guide.
6.  **Distinguish clearly between the Public (Vendor) UI and the Internal (NIS) UI.** Focus on the Public UI unless explicitly directed otherwise.

### 5.1. Coding Standards & Naming Conventions

To maintain consistency across the project, the following standards are mandatory:

-   **Frontend (React/TypeScript):** Use **PascalCase** for all components, variables, properties, and types.
-   **Backend (.NET/C#):** Use **PascalCase** for all classes, methods, variables, and properties.
-   **Database (PostgreSQL):** Use **snake_case** for all schemas, tables, and columns.
