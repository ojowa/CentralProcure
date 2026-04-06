# Nigeria Immigration Service

## ICT Directorate

## Standard Operating Procedure Submission

**Project:** CentralProcure  
**Document Title:** Standard Operating Procedure for CentralProcure Project Governance, Development, Release, and Deployment  
**Document ID:** NIS-ICT-CP-SOP-001  
**Version:** 1.0  
**Date:** 2026-04-06  
**Classification:** Internal Use Only  
**Prepared For:** Management Review and Approval

---

## Document Control Table

| Item | Details |
|------|---------|
| Document Title | Standard Operating Procedure for CentralProcure Project Governance, Development, Release, and Deployment |
| Document ID | NIS-ICT-CP-SOP-001 |
| Version | 1.0 |
| Date | 2026-04-06 |
| Classification | Internal Use Only |
| Prepared For | Management Review and Approval |
| Owning Department | ICT Directorate / Digital Procurement Systems Unit |
| System Owner | Nigeria Immigration Service |
| Custodian of Record | Project Technical Lead / Document Owner |

---

## Transmittal Memo

**To:** The Approving Authority  
**Through:** Director, ICT Directorate  
**From:** Project Technical Lead / Document Owner  
**Subject:** Submission of Standard Operating Procedure for CentralProcure Project Governance, Development, Release, and Deployment  
**Date:** 2026-04-06

Respectfully submitted for review and approval is the proposed Standard Operating Procedure governing software development, compliance control, release handling, and deployment activities for the CentralProcure platform.

This document has been prepared to provide a formal administrative and technical framework for the management of the CentralProcure project and to support institutional control over software changes affecting procurement workflows, release integrity, and deployment assurance.

Approval of this SOP will establish an official operating standard for all authorized personnel working on the project and will strengthen accountability, traceability, and procedural discipline across the software lifecycle.

Submitted for kind review and approval, please.

---

## Cover Note

This document is presented for management consideration as the proposed Standard Operating Procedure governing software development, compliance control, release handling, and deployment activities for the CentralProcure platform.

The SOP is intended to establish a clear institutional framework for:

- technical development control
- statutory compliance alignment
- controlled publication to project repositories
- deployment readiness and post-release verification
- accountability through documented approvals and revision control

Approval of this document will provide a formal operating basis for the continued development and controlled release of the CentralProcure system.

---

## Table of Contents

1. Executive Summary  
2. Background  
3. Acronyms and Abbreviations  
4. Purpose  
5. Scope  
6. Authority and Ownership  
7. Distribution  
8. Reference Documents  
9. Roles and Responsibilities  
10. Governing Policy Requirements  
11. Standard Operating Procedure  
12. Exception Management  
13. Records and Audit Requirements  
14. Review and Amendment Procedure  
15. Recommendation  
16. Approval Page  
17. Revision History  
Appendix A. Release Checklist  
Appendix B. Exception Request Form  
Appendix C. Role-Based UI Operating Guide

---

## 1. Executive Summary

CentralProcure is an internal e-Procurement platform being developed for the Nigeria Immigration Service. Given the system's procurement, approval, audit, and workflow responsibilities, a controlled operating procedure is required to ensure that changes to the platform are managed consistently and in alignment with the Public Procurement Act 2007.

This SOP sets out the approved operational method for:

- implementing project changes
- validating software before release
- publishing changes to the monorepo and split repositories
- preparing and verifying deployments
- recording approvals, exceptions, and revision history

The document is structured for formal administrative adoption and technical execution within a public-sector governance environment.

## 2. Background

CentralProcure supports internal procurement processes and related approval workflows. The project is maintained through a monorepo structure with separate backend and frontend publication targets.

The system includes:

- a backend API in `.NET 10`
- a frontend application in `Next.js`
- database and workflow dependencies tied to procurement operations
- deployment configuration for controlled release environments

Because the platform supports institutional procurement processes, unmanaged changes introduce technical, legal, operational, and governance risk. A formal SOP is therefore required.

## 3. Acronyms and Abbreviations

| Acronym | Meaning |
|---------|---------|
| NIS | Nigeria Immigration Service |
| ICT | Information and Communication Technology |
| SOP | Standard Operating Procedure |
| PPA | Public Procurement Act |
| RBAC | Role-Based Access Control |
| BPP | Bureau of Public Procurement |
| API | Application Programming Interface |
| DTO | Data Transfer Object |

## 4. Purpose

The purpose of this SOP is to provide a formal and uniform operating standard for all personnel involved in the CentralProcure project lifecycle.

This SOP is designed to ensure:

- consistency in development and release processes
- compliance with statutory and organizational obligations
- controlled repository publication and deployment
- traceability of technical and operational actions

## 5. Scope

This SOP applies to:

- ICT Directorate personnel assigned to the project
- technical leads and maintainers
- backend and frontend developers
- release operators
- quality assurance and governance stakeholders involved in review or oversight

It governs:

- development workflow
- validation and quality checks
- Git commit and publication control
- deployment preparation
- exception approval
- revision control and records management

## 6. Authority and Ownership

This SOP is issued under the authority of the responsible ICT and project governance leadership supervising the CentralProcure platform.

Ownership is assigned as follows:

- **System Owner:** Nigeria Immigration Service
- **Owning Department:** ICT Directorate / Digital Procurement Systems Unit
- **Document Owner:** Designated Technical Lead or Project Maintainer
- **Release Authority:** Designated Release Operator under supervisory approval

No deviation from this SOP shall occur except through documented approval under the exception management provisions of this document.

This document shall serve as the official reference for project operating control unless and until it is superseded by a later approved version.

## 7. Distribution

This document should be circulated to:

- ICT Directorate leadership
- project technical leads
- backend development team
- frontend development team
- release and deployment personnel
- quality assurance personnel
- governance and compliance stakeholders where applicable

## 8. Reference Documents

- [SOP.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\SOP.md)
- [SOP_INSTITUTIONAL.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\SOP_INSTITUTIONAL.md)
- [Agent.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Agent.md)
- [Backend/README.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Backend\README.md)
- [Frontend/README.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Frontend\README.md)
- [scripts/publish-all-remotes.ps1](C:\Users\OJOWA\Documents\Project 4\CentralProcure\scripts\publish-all-remotes.ps1)
- [design notes/compliance/PPA2007.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\compliance\PPA2007.md)
- [design notes/compliance/current_procurement_workflow.md](C:\Users\OJOWA\Documents\Project 4\CentralProcure\design notes\compliance\current_procurement_workflow.md)

## 9. Roles and Responsibilities

### 9.1 Project Sponsor or Approving Authority

The approving authority shall:

- provide high-level direction
- approve the SOP and major amendments
- authorize major release governance where required
- ensure the project remains aligned with institutional priorities and control expectations

### 9.2 Document Owner

The document owner shall:

- maintain the official version of this SOP
- coordinate updates and periodic review
- ensure outdated versions are superseded appropriately

### 9.3 Change Owner

The change owner shall:

- understand the requested change before implementation
- identify affected modules and compliance implications
- execute changes in line with project rules
- perform required validation
- document any unresolved issue or exception
- escalate any issue with compliance, release integrity, or deployment risk promptly

### 9.4 Reviewer or Technical Lead

The reviewer or technical lead shall:

- assess technical correctness
- review compliance and workflow impact
- confirm adequacy of validation evidence
- prevent unsafe or incomplete release actions

### 9.5 Release Operator

The release operator shall:

- verify repository state before publication
- publish changes using approved methods
- confirm deployment readiness
- perform post-deployment checks

## 10. Governing Policy Requirements

The following project controls are mandatory:

1. Procurement workflow logic shall comply with the Public Procurement Act 2007.
2. Threshold routing shall distinguish low-value, board-level, and BPP prior review workflows.
3. Statutory procurement timelines shall be enforced or expressly flagged.
4. Backend DTOs and API payloads shall use `PascalCase`.
5. Frontend state aligned to backend payloads shall use `PascalCase`.
6. Database tables, schemas, and columns shall use `snake_case`.
7. Backend create and update paths shall use stored procedures.
8. Role-based authorization shall use approved workflow and RBAC services.
9. Sensitive credentials shall not be committed into source control.
10. Split repositories shall be published through subtree methods, not by direct monorepo branch push.

## 11. Standard Operating Procedure

### 11.1 Requirement Intake

Before development begins, the change owner shall:

1. define the purpose of the change
2. identify affected modules
3. determine whether the change affects compliance, workflow, routing, deployment, or database structure
4. identify all required configuration and release implications

Where a change may affect statutory controls, approval thresholds, or timeline enforcement, the matter should be highlighted to the reviewer or technical lead before implementation proceeds.

### 11.2 Development Control

During implementation, the change owner shall:

1. preserve approved route contracts unless an authorized migration is in place
2. maintain required naming conventions and case rules
3. ensure backend write operations remain aligned with stored procedures
4. maintain workflow synchronization for tracked entities
5. avoid uncontrolled removal of deployment or release artifacts

All development activities should be performed in a manner that preserves auditability and minimizes the risk of undocumented behavioral changes.

### 11.3 Backend Operating Procedure

Backend work shall be performed from `Backend/`.

```powershell
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:DOTNET_CLI_HOME='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet'
$env:MSBuildEnableWorkloadResolver='false'
dotnet restore ".\eProcurement.Api.csproj"
dotnet build ".\eProcurement.Api.csproj" -v:minimal --no-restore
dotnet run --project ".\eProcurement.Api.csproj"
```

### 11.4 Frontend Operating Procedure

Frontend work shall be performed from `Frontend/`.

```powershell
npm install
npm run build
npm run start
```

`NEXT_PUBLIC_BACKEND_URL` shall be correctly set for production-targeted builds.

### 11.5 Validation Procedure

Before commit, the change owner shall:

1. inspect `git status`
2. inspect the diff for unintended edits
3. build the backend
4. build the frontend
5. confirm configuration updates are documented
6. verify workflow-sensitive behavior where applicable
7. record any uncompleted validation and state the reason

No change should proceed to release where a failed or omitted validation step creates material uncertainty regarding system behavior, compliance enforcement, or deployment safety.

Minimum validation commands:

```powershell
cd Backend
dotnet build ".\eProcurement.Api.csproj"
```

```powershell
cd Frontend
npm run build
```

### 11.6 Commit Procedure

1. stage only intended files
2. use a clear scoped commit message
3. avoid grouping unrelated changes
4. ensure validation is complete unless an approved exception exists

### 11.7 Publication Procedure

For the monorepo:

```powershell
git push origin main
```

For split repository publication:

```powershell
.\scripts\publish-all-remotes.ps1
```

This performs:

```powershell
git push origin main
git subtree push --prefix=Backend backend main
git subtree push --prefix=Frontend frontend main
```

Publication controls:

1. the monorepo branch shall not be pushed directly to `backend` or `frontend`
2. subtree publication shall be used for split repositories
3. divergence shall be investigated before retrying a rejected split push
4. force-push activity shall not occur without explicit approval and documentation
5. publication actions shall be traceable to a responsible operator

### 11.8 Deployment Preparation

Backend deployment source:
- `Backend/`

Backend blueprint:
- [Backend/render.yaml](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Backend\render.yaml)

Backend required variables:
- `ConnectionStrings__Primary`
- `Jwt__Key`
- `Jwt__Issuer`
- `Jwt__Audience`
- `ASPNETCORE_ENVIRONMENT`

Frontend deployment source:
- `Frontend/`

Frontend blueprint:
- [Frontend/render.yaml](C:\Users\OJOWA\Documents\Project 4\CentralProcure\Frontend\render.yaml)

Frontend required variables:
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_APP_BASE_PATH` where applicable

### 11.9 Post-Deployment Verification

The release operator shall verify:

1. backend health endpoint response
2. frontend connectivity to the intended backend
3. successful authentication flow
4. availability of critical procurement routes and dashboards
5. availability of required environment variables

## 12. Exception Management

Any deviation from this SOP shall be documented and approved by the designated approving authority before execution where practicable.

Exception records shall include:

- description of deviation
- reason for deviation
- associated risk
- mitigating controls
- approving authority
- approval date

## 13. Records and Audit Requirements

The following records should be retained for releases or significant technical changes:

- change summary
- commit hash
- validation evidence
- publication result
- deployment target
- smoke test result
- exception approval where applicable

This document should be available for internal audit, release review, and project governance assessment.

Where required by internal controls, release records may be referenced during management reporting, compliance review, or post-incident assessment.

## 14. Review and Amendment Procedure

This document shall be reviewed:

- monthly during active implementation, or
- immediately after any significant change in architecture, compliance handling, deployment process, or repository publication method

All amendments shall:

1. be versioned
2. be recorded in the revision history
3. state the nature of the change
4. be approved through the designated governance channel

## 15. Recommendation

It is respectfully recommended that management approve this SOP as the governing operational document for the CentralProcure project.

Approval will provide:

- a formal process baseline for project execution
- stronger release control
- improved accountability and traceability
- clearer alignment between technical implementation and institutional governance

Upon approval, the document should be circulated to all relevant officers and adopted as the baseline operating reference for the project.

## 16. Approval Page

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

## 17. Revision History

| Version | Date       | Description                                                       | Author |
|---------|------------|-------------------------------------------------------------------|--------|
| 1.0     | 2026-04-06 | Initial management submission version of CentralProcure SOP       | Codex  |

## Appendix A. Release Checklist

Use this checklist before closing any release or controlled publication activity:

| S/N | Item | Status | Remarks |
|-----|------|--------|---------|
| 1 | Requirement confirmed |  |  |
| 2 | Impacted modules identified |  |  |
| 3 | Compliance impact reviewed |  |  |
| 4 | Backend build completed |  |  |
| 5 | Frontend build completed |  |  |
| 6 | Configuration updates documented |  |  |
| 7 | Commit created and reviewed |  |  |
| 8 | `origin` push completed |  |  |
| 9 | Subtree repositories published where required |  |  |
| 10 | Deployment variables verified |  |  |
| 11 | Post-deployment checks completed |  |  |
| 12 | Exceptions documented where applicable |  |  |

## Appendix B. Exception Request Form

**Exception ID:** ____________________  
**Date:** ____________________  
**Requested By:** ____________________  
**Role/Title:** ____________________

**1. Description of Requested Exception**  
____________________________________________________________________  
____________________________________________________________________

**2. Reason for Exception**  
____________________________________________________________________  
____________________________________________________________________

**3. Risk Introduced**  
____________________________________________________________________  
____________________________________________________________________

**4. Mitigating Controls**  
____________________________________________________________________  
____________________________________________________________________

**5. Duration of Exception**  
____________________________________________________________________

**6. Approval**

Approving Authority: ____________________  
Title: ____________________  
Signature: ____________________  
Date: ____________________

## Appendix C. Role-Based UI Operating Guide

This appendix explains how each major role is expected to use the CentralProcure user interface to perform assigned duties. Access to pages and actions shall remain role-based and workflow-controlled.

### C.1 General UI Operating Rules

All users shall:

1. sign in through the authorized login page
2. operate only within the modules visible to their assigned role
3. review dashboard alerts, pending items, and notifications at login
4. complete actions only where the UI presents an allowed workflow action
5. enter notes or rationale where the workflow requires accountable decision making
6. avoid sharing credentials or using another officer's account

### C.2 Vendor

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

### C.3 Requesting Officer or Department User

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

- Department users initiate requests but do not approve budget, procurement route, evaluation, or award decisions.

### C.4 Department Head

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

### C.5 Budget Officer

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

### C.6 Procurement Officer or Procurement Manager

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

### C.7 Planning Committee or Procurement Planning Reviewer

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

### C.8 Technical Evaluator

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

### C.9 Financial Evaluator

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

### C.10 Evaluation Committee or Report Owner

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

### C.11 Tenders Board Secretary or Board Reviewer

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

### C.12 CGIS Approver

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

### C.13 BPP Liaison

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

### C.14 Contract Manager or Post-Award Officer

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

### C.15 Inspection or Acceptance Officer

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

### C.16 Payment or Finance Tracking Officer

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

### C.17 Audit Officer or Oversight User

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

### C.18 Complaints Review Officer

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

### C.19 System Administrator or ICT Administrator

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
