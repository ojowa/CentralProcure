# Standard Operating Procedure

## Document Control Information

**Document Title:** Standard Operating Procedure for CentralProcure Project Governance, Development, Release, and Deployment  
**Document ID:** NIS-ICT-CP-SOP-001  
**Version:** 1.0  
**Effective Date:** 2026-04-06  
**Next Review Date:** 2026-05-06  
**Document Status:** Draft for Management Review  
**Confidentiality Classification:** Internal Use Only  
**Owning Department:** ICT Directorate / Digital Procurement Systems Unit  
**System Owner:** Nigeria Immigration Service  
**Project Name:** CentralProcure  
**Custodian of Record:** Project Maintainer / Designated Technical Lead

## Authority

This SOP is issued under the authority of the responsible ICT and project governance leadership overseeing the CentralProcure platform for the Nigeria Immigration Service.

It provides the approved operating framework for:

- software development
- compliance control
- repository publication
- deployment readiness
- operational release assurance

No team member shall deviate from this procedure except through documented approval under the exception management section of this document.

## Purpose

The purpose of this SOP is to establish a uniform and auditable method for managing the CentralProcure software project throughout its development and release lifecycle.

This document is intended to ensure that project activities are:

- aligned with the Public Procurement Act (PPA) 2007
- technically consistent across backend, frontend, and database systems
- properly validated before publication or deployment
- traceable through approvals, records, and revision history

## Scope

This SOP applies to all personnel, contractors, consultants, maintainers, reviewers, and release operators who contribute to or manage the CentralProcure project.

It covers:

- requirements handling
- software development
- code review and technical validation
- commit and repository publication workflow
- deployment preparation and release checks
- exception approval and recordkeeping

## Distribution List

This document should be distributed to:

- ICT Directorate leadership
- project technical leads
- backend developers
- frontend developers
- DevOps or release operators
- quality assurance personnel
- compliance and governance stakeholders where applicable

## Related Documents

The following project documents support this SOP:

- [SOP.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\SOP.md)
- [Agent.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Agent.md)
- [Backend/README.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Backend\README.md)
- [Frontend/README.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Frontend\README.md)
- [scripts/publish-all-remotes.ps1](C:\Users\OJOWA\Documents\Project 4\CentralProcure\scripts\publish-all-remotes.ps1)
- [design notes/compliance/PPA2007.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\compliance\PPA2007.md)
- [design notes/compliance/current_procurement_workflow.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\compliance\current_procurement_workflow.md)
- [design notes/architecture/system_design.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\architecture\system_design.md)

## System Context

CentralProcure is an internal e-Procurement platform for the Nigeria Immigration Service. It is maintained as a monorepo with controlled publication to split repositories for backend and frontend delivery.

Repository structure:

- `origin`: monorepo
- `backend`: split repository derived from `Backend/`
- `frontend`: split repository derived from `Frontend/`

Primary directories:

- `Backend/`: .NET 10 Web API
- `Frontend/`: Next.js application
- `database_schema/`: schema and database reference materials
- `scripts/`: automation and release utilities
- `design notes/`: architecture, compliance, workflow, and design references

## Definitions

- **PPA 2007:** Public Procurement Act 2007.
- **Change Owner:** Officer or contributor responsible for implementing a requested change.
- **Reviewer:** Officer responsible for technical, quality, or compliance review.
- **Release Operator:** Officer responsible for controlled publication and deployment actions.
- **Monorepo:** Main source repository containing all project layers.
- **Subtree Push:** Git publication method used to publish `Backend/` and `Frontend/` to their dedicated remotes.

## Roles and Responsibilities

### Project Sponsor or Authorizing Officer

The Project Sponsor or Authorizing Officer shall:

- provide strategic direction
- approve major procedural changes where required
- endorse production release governance when necessary

### ICT Directorate or Owning Department

The Owning Department shall:

- maintain oversight of the project lifecycle
- ensure the system remains aligned with institutional objectives
- designate the document owner and release authority

### Document Owner

The Document Owner shall:

- keep this SOP current
- initiate scheduled reviews
- maintain revision history
- ensure obsolete versions are withdrawn or marked superseded

### Change Owner

The Change Owner shall:

- understand the requirement before implementation
- identify affected modules and compliance implications
- implement changes in line with project rules
- complete validation before commit
- document any unresolved issue or exception

### Reviewer or Technical Lead

The Reviewer or Technical Lead shall:

- review correctness and quality
- verify workflow and compliance implications
- confirm that validation evidence is sufficient
- reject unsafe or incomplete release candidates

### Release Operator

The Release Operator shall:

- confirm repository readiness before push
- publish to the correct remotes using approved methods
- verify deployment configuration and smoke checks
- avoid unsafe history rewriting without explicit approval

## Governing Policy Requirements

The following requirements are mandatory for all project work:

1. All procurement workflow logic shall comply with the Public Procurement Act 2007.
2. Threshold routing shall distinguish low-value, board-level, and BPP prior review cases.
3. Statutory procurement timelines shall be enforced or explicitly flagged.
4. Backend DTOs and API payloads shall use `PascalCase`.
5. Frontend state aligned to backend payloads shall use `PascalCase`.
6. Database tables, schemas, and columns shall use `snake_case`.
7. Backend create and update operations shall use stored procedures.
8. Authorization shall rely on approved workflow and RBAC services, not hardcoded controller logic.
9. Large files should be refactored before they become difficult to maintain.
10. Secrets and sensitive credentials shall not be committed into source control.
11. Split repositories shall be published through subtree methods, not by pushing the monorepo branch directly.

## Procedure

### 1. Requirement Intake and Classification

Before development begins, the Change Owner shall:

1. identify the purpose of the requested change
2. determine whether it affects backend, frontend, database, workflow, deployment, or compliance
3. identify whether the change impacts statutory timelines, thresholds, approvals, or workflow states
4. identify all environment variables, stored procedures, routes, and repositories affected

### 2. Development Control

During implementation, the Change Owner shall:

1. preserve approved route contracts unless an authorized migration requires change
2. maintain naming conventions and case consistency
3. ensure write-path operations remain aligned with stored procedures
4. keep workflow-tracked entities synchronized with workflow behavior
5. avoid deleting release or deployment artifacts without confirming the replacement process
6. keep related changes logically grouped and avoid unrelated edits

### 3. Local Backend Operating Procedure

Perform backend work from `Backend/`.

Standard commands:

```powershell
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:DOTNET_CLI_HOME='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet'
$env:MSBuildEnableWorkloadResolver='false'
dotnet restore ".\eProcurement.Api.csproj"
dotnet build ".\eProcurement.Api.csproj" -v:minimal --no-restore
dotnet run --project ".\eProcurement.Api.csproj"
```

### 4. Local Frontend Operating Procedure

Perform frontend work from `Frontend/`.

Standard commands:

```powershell
npm install
npm run build
npm run start
```

Ensure `NEXT_PUBLIC_BACKEND_URL` is correctly defined for production-oriented builds.

### 5. Validation and Quality Assurance Procedure

Before a commit is created, the Change Owner shall:

1. inspect `git status`
2. inspect the diff for unintended edits
3. build the backend
4. build the frontend
5. verify any affected configuration changes are documented
6. verify workflow-sensitive behavior if the change affects procurement flow
7. record any validation step that could not be completed and state the reason

Minimum commands:

```powershell
cd Backend
dotnet build ".\eProcurement.Api.csproj"
```

```powershell
cd Frontend
npm run build
```

### 6. Commit Control Procedure

Commits shall follow the controls below:

1. only intended files shall be staged
2. commit messages shall be clear and scoped
3. unrelated changes shall not be bundled into the same commit
4. validation should be complete before commit unless an approved exception exists

Example commit message formats:

- `feat: add requisition approval audit trail`
- `fix: correct tender timeline validation`
- `ci: remove backend Azure deploy workflow`
- `chore: synchronize repository changes`

### 7. Repository Publication Procedure

#### 7.1 Monorepo Publication

Use:

```powershell
git push origin main
```

#### 7.2 Split Repository Publication

Use:

```powershell
.\scripts\publish-all-remotes.ps1
```

This runs:

```powershell
git push origin main
git subtree push --prefix=Backend backend main
git subtree push --prefix=Frontend frontend main
```

#### 7.3 Publication Controls

The Release Operator shall:

1. not push the monorepo branch directly to `backend` or `frontend`
2. use subtree publication for split repositories
3. fetch and inspect divergence if a split push is rejected
4. avoid force-push activity unless explicitly approved and documented
5. verify whether the remote contains valid changes before any overwrite is considered

### 8. Deployment Preparation Procedure

#### Backend

- source directory: `Backend/`
- deployment blueprint: [Backend/render.yaml](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Backend\render.yaml)
- required environment variables:
  - `ConnectionStrings__Primary`
  - `Jwt__Key`
  - `Jwt__Issuer`
  - `Jwt__Audience`
  - `ASPNETCORE_ENVIRONMENT`

#### Frontend

- source directory: `Frontend/`
- deployment blueprint: [Frontend/render.yaml](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Frontend\render.yaml)
- required environment variables:
  - `NEXT_PUBLIC_BACKEND_URL`
  - `NEXT_PUBLIC_APP_BASE_PATH` where applicable

### 9. Post-Deployment Verification Procedure

After deployment, the Release Operator shall verify:

1. the backend health endpoint responds correctly
2. the frontend is connected to the intended backend environment
3. login and authentication flows work
4. critical dashboards and procurement routes load successfully
5. required environment variables are present in the target environment

## Exception Management

Any deviation from this SOP shall be documented and approved by the designated authority before execution where practicable.

Exception records shall state:

- description of the deviation
- reason for the deviation
- risk introduced
- controls applied
- approving officer
- approval date

## Records Management

The following release or change records should be retained:

- change description
- commit hash
- build evidence
- publication result
- deployment target
- smoke test outcome
- approved exceptions where applicable

## Compliance and Audit Notes

This SOP should be reviewed during internal technical audits, release reviews, or compliance assurance exercises relating to the CentralProcure platform.

Evidence of adherence should include:

- repository history
- build records
- deployment logs
- release notes
- exception approvals

## Review and Amendment Procedure

This document shall be reviewed:

- monthly during active implementation, or
- immediately after any major architecture, release, compliance, or deployment process change

Amendments shall:

1. be versioned
2. be recorded in the revision table
3. identify the nature of the update
4. be approved through the same governance channel used for the original document

## Approval and Sign-Off

**Prepared By**  
Name: ____________________  
Title: ____________________  
Signature: ____________________  
Date: ____________________

**Reviewed By**  
Name: ____________________  
Title: ____________________  
Signature: ____________________  
Date: ____________________

**Approved By**  
Name: ____________________  
Title: ____________________  
Signature: ____________________  
Date: ____________________

## Revision History

| Version | Date       | Description                                                        | Author |
|---------|------------|--------------------------------------------------------------------|--------|
| 1.0     | 2026-04-06 | Initial institutional SOP draft for CentralProcure project control | Codex  |
