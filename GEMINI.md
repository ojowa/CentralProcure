# CentralProcure: AI Engineering Instructions

This document provides foundational mandates for any AI agent working on the CentralProcure (NIS e-Procurement) codebase. These instructions take precedence over general defaults.

## 1. Core Mission & Compliance
- **System Purpose:** Internal e-Procurement system for the Nigeria Immigration Service (NIS).
- **Statutory Mandate:** Absolute adherence to the **Public Procurement Act (PPA) 2007**.
- **Threshold Routing:** Logic must always check if a project is "Low-Value" (CGIS), "Board-Level" (Tenders Board), or "High-Value" (BPP Prior Review).
- **Timeline Integrity:** PPA-mandated durations (e.g., 42-day minimum advertising for NCB) must be enforced or explicitly flagged as exceptions.

## 2. Technical Stack & Casing Standards
- **Backend:** .NET 10 Web API (Modular Monolith architecture).
- **Frontend:** Next.js (TypeScript) with Vanilla/Tailwind CSS.
- **Database:** Microsoft SQL Server (per memory, strictly). 
- **Casing Mandate:** 
    - **DTOs & API Payloads:** ALWAYS use `PascalCase` for property names (e.g., `TenderId`, `Status`).
    - **Frontend State:** Internal module form states must match backend PascalCase DTOs to ensure seamless serialization.
    - **Database Columns:** Use `snake_case` in migrations and underlying tables.

## 3. Code Locality & Size Limit
- **Line Limit:** **MAXIMUM 400 LINES PER FILE.**
- **Refactoring Mandate:** If any file exceeds or is approaching 400 lines, it must be refactored into smaller, logical sub-components or services immediately.
- **Complexity Management:** Prioritize "Small Files, Single Responsibility" to maintain context efficiency and readability.

## 4. Frontend: Internal Shell Architecture
- **Role-Based Workspaces:** The UI is structured into role-specific "Workspaces".
- **Module Integration:** New features must be registered in `InternalShellLayout.tsx` and mapped to the `moduleRenderers` object.
- **Action Enforcement:** Use the `grantedActions` set to conditionally hide/disable UI elements based on the backend's workflow action model.

## 5. Backend: Workflow & Security
- **Stored Procedures:** All write operations (Create/Update) MUST be performed via stored procedures.
- **Workflow Runtime:** Every entity (Tender, Requisition, Contract) must be synced with the `WorkflowRuntimeTracker`.
- **RBAC:** Never hardcode role checks in controllers; use the `WorkflowActionGrantService`.

## 6. Verification & Validation
- **Phase 9 Pack:** Run `scripts/verify-phase9-workflow.ps1` after significant workflow changes.
- **Build Integrity:** A task is not complete until `npm run build` (Frontend) and `dotnet build` (Backend) pass.

## 7. Project-Specific Memory
- **Server Name:** OJOWA-PC.
- **Deployment:** Azure Hybrid (On-prem persistence with cloud-ready API).
