# Standard Operating Procedure

## Document Control

**Document Title:** CentralProcure Project Standard Operating Procedure  
**Document ID:** CP-SOP-001  
**Version:** 1.0  
**Effective Date:** 2026-04-06  
**Review Date:** 2026-05-06  
**Document Owner:** Project Maintainer  
**Approved By:** ____________________  
**Prepared By:** ____________________  
**Status:** Draft for Internal Approval

## 1. Purpose

This Standard Operating Procedure defines the standard method for planning, developing, validating, publishing, deploying, and maintaining the CentralProcure platform.

The objective is to ensure that all work on the project is:

- compliant with the Public Procurement Act (PPA) 2007
- technically consistent across backend, frontend, and database layers
- released through a controlled Git and deployment process
- traceable through documented approvals, checks, and revision history

## 2. Scope

This SOP applies to all contributors, reviewers, maintainers, release operators, and technical administrators working on the CentralProcure repositories and deployment environments.

It covers:

- business-rule implementation
- software development workflow
- code review and validation
- Git commit and publishing procedures
- deployment preparation and release checks
- exception handling
- document governance

## 3. System Overview

CentralProcure is an internal e-Procurement platform for the Nigeria Immigration Service. The project is maintained as a monorepo with split publication to backend-only and frontend-only repositories.

Primary repository structure:

- `origin`: monorepo root
- `backend`: repository derived from `Backend/`
- `frontend`: repository derived from `Frontend/`

Key directories:

- `Backend/`: .NET 10 Web API
- `Frontend/`: Next.js application
- `database_schema/`: schema and database design materials
- `scripts/`: project automation scripts
- `design notes/`: architecture, compliance, workflow, and UI reference materials

## 4. Reference Documents

The following project documents support this SOP:

- [Agent.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Agent.md)
- [Backend/README.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Backend\README.md)
- [Frontend/README.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Frontend\README.md)
- [scripts/publish-all-remotes.ps1](C:\Users\OJOWA\Documents\Project 4\CentralProcure\scripts\publish-all-remotes.ps1)
- [design notes/compliance/PPA2007.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\compliance\PPA2007.md)
- [design notes/compliance/current_procurement_workflow.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\compliance\current_procurement_workflow.md)
- [design notes/architecture/system_design.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\architecture\system_design.md)

## 5. Definitions

- **PPA 2007:** Public Procurement Act 2007 governing statutory procurement processes.
- **Monorepo:** The main repository containing backend, frontend, scripts, and shared project artifacts.
- **Subtree Push:** Git publication method used to push `Backend/` and `Frontend/` into their respective split repositories.
- **Release Operator:** Person responsible for controlled push and deployment execution.
- **Change Owner:** Person implementing and documenting a change.

## 6. Roles and Responsibilities

### 6.1 Change Owner

The Change Owner shall:

- confirm the business requirement and system impact
- implement the required change
- ensure adherence to naming, workflow, and compliance rules
- complete pre-commit validation
- document any blockers or deviations

### 6.2 Reviewer or Maintainer

The Reviewer or Maintainer shall:

- verify technical correctness
- assess compliance impact
- check that validation has been completed
- confirm that the release path is safe

### 6.3 Release Operator

The Release Operator shall:

- verify repository state before publishing
- publish to the correct remotes
- avoid unsafe history rewrites
- confirm deployment variables and smoke checks

### 6.4 Project Maintainer

The Project Maintainer shall:

- keep this SOP current
- approve or reject procedural exceptions
- ensure revision history is maintained

## 7. Policy Requirements

The following rules are mandatory:

1. Procurement workflow logic shall comply with PPA 2007.
2. Threshold routing shall distinguish low-value, board-level, and BPP prior review flows.
3. Mandatory statutory timelines shall be enforced or explicitly flagged.
4. Backend DTOs and API payloads shall use `PascalCase`.
5. Frontend state used for backend payload binding shall use `PascalCase`.
6. Database tables, schemas, and columns shall use `snake_case`.
7. Backend create and update operations shall use stored procedures.
8. Role-based authorization shall use workflow and RBAC services rather than hardcoded controller checks.
9. Files should remain under 400 lines where practical and should be refactored when complexity increases.
10. Secrets shall not be committed to source control.
11. Split repositories shall be published through subtree operations, not direct monorepo branch pushes.

## 8. Standard Operating Procedure

### 8.1 Initiation of Work

Before implementation begins, the Change Owner shall:

1. identify the business objective
2. identify whether the change affects backend, frontend, database, workflow, or deployment
3. determine whether the change has compliance impact
4. identify required environment variables, routes, stored procedures, and deployment implications

### 8.2 Development Procedure

The Change Owner shall follow these controls during implementation:

1. preserve route contracts unless an approved migration changes them
2. maintain project casing rules across all touched layers
3. keep backend write logic aligned with stored procedures
4. ensure workflow-tracked entities remain synchronized with workflow runtime behavior
5. avoid introducing oversized files when a refactor is more appropriate
6. avoid deleting deployment files without confirming the target hosting strategy

### 8.3 Local Backend Procedure

Backend work shall be executed from `Backend/`.

Standard commands:

```powershell
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:DOTNET_CLI_HOME='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet'
$env:MSBuildEnableWorkloadResolver='false'
dotnet restore ".\eProcurement.Api.csproj"
dotnet build ".\eProcurement.Api.csproj" -v:minimal --no-restore
dotnet run --project ".\eProcurement.Api.csproj"
```

### 8.4 Local Frontend Procedure

Frontend work shall be executed from `Frontend/`.

Standard commands:

```powershell
npm install
npm run build
npm run start
```

`NEXT_PUBLIC_BACKEND_URL` shall be set correctly for production-oriented builds.

### 8.5 Validation Procedure

Before a commit is created, the Change Owner shall complete the following where applicable:

1. review `git status`
2. review the diff for unintended changes
3. build the backend
4. build the frontend
5. confirm configuration changes are documented
6. verify workflow-sensitive behavior if the change touches procurement flow
7. record any checks that could not be completed and the reason

Minimum validation commands:

```powershell
cd Backend
dotnet build ".\eProcurement.Api.csproj"
```

```powershell
cd Frontend
npm run build
```

### 8.6 Commit Procedure

Commits shall follow this sequence:

1. stage only intended files
2. write a clear scoped commit message
3. ensure the worktree is understood before commit
4. avoid bundling unrelated changes into the same commit

Example commit message patterns:

- `feat: add requisition approval audit trail`
- `fix: correct tender timeline validation`
- `ci: remove backend Azure deploy workflow`
- `chore: synchronize repository changes`

### 8.7 Publish Procedure

#### Monorepo Publication

Publish the main repository using:

```powershell
git push origin main
```

#### Split Repository Publication

Publish split repositories using the project script:

```powershell
.\scripts\publish-all-remotes.ps1
```

This executes:

```powershell
git push origin main
git subtree push --prefix=Backend backend main
git subtree push --prefix=Frontend frontend main
```

#### Publishing Controls

The Release Operator shall observe the following:

1. do not push the monorepo branch directly to `backend` or `frontend`
2. use subtree publication for split repositories
3. if a split push is rejected, fetch and inspect divergence before retrying
4. do not force-push split repositories unless explicitly approved
5. if histories diverge, determine whether the remote contains valid changes before overwrite is considered

### 8.8 Deployment Preparation Procedure

#### Backend

- deployment source: `Backend/`
- blueprint file: [Backend/render.yaml](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Backend\render.yaml)
- required variables:
  - `ConnectionStrings__Primary`
  - `Jwt__Key`
  - `Jwt__Issuer`
  - `Jwt__Audience`
  - `ASPNETCORE_ENVIRONMENT`

#### Frontend

- deployment source: `Frontend/`
- blueprint file: [Frontend/render.yaml](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Frontend\render.yaml)
- required variables:
  - `NEXT_PUBLIC_BACKEND_URL`
  - `NEXT_PUBLIC_APP_BASE_PATH` when serving from a subpath

### 8.9 Post-Deployment Verification

After deployment, the Release Operator shall verify:

1. the backend health endpoint responds
2. the frontend points to the intended backend environment
3. authentication flows function correctly
4. critical procurement routes and dashboards load correctly
5. no environment variable required by the release is missing

## 9. Exception Management

Any deviation from this SOP shall be documented and approved by the Project Maintainer or designated approver before execution where practical.

Exception records shall include:

- description of the deviation
- reason for deviation
- risk introduced
- mitigating controls
- approver name
- approval date

## 10. Risk Controls

The following risk controls shall be observed at all times:

- do not remove deployment workflows without verifying the intended deployment replacement
- do not rewrite remote history during normal publication
- do not assume split remotes are identical without fetching and checking history
- do not mix backend, frontend, and infrastructure changes into one uncontrolled release without verification
- do not ship undocumented environment variable changes

## 11. Records and Evidence

The following records should be retained for each release or significant change:

- commit hash
- build result evidence
- published branch or subtree result
- deployment target
- smoke test outcome
- exception approval if applicable

## 12. Release Checklist

Use this checklist before closing a release activity:

- requirement confirmed
- impacted modules identified
- compliance impact reviewed
- backend build completed
- frontend build completed
- configuration updates documented
- commit created
- `origin` pushed
- subtree remotes published if required
- deployment variables verified
- smoke tests completed
- exceptions recorded if any

## 13. Approval Sign-Off

Prepared by: ____________________  
Signature: ____________________  
Date: ____________________

Reviewed by: ____________________  
Signature: ____________________  
Date: ____________________

Approved by: ____________________  
Signature: ____________________  
Date: ____________________

## 14. Revision History

| Version | Date       | Description                                         | Author |
|---------|------------|-----------------------------------------------------|--------|
| 1.0     | 2026-04-06 | Initial formal SOP for CentralProcure project flow | Codex  |
