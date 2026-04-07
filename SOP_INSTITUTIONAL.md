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
12. Low-value procurement cases shall proceed to direct `CGIS Approval` after completion of the required planning, procurement preparation, and evaluation or quotation review steps, without `Tenders Board Review`, unless an approved exception requires escalation.
13. For low-value procurement, the `Comptroller Procurement` shall determine whether the case proceeds through the `Competitive Tender` path or the `Simplified Quotation` path.
14. No low-value case shall proceed to tender publication, quotation request, or final approval unless the method determination has been recorded with the selected method, rationale, actor identity, and timestamp.
15. Where a low-value procurement method must be changed before material vendor-facing progress, the `Comptroller Procurement` may re-determine the method with mandatory rationale and full audit recording.
16. Where a low-value procurement method must be changed after vendor-facing activity or response handling has commenced, the `Comptroller Procurement` shall submit an exception request and `CGIS` shall act as the approving authority for that exception.
17. `CGIS` may `Approve`, `Reject`, or `Return for Clarification` a late low-value method-change exception. No such late method change shall take effect unless and until `CGIS` approves the exception.
18. Where `CGIS` rejects a late low-value method-change exception, the procurement case shall automatically resume on the previously valid procurement method.
19. Where `CGIS` returns a late low-value method-change exception for clarification, the procurement case shall remain paused until clarification is resubmitted and a final decision is issued.
20. No method re-determination or exception approval shall erase the original method decision record. The system shall preserve the full decision and exception history for audit purposes.

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

## Appendix A. Role-Based UI Operating Guide

This appendix explains how each major role is expected to use the CentralProcure user interface to perform assigned duties. Access to pages and actions shall remain role-based and workflow-controlled.

### A.1 General UI Operating Rules

All users shall:

1. sign in through the authorized login page
2. operate only within the modules visible to their assigned role
3. review dashboard alerts, pending items, and notifications at login
4. complete actions only where the UI presents an allowed workflow action
5. enter notes or rationale where the workflow requires accountable decision making
6. avoid sharing credentials or using another officer's account

### A.1.1 Role Summary Matrix

| Role | Main Workspace | Key Actions | Prohibited Actions |
|------|----------------|-------------|--------------------|
| Vendor | Public Portal / Vendor Dashboard | Maintain profile, upload compliance documents, view tenders, submit bids, track bid status | Access internal approval, evaluation, audit, or admin modules |
| Requesting Officer | Department Dashboard | Create requisition, attach justification, submit request, track status, resubmit returned items | Approve budget, evaluation, award, or threshold-route decisions |
| Department Head | Department Dashboard / Requisition Queue | Review requisitions, endorse, return, reject, add remarks | Perform budget confirmation, evaluation scoring, or final approval actions outside assigned workflow |
| Budget Officer | Budget Officer Workspace | Review budget queue, inspect balances, confirm, hold, return, reject, record notes | Publish tenders, score evaluations, or issue award approvals |
| Procurement Officer | Procurement Dashboard / APP / Tender Management | Manage APP flow, initiate procurement, create tenders, publish tenders, track process progression | Bypass threshold routing or take approval actions outside granted workflow permissions |
| Planning Reviewer | Planning Review Workspace | Review requisitions, recommend, return, reject, confirm APP readiness | Publish tenders, approve awards, or override budget and approval controls |
| Technical Evaluator | Evaluation Dashboard / Technical Evaluation | Review technical submissions, assess compliance, score, submit technical recommendation | Take financial evaluation, board, CGIS, or award decisions |
| Financial Evaluator | Evaluation Dashboard / Financial Evaluation | Review commercial offers, compare pricing, submit financial recommendation | Take technical-only, board, CGIS, or award decisions outside role |
| Evaluation Report Owner | Evaluation Dashboard / Evaluation Report | Consolidate findings, produce recommendation pack, submit evaluation report | Override approval routing or finalize award decisions |
| Tenders Board Reviewer | Approval Dashboard | Review routed cases, approve, return, reject, escalate, record decision notes | Skip BPP-required controls or alter operational evaluation data |
| CGIS Approval Officer | CGIS Approval Workspace | Review executive queue, inspect case detail, approve, reject, return, escalate, issue rationale | Edit tender setup, vendor records, or evaluation scores from executive workspace |
| BPP Liaison | BPP Review Workspace | Track BPP-routed cases, verify documents, monitor no-objection, record outcome | Release cases to award without satisfying required BPP gate |
| Contract Manager | Post-Award Modules | Create award records, manage contract milestones, coordinate execution and delivery tracking | Act before valid approval and award publication |
| Inspection Officer | Inspection and Acceptance | Review deliveries, record inspection outcome, confirm acceptance or exception | Approve payments without inspection basis |
| Payment Tracking Officer | Payment Tracking | Review payment readiness, update payment status, monitor completion | Override missing inspection, approval, or post-award controls |
| Audit and Oversight Officer | Audit Dashboard / Audit Trail Viewer | Review audit history, compliance reports, trace role actions, escalate anomalies | Edit business records unless separately authorized |
| Complaints Review Officer | Administrative Review Workspace | Review complaints, manage exception path, record review outcome, restore case to proper stage | Process complaint cases as if they were still in the normal happy-path workflow |
| System Administrator | User and Role Management / Workflow Configuration / Monitoring | Manage users, roles, settings, workflow configuration, monitoring, support diagnostics | Take business approval, evaluation, budget, board, CGIS, or award decisions without separate operational role |

### A.2 Vendor

Primary UI area:

- Public Portal
- Vendor Dashboard
- Profile Management
- Compliance Documents
- Tender Listings
- Bid Submission
- Submitted Bids Status

Expected operating steps:

1. complete registration or login
2. update company profile and compliance documents
3. open published tender listings
4. review tender requirements and submission deadlines
5. submit bid documents through the bid submission page
6. confirm submission receipt and track bid status

Key control point:

- Vendors may submit bids and maintain profile data, but shall not access internal approval, evaluation, or audit workspaces.

### A.3 Requesting Officer

Primary UI area:

- Department Dashboard
- Create Requisition
- Requisition History
- Requisition Status Tracking

Expected operating steps:

1. open the department dashboard
2. create a requisition and complete required fields
3. attach supporting details, budget-related information, and justification
4. submit the requisition into workflow
5. monitor status tracking for return, approval, or rejection outcomes
6. respond to returned items by updating and resubmitting where authorized

Key control point:

- Requesting Officers initiate requests but do not approve budget, procurement route, evaluation, or award decisions.

### A.4 Department Head

Primary UI area:

- Department Dashboard
- Requisition Queue
- Requisition Detail

Expected operating steps:

1. open pending department requisitions
2. review departmental need, justification, and supporting information
3. endorse, return, or reject as permitted by workflow
4. enter remarks where accountability requires a note
5. monitor items that progress to budget confirmation and planning review

Key control point:

- Department Head actions move the requisition from departmental initiation into formal control review.

### A.5 Budget Officer

Primary UI area:

- Budget Officer Workspace
- Budget Officer Dashboard
- Budget Confirmation Queue
- Budget Case Detail

Expected operating steps:

1. open the `Budget Officer Workspace`
2. review queue items awaiting budget confirmation
3. inspect budget code, fiscal year, requested amount, available balance, and variance
4. open the case detail to review APP linkage, request context, and prior notes
5. take one of the permitted actions: confirm, hold, return, or reject
6. enter decision rationale where required
7. confirm that the queue and case status update correctly after action

Key control point:

- The Budget Officer operates the budget confirmation stage and may block or return items that are not financially supportable.

### A.6 Procurement Officer

Primary UI area:

- Procurement Dashboard
- Annual Procurement Plan (APP)
- Tender Management
- Procurement initiation and tracking screens

Expected operating steps:

1. open the procurement dashboard and review pending planning or tender tasks
2. manage APP records created from approved requisitions
3. recommend APP items or plans for approval where workflow allows
4. initiate procurement only after APP approval is complete
5. create tender records, complete tender details, and prepare publication
6. publish tenders when method validation and approval route conditions are satisfied
7. track procurement through evaluation, approval, and award stages

Key control point:

- Procurement users coordinate planning and tender execution but shall not bypass threshold-based approval routing.

### A.7 Planning Committee or Procurement Planning Reviewer

Primary UI area:

- Planning review workspace
- APP and requisition review screens

Expected operating steps:

1. review requisitions presented for committee consideration
2. assess planning readiness, completeness, and fit for APP inclusion
3. recommend, return, or reject in accordance with committee outcome
4. ensure recommended items result in APP creation where required
5. monitor returned items for resubmission and follow-up

Key control point:

- Planning decisions determine whether a requisition is mature enough to move into APP approval and procurement initiation.

### A.8 Technical Evaluator

Primary UI area:

- Evaluation Dashboard
- Assigned Tenders
- Technical Evaluation

Expected operating steps:

1. open assigned tenders from the evaluation dashboard
2. review bidder technical submissions against stated criteria
3. score or assess technical compliance in the technical evaluation screen
4. record observations and supporting comments
5. submit the technical recommendation into the evaluation workflow

Key control point:

- Technical evaluators assess technical merit only and shall not make final approval or award decisions.

### A.9 Financial Evaluator

Primary UI area:

- Evaluation Dashboard
- Assigned Tenders
- Financial Evaluation

Expected operating steps:

1. open tenders assigned for financial assessment
2. review compliant bids and commercial details
3. compare pricing and financial responsiveness
4. record financial evaluation findings and recommendation
5. submit results for consolidated evaluation reporting

Key control point:

- Financial evaluation should occur within the authorized workflow stage and only after the tender is ready for that review.

### A.10 Evaluation Committee or Report Owner

Primary UI area:

- Evaluation Dashboard
- Evaluation Report

Expected operating steps:

1. review technical and financial evaluation outputs
2. consolidate findings into the evaluation report
3. confirm recommended vendor, number of compliant bidders, and justification
4. submit the report into the next approval stage
5. respond to any return or clarification request raised by approval authorities

Key control point:

- The evaluation report becomes the core recommendation pack for board, CGIS, or BPP review.

### A.11 Tenders Board Reviewer

Primary UI area:

- Approval Dashboard
- Tender Review
- Approval or Rejection screens

Expected operating steps:

1. open tenders routed to board review
2. review the evaluation report, tender record, and supporting documents
3. verify why the case requires board consideration
4. record board outcome in the approval interface
5. approve, return, reject, or escalate according to workflow permissions
6. ensure rationale and decision notes are captured

Key control point:

- Board actions must follow threshold routing and shall not improperly skip BPP review where the route requires it.

### A.12 CGIS Approval Officer

Primary UI area:

- `CGIS Approval`
- `CGIS Queue`
- `CGIS Case Detail`
- `Decision Confirmation`
- `Decision Receipt`

Expected operating steps:

1. open the `CGIS Approval` workspace
2. review the executive queue for cases awaiting direct CGIS decision
3. open a case and review the Executive Brief, route basis, recommendation snapshot, compliance flags, supporting pack, and audit trail
4. confirm why the case reached direct CGIS approval rather than Board or BPP route
5. choose one of the allowed actions: approve, reject, return for clarification, or escalate
6. enter a decision rationale
7. confirm the action on the decision confirmation screen
8. retain the decision receipt as the final summary of action taken

Key control point:

- CGIS operates a read-mostly executive workspace and should not edit tender setup, evaluation scores, or vendor profile information from this module.

### A.13 BPP Liaison

Primary UI area:

- BPP escalation or no-objection workspace
- Approval tracking screens

Expected operating steps:

1. open cases routed to BPP prior review
2. verify that threshold routing and supporting documentation are complete
3. monitor the status of the no-objection process
4. record or update the BPP decision outcome where the system permits
5. release the case back into the procurement flow only after the required BPP gate is satisfied

Key control point:

- BPP-routed cases shall not proceed to award publication until the required no-objection control is satisfied.

### A.14 Contract Manager or Post-Award Officer

Primary UI area:

- Contract Award
- Contract Management
- Inspection and Acceptance
- Payment Tracking

Expected operating steps:

1. open awarded cases transferred into post-award operations
2. create or confirm contract award records
3. monitor milestones, delivery, and contract execution events
4. coordinate inspection and acceptance recording
5. track payment progress until contract closeout

Key control point:

- Post-award users manage execution after valid approval and award publication, not before.

### A.15 Inspection or Acceptance Officer

Primary UI area:

- Inspection and Acceptance

Expected operating steps:

1. open contracts pending inspection
2. review delivery evidence and contract obligations
3. record inspection outcome
4. confirm acceptance or identify exceptions requiring follow-up
5. pass the case into the payment stage where conditions are met

Key control point:

- Inspection outcomes provide the operational basis for payment progression and closeout.

### A.16 Payment or Finance Tracking Officer

Primary UI area:

- Payment Tracking

Expected operating steps:

1. open contracts cleared for payment processing
2. review inspection and acceptance status
3. monitor payment milestones and outstanding items
4. update payment status in line with authorized financial processing
5. mark final completion where workflow permits

Key control point:

- Payment tracking shall follow approved post-award workflow and should not be used to override missing inspection or approval gates.

### A.17 Audit and Oversight Officer

Primary UI area:

- Audit Dashboard
- Audit Trail Viewer
- Compliance Reports

Expected operating steps:

1. open the audit dashboard to review system-wide oversight indicators
2. inspect audit trails for requisitions, tenders, approvals, contracts, and complaints
3. review compliance reports and decision histories
4. confirm that role actions, timestamps, notes, and workflow transitions are traceable
5. escalate observed anomalies through the appropriate governance channel

Key control point:

- Audit and oversight access is read-only unless a separate authorized role exists for corrective action.

### A.18 Complaints Review Officer

Primary UI area:

- Administrative review or complaint handling screens

Expected operating steps:

1. open complaints filed during solicitation, evaluation, or award stages
2. review complaint details and linked procurement records
3. assess whether the complaint should interrupt normal flow
4. record review actions and outcomes in the administrative review interface
5. return the procurement record to the proper stage after the complaint path is resolved

Key control point:

- Administrative review is an exception path and shall be handled separately from the normal happy-path procurement flow.

### A.19 System Administrator

Primary UI area:

- User and Role Management
- Workflow Configuration
- System Settings
- Monitoring and Health

Expected operating steps:

1. manage user accounts and role assignments
2. maintain approved workflow configuration and settings
3. monitor system health and operational status
4. support incident investigation through logs and monitoring screens
5. avoid altering business records except where a formal administrative function permits it

Key control point:

- System administration rights shall be tightly controlled because they affect access, workflow, and platform availability.

Administrative operating duties:

1. open `User and Role Management` to create, disable, unlock, or update user accounts
2. assign the correct role to each officer so the appropriate dashboard and workspace become visible
3. review role mappings when a user reports missing modules or excess access
4. open `Workflow Configuration` to maintain approved workflow stages, routing rules, and permitted action mappings
5. open `System Settings` to manage configuration items that are intended for administrator control
6. open `Monitoring and Health` to review system status, service health, failed jobs, and operational alerts
7. use audit and monitoring views to investigate support incidents without altering business decisions
8. support users by confirming where an item is stuck in workflow, which role currently owns it, and whether an allowed action is available
9. verify notifications, role visibility, and environment-linked behavior after configuration or release changes
10. document any high-impact administrative change and escalate it for approval where policy requires

Administrative support across business tasks:

1. for requisition issues, confirm the record stage, assigned actor, and whether the Requesting Officer or Department Head can still act
2. for budget issues, confirm whether the item is in `budget_allocation_and_confirmation` and visible in the `Budget Officer Workspace`
3. for procurement planning issues, confirm APP linkage, plan status, and whether procurement initiation is unlocked
4. for tender issues, confirm publication state, bid stage, and whether evaluation or approval routes are correctly resolved
5. for approval issues, confirm whether the case belongs to `CGIS Approval`, Tenders Board review, or BPP route based on the route diagnostics
6. for post-award issues, confirm whether award publication, contract execution, inspection, and payment stages are progressing correctly
7. for complaint issues, confirm whether the record has moved into administrative review and whether the normal workflow has been interrupted

Detailed administrator task procedures:

1. User account creation
   Procedure:
   Open `User and Role Management`, select `Create User`, enter the officer's identity details, assign the initial role, save the record, and confirm the user appears in the user list.
   Undo or correction:
   If created in error, open the user profile and use `Disable User` or `Deactivate Account`. If the profile data is wrong, use `Edit User` and save the corrected details.
2. User profile update
   Procedure:
   Open `User and Role Management`, search for the officer, open the profile, update the permitted fields such as name, department, designation, email, or status, then save changes.
   Undo or correction:
   Reopen the same profile and restore the correct values. If the update caused access or routing issues, verify the department and role fields immediately after correction.
3. User account disable or re-enable
   Procedure:
   Open the user record and select `Disable`, `Suspend`, or the equivalent status control when an account should no longer log in or act in workflow.
   Undo or correction:
   Reopen the user record and select `Enable`, `Reactivate`, or restore the prior active status after approval.
4. Password reset or account unlock
   Procedure:
   Open the user record and select `Reset Password` or `Unlock Account`, then communicate the reset outcome through the approved channel.
   Undo or correction:
   A password reset is not normally undone. If triggered in error, reset the password again and notify the affected user. An unlock can be reversed by disabling the account where policy requires immediate restriction.
5. Role assignment
   Procedure:
   Open the user profile, go to `Roles` or access mapping, assign the correct operational role, save, then ask the user to sign in again and confirm the expected workspace is visible.
   Undo or correction:
   Remove the incorrect role or restore the previous role assignment. Confirm that excessive access has been removed and that required access remains.
6. Role removal
   Procedure:
   Open the user role mapping, remove the role that should no longer apply, save, and verify the user no longer sees the removed module.
   Undo or correction:
   Reassign the role if it was removed in error and confirm the associated workspace becomes visible again.
7. Department or unit reassignment
   Procedure:
   Open the user profile and update the department or unit field so requisition ownership, queues, and dashboards align with the officer's current placement.
   Undo or correction:
   Restore the previous department if the reassignment was incorrect. Recheck any affected queue visibility after reversal.
8. Workflow stage configuration
   Procedure:
   Open `Workflow Configuration`, locate the relevant workflow definition, review the current stage map, update the approved stage setting or label, save, and verify that the change matches the approved configuration record.
   Undo or correction:
   Restore the prior stage configuration from the documented baseline or approved configuration snapshot. Re-test route visibility after rollback.
9. Workflow action mapping
   Procedure:
   Open the action or permission mapping for the relevant workflow stage, add or remove the approved allowed action, save, and verify the intended role now sees only the permitted action buttons.
   Undo or correction:
   Restore the prior action mapping if the wrong action became visible or disappeared. Confirm by reloading the affected case with the impacted role.
10. Threshold or route configuration support
   Procedure:
   Open the approved workflow or route configuration screen, review threshold bands and route labels, apply the approved change, save, and verify that route diagnostics still resolve to the correct authority.
   Undo or correction:
   Reinstate the previous threshold or route values immediately if cases start resolving to the wrong approval path.
11. System settings update
   Procedure:
   Open `System Settings`, locate the approved setting, change the value, save, and verify the expected system behavior in the related module.
   Undo or correction:
   Reopen the same setting and restore the prior value. Validate that the affected behavior has returned to normal.
12. Notification configuration check
   Procedure:
   Open the notification or settings area, confirm that the affected event is enabled, verify recipient role mapping, and perform a controlled test where allowed.
   Undo or correction:
   Restore the previous notification state if a test change causes incorrect or excessive notifications.
13. Monitoring and health review
   Procedure:
   Open `Monitoring and Health`, review service indicators, queue failures, recent errors, and alert panels, then identify the failing module or release window.
   Undo or correction:
   Monitoring review itself is read-only. If an operational control was changed during diagnosis, restore the prior value after the investigation unless a permanent fix was approved.
14. Incident triage
   Procedure:
   Gather the record reference, user role, reported error, current stage, and time of failure. Open the relevant admin or audit views, confirm whether the issue is access-related, workflow-related, data-related, or environment-related, then route it to the responsible team.
   Undo or correction:
   If the admin made a temporary change for diagnosis, revert that temporary change once evidence is collected.
15. Requisition support intervention
   Procedure:
   Search the requisition reference, inspect the current stage, assigned actor, previous notes, and pending actions. Confirm whether the Requesting Officer or Department Head can still act or whether the item is awaiting the next control role.
   Undo or correction:
   If a display or access issue was caused by admin role mapping or settings, restore the prior role or setting. Do not change the requisition decision itself unless an approved business-admin function exists.
16. Budget workflow support intervention
   Procedure:
   Search the affected requisition or APP item, confirm whether it is in `budget_allocation_and_confirmation`, verify `Budget Officer Workspace` visibility for the correct role, and check whether the allowed action is present.
   Undo or correction:
   Reverse any incorrect role mapping or workflow action mapping that caused the budget queue or buttons to disappear.
17. Procurement and tender support intervention
   Procedure:
   Open the tender or APP record, confirm stage, publication state, route diagnostics, and role ownership. Verify that procurement initiation, tender publication, bid opening, or evaluation access aligns with the workflow stage.
   Undo or correction:
   If the issue was caused by configuration error, restore the prior approved setting. Do not edit evaluation outcomes or approval decisions as an admin workaround.
18. Approval routing support
   Procedure:
   Review route diagnostics to confirm whether the case belongs to `CGIS Approval`, `Tenders Board Review`, or `BPP` path. Verify that the assigned role can see the case and permitted actions.
   Undo or correction:
   If the wrong route was exposed due to configuration change, roll back the route or threshold configuration to the last approved state.
19. Post-award support
   Procedure:
   Open the contract, inspection, or payment views, confirm the current stage and any missing predecessor event such as award publication or inspection completion, then advise the responsible operational user.
   Undo or correction:
   If a configuration issue blocked visibility or progression, restore the prior admin configuration. Do not fabricate post-award milestones.
20. Complaint and administrative review support
   Procedure:
   Confirm whether the complaint has moved into administrative review, check who owns the review step, and verify that the normal workflow has been interrupted where required.
   Undo or correction:
   Reverse only the admin-side access or visibility issue if one exists. Do not close, dismiss, or advance the complaint outside the authorized review role.
21. Audit support
   Procedure:
   Open `Audit Dashboard` or `Audit Trail Viewer`, search by reference number, user, date, or module, and inspect who acted, when they acted, and what stage transition occurred.
   Undo or correction:
   Audit review is read-only. If an audit-related access permission was changed in error, restore the previous permission mapping.
22. Safe undo rule for administrators
   Procedure:
   An administrator may undo configuration, access, visibility, and status-management actions that the admin role itself created, provided the reversal is allowed by policy and the prior state is known.
   Undo or correction:
   Before undoing, confirm the previous state from audit history, configuration baseline, or approved request. After undoing, verify the affected module behaves as expected.
23. Non-reversible actions rule
   Procedure:
   Where an action is inherently non-reversible, such as a password reset already communicated or an audit entry already created, the administrator shall apply the proper corrective action instead of attempting to erase history.
   Undo or correction:
   Use a new corrective action, document the reason, and preserve the audit trail.

Administrator limitation:

- A System Administrator may configure, support, monitor, and troubleshoot all UI areas, but shall not take business approval, evaluation, board, CGIS, budget, or award decisions unless separately assigned that operational role under approved access control.
