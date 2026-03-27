do# Proposal 9: CGIS Approval Workspace

## 1. Objective
Define a dedicated `CGIS Approval` workspace inside the existing internal portal for low-value procurements that route to direct executive approval.

The workspace should let the approving authority:

- review the full recommendation pack quickly
- understand why the case reached `CGIS`
- make an accountable decision with minimal operational friction
- preserve a defensible audit trail

This proposal does not introduce a separate CGIS portal. It extends the current role-based internal dashboard with an executive-focused approval module.

## 2. Context
The threshold-routing model already distinguishes:

- `CGIS Direct Approval`
- `NIS Tenders Board Review`
- `NIS Tenders Board + BPP No Objection`

The current implementation keeps the workflow key `accounting_officer_review` for compatibility, but exposes it in the business language as `CGIS Approval`.

That means the correct product direction is:

- one internal portal
- role-based module access
- a dedicated executive workspace for CGIS decisions

## 3. Problem Statement
The generic approval-stage model is not enough for executive use.

Without a purpose-built CGIS workspace:

- the approval actor sees too much operational detail and too little decision-ready summary
- the threshold basis for direct approval is not immediately obvious
- decision rationale can become inconsistent
- the audit trail may capture activity, but not an executive-grade decision record
- users may confuse `CGIS Approval` with board review or routine accounting review

## 4. Users and Roles

### 4.1 Primary user
- `CGIS` executive approver

### 4.2 Operational equivalents in the current system
The workspace currently uses the existing executive approval workflow slot and is presented in the UI as `CGIS Approval`. The legacy internal compatibility key remains in code, but the business-facing actor is `CGIS`.

### 4.3 Supporting users
- `ProcurementOfficer`
- `ProcurementManager`
- `TechnicalEvaluator`
- `FinancialEvaluator`
- `TendersBoardSecretary`
- `AuditOfficer`
- `BPPLiaison`
- `ComplaintsReviewOfficer`

These users do not decide inside the module, but they may provide the input pack, track the outcome, or inspect the audit trail.

## 5. Scope

### 5.1 In scope
- executive queue for cases awaiting CGIS decision
- decision-ready case summary
- supporting document pack
- threshold and compliance diagnostics
- approval, rejection, return, and controlled escalation actions
- mandatory rationale capture
- complete audit trail visibility
- post-decision routing to the next valid workflow stage

### 5.2 Out of scope
- separate external portal for CGIS
- editing tender or evaluation data inside the approval workspace
- board quorum management
- BPP external integration redesign
- mobile-native app

## 6. Design Principles
- `Decision-first`: show the recommendation and reason for approval routing before raw records.
- `Low cognitive load`: reduce clicks and remove non-essential editing controls.
- `Policy-visible`: threshold route, authority, and compliance basis must be obvious.
- `Traceable`: every decision must carry actor, time, note, and workflow consequence.
- `Read-mostly`: the executive should review and decide, not rebuild operational data.

## 7. Information Architecture
The workspace should be a dedicated module in the existing internal shell.

### 7.1 Navigation placement
- Internal dashboard card: `CGIS Approval`
- Sidebar module entry under approval or executive decision section

### 7.2 Core pages
1. `CGIS Queue`
2. `CGIS Case Detail`
3. `Decision Confirmation`
4. `Decision Receipt`

## 8. Page-by-Page UX Map

### 8.1 CGIS Queue
Purpose: show all cases currently awaiting direct CGIS approval.

#### Key content
- reference number
- requisition or tender title
- originating department
- selected vendor
- evaluated amount
- procurement method
- threshold route
- days pending
- recommendation status
- risk flag indicator

#### Filters
- date submitted
- department
- amount band
- procurement method
- urgency
- vendor
- risk level

#### Quick actions
- open case
- mark for follow-up
- export queue snapshot

#### Queue states
- `Awaiting Review`
- `Ready to Decide`
- `Returned for Clarification`
- `Escalated`
- `Approved`
- `Rejected`

### 8.2 CGIS Case Detail
Purpose: present one case in a decision-ready format.

This page should use a split layout:

- left: executive brief and recommendation
- right: documents, diagnostics, and audit support

#### Section A: Executive Brief
Show a compact summary:

- case reference
- request title
- department
- procurement category and method
- selected vendor
- total recommended amount
- funding source or budget code
- submission date
- current stage
- recommended action

#### Section B: Why This Reached CGIS
Show the threshold basis in plain language:

- approval route: `CGIS Direct Approval`
- threshold band matched
- whether board review is required: `No`
- whether BPP prior review is required: `No`
- workflow explanation of why the case stopped here

#### Section C: Recommendation Snapshot
Show the operational recommendation:

- recommended vendor
- evaluation outcome
- number of compliant bidders
- price summary
- key justification
- procurement notes

#### Section D: Compliance and Risk Flags
Show a compact checklist:

- APP linkage confirmed
- budget availability confirmed
- legal review status
- financial review status
- complaints pending
- document completeness
- exceptions or waivers

Each item should display:

- `Pass`
- `Attention Required`
- `Not Applicable`

#### Section E: Supporting Pack
Read-only tabs or panels for:

- evaluation report
- bid opening record
- tender summary
- vendor compliance documents
- internal approval notes
- award draft
- attached memos

#### Section F: Audit Trail
Chronological timeline showing:

- stage transitions
- who acted
- when they acted
- what they did
- their notes
- threshold-routing diagnostics at the time of movement

### 8.3 Decision Confirmation
Purpose: make final action explicit and prevent accidental approvals.

Before final submission, the approver should confirm:

- selected action
- rationale note
- awareness of next workflow step
- any conditional comments

### 8.4 Decision Receipt
Purpose: provide a final immutable summary of the decision.

Show:

- decision result
- actor
- timestamp
- case reference
- summary rationale
- next workflow state
- audit reference id

## 9. Decision Actions

### 9.1 Approve
Use when the case satisfies direct CGIS approval conditions.

Result:
- record executive approval
- advance case to `award_and_publication`
- lock approval record against casual editing

### 9.2 Reject
Use when the case is not acceptable and should not proceed.

Requirements:
- mandatory reason
- optional corrective direction

Result:
- return workflow to the configured rejection path
- notify originating operational actors

### 9.3 Return for Clarification
Use when the case may still proceed but requires more information.

Examples:
- incomplete supporting memo
- threshold inconsistency
- unresolved evaluation explanation

Result:
- send case back to procurement or evaluation context
- require a return note

### 9.4 Escalate
Use only when policy allows exceptional handling.

Examples:
- route anomaly
- post-submission governance concern
- need for board or BPP attention despite original route

Result:
- move case to the valid escalation stage
- record explicit reason for override

## 10. Required Data Model for the UI
The page payload should expose the following groups.

### 10.1 Case summary
- case id
- reference number
- title
- department
- procurement method
- amount
- vendor
- created date
- pending since date

### 10.2 Route diagnostics
- approval route
- approval authority code
- approval authority label
- requires CGIS approval
- requires board
- requires BPP
- governance body name if applicable
- threshold note

### 10.3 Recommendation details
- evaluator recommendation
- financial recommendation
- procurement recommendation
- selected vendor and score basis

### 10.4 Compliance indicators
- app linked
- budget confirmed
- legal review completed
- financial controls completed
- complaints open
- documentation complete

### 10.5 Documents
- evaluation report
- bid opening summary
- vendor file
- approval memo
- award draft

### 10.6 Audit metadata
- event id
- action by
- action role
- action at
- action note

### 10.7 Allowed actions
- approve
- reject
- return
- escalate

These actions must be computed by policy, not hard-coded purely in the frontend.

## 11. Backend Expectations

### 11.1 Read endpoints
The backend should provide:

- queue list endpoint for CGIS-routed cases
- case detail endpoint
- audit history endpoint
- document metadata endpoint

### 11.2 Write endpoints
The backend should provide controlled actions:

- submit approval
- submit rejection
- return for clarification
- escalate

### 11.3 Policy checks
Before accepting a decision, the backend must verify:

- current stage is the CGIS approval stage
- route really requires direct CGIS approval
- user has the correct approval authority
- action is valid for the current record state
- mandatory rationale is present

## 12. Permission Model

### 12.1 Decision permissions
Only the executive approval actor should be allowed to submit decision actions.

### 12.2 Read-only visibility
Read-only access may be granted to:

- `AuditOfficer`
- `Admin`
- `SystemAdministrator`
- `ProcurementManager`
- other explicitly approved oversight actors

### 12.3 No operational editing
CGIS users should not:

- edit tender setup
- edit evaluation scores
- edit vendor profile data
- alter threshold configuration from the workspace

## 13. Audit and Compliance Requirements
Every CGIS action must capture:

- actor identity
- displayed role
- decision type
- rationale
- timestamp
- originating route decision
- previous stage
- next stage
- related case reference

The audit trail should be readable both as:

- a human decision history
- a machine-verifiable workflow sequence

## 14. Notifications
On decision submission, notify relevant users.

### 14.1 On approval
- `ProcurementOfficer`
- `ProcurementManager`
- `ContractManager` if downstream award setup begins

### 14.2 On return
- submitting procurement actor
- relevant evaluator if evaluation clarification is needed

### 14.3 On rejection
- procurement owner
- audit or oversight observers if required by policy

### 14.4 On escalation
- target downstream authority
- procurement owner
- audit observers

## 15. UX Content Guidance
The module should use executive language, not internal engineering jargon.

Preferred labels:

- `CGIS Approval`
- `Executive Brief`
- `Decision Summary`
- `Why this case reached CGIS`
- `Supporting Pack`
- `Compliance Flags`
- `Decision Receipt`

Avoid labels such as:

- `accounting_officer_review`
- `raw workflow payload`
- `policy object`

## 16. Recommended Screen Components

### 16.1 Queue components
- summary counters
- filter bar
- sortable queue table
- attention chips

### 16.2 Detail components
- executive summary card
- route diagnostics card
- recommendation card
- compliance checklist
- documents panel
- audit timeline
- sticky decision panel

### 16.3 Confirmation components
- action modal
- rationale textarea
- next-stage preview
- confirmation acknowledgement

## 17. Mobile and Responsive Behavior
This workspace should be desktop-first, but still usable on tablet.

### 17.1 Desktop
- split layout with sticky decision panel
- full document preview and timeline visibility

### 17.2 Tablet
- stacked summary sections
- collapsible documents
- sticky action footer

### 17.3 Mobile
- read-only review should remain possible
- final approval should be allowed only if the organization accepts mobile executive decisions

If mobile approval is considered risky, the UI should allow viewing but require desktop for final action.

## 18. Security Considerations
- session timeout should be shorter for executive approval actions
- sensitive decision submission should require CSRF protection and strong auth validation
- high-impact actions should use confirmation friction
- documents should respect access control and not leak direct storage URLs
- approval actions should be idempotent where possible

## 19. Reporting and Analytics
The module should support management reporting on:

- number of CGIS-routed cases
- approval turnaround time
- return rate
- rejection rate
- escalation rate
- department distribution
- threshold-band distribution

This helps validate whether low-value routing is functioning as intended.

## 20. Suggested Implementation Sequence
1. Add the module definition and role access mapping for `CGIS Approval`.
2. Build the queue endpoint and case detail payload.
3. Create the queue and detail UI inside the internal shell.
4. Add the decision action endpoints with policy validation.
5. Add the audit timeline and decision receipt.
6. Add notifications and reporting metrics.
7. Test low-value approval scenarios end to end.

## 21. Acceptance Criteria
- a low-value procurement routed to direct CGIS approval appears in the executive queue
- the case detail clearly states why board and BPP review are not required
- the approver can review summary, documents, and audit trail in one workspace
- every decision requires a rationale
- approval moves the case to the correct next stage
- invalid decisions are blocked by backend policy
- the final decision is visible in audit history

## 22. Future Enhancements
- dedicated `CGIS` identity role instead of reusing the legacy executive approval compatibility slot
- delegated approval support for an acting executive
- printable executive memo pack
- digitally signed approval receipt
- dashboard widget for urgent or aging executive cases
- side-by-side comparison of operational recommendation versus final executive decision

## 23. Recommendation
Implement `CGIS Approval` as a focused module within the current internal dashboard, not as a separate product surface.

That approach matches the current workflow model, preserves reuse of the internal shell, keeps permissions centralized, and gives the executive actor a cleaner decision environment without fragmenting the platform.
