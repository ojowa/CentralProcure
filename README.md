# Project: PPA-Compliant Electronic Procurement System for the Nigeria Immigration Service (NIS)

## 1. Overview

This repository contains the complete system design and architecture documentation for a PPA-compliant Electronic Procurement System (e-Procurement) for the Nigeria Immigration Service (NIS). The system's primary objective is to automate, standardize, and secure all procurement activities, ensuring full compliance with the **Public Procurement Act (PPA) 2007**.

The core principle of this project is **"Compliance by Design,"** meaning the system is engineered to make non-compliant actions technically impossible, thereby embedding governance and transparency directly into the technology.

## 2. Documentation Guide

The project documentation is organized into logical categories within the `design notes/` directory.

### 2.1. Compliance Documentation
*Focus: Statutory adherence to the PPA 2007, workflows, and state tracking.*

- [**PPA2007.md**](./design%20notes/compliance/PPA2007.md): The full text of the Public Procurement Act, 2007.
- [**Workflow Blueprint**](./design%20notes/compliance/workflow_blueprint.md): The canonical BPMN-style process flow and state machine.
- [**Implementation TODO**](./design%20notes/compliance/implementation_todo.md): Pragmatic execution checklist for workflow enforcement.
- [**State Coverage Matrix**](./design%20notes/compliance/state_matrix.md): Baseline audit of implemented vs. missing workflow states.
- [**Phase 9 Verification Pack**](./design%20notes/compliance/phase9_verification.md): Repeatable evidence set for workflow implementation.
- [**Budget Gaps Analysis**](./design%20notes/compliance/budget_gaps_analysis.md): Analysis of budget implementation and PPA 2007 alignment.

### 2.2. Architecture Documentation
*Focus: System design, technology stack, and backend consolidation.*

- [**System Design (Master Doc)**](./design%20notes/architecture/system_design.md): The integrated master document for system architecture. **Start here.**
- [**Workflow Architecture**](./design%20notes/architecture/workflow_architecture.md): Plain-language explanation of the system architecture.
- [**Technology Implementation**](./design%20notes/architecture/technology_implementation.md): Overview of implementation phases and standards.
- [**Microservices Stack**](./design%20notes/architecture/microservices_stack.md): Detailed 5-service consolidated technology stack.
- [**Microservices Proposal**](./design%20notes/architecture/microservices_proposal.md): Production-grade technology stack proposal.
- [**Backend Consolidation**](./design%20notes/architecture/backend_consolidation.md): Mapping for consolidating into the 5-service model.
- [**Diagram References**](./design%20notes/architecture/diagram_references.md): Formal descriptions of architecture and workflow diagrams.

### 2.3. UI-UX & Modules
*Focus: User interface mapping and feature-specific designs.*

- [**Sitemap & Wireframes**](./design%20notes/ui-ux/sitemap_and_wireframes.md): UI structure and navigation flow.
- [**UI-to-Backend Mapping**](./design%20notes/ui-ux/ui_mapping.md): Table mapping UI screens to governing microservices.
- [**Module Designs**](./design%20notes/modules/): Directory containing specific designs for Tender Management, Evaluation, Bid Opening, etc.

### 2.4. Proposals
*Focus: High-level executive summaries and proposals.*

- [**Executive Proposal**](./design%20notes/proposals/executive_proposal.md): The original project proposal for NIS management.

## 3. Core Architectural Concepts

- **Layered Architecture**: The system is separated into Presentation, Application, Data, and Integration layers to ensure a clear separation of concerns.
- **Consolidated Microservices**: The backend is organized into five domain-aligned services (`identity`, `vendor-sourcing`, `procurement-workflow`, `post-award`, and `governance`).

## 4. Technology Stack Summary

- **Frontend**: Next.js (TypeScript) with React.
- **Backend**: .NET 10 (ASP.NET Core).
- **Database**: Microsoft SQL Server (strictly enforced for persistence).
- **API Style**: RESTful APIs with JWT authentication.
- **Workflow**: WorkflowRuntimeTracker (integrated into domain services).

## 5. Instructions for AI Assistants

When asked to analyze or generate code for this project, please adhere to:

1. **Prioritize `architecture/system_design.md`** as the single source of truth.
2. **Follow "Compliance by Design"**: All logic must align with the PPA 2007 workflow.
3. **Respect Casing Mandates**:
   - **Frontend/Backend:** `PascalCase` for code identifiers and API payloads.
   - **Database:** `snake_case` for tables and columns.
4. **Adhere to the 400-Line Limit**: Refactor files that exceed 400 lines into logical sub-components.
5. **Use Stored Procedures**: All write operations (Create/Update) MUST use stored procedures.
