# Appendix G: CGIS Approval Wireframes
## Electronic Procurement System - Nigeria Immigration Service (NIS)

---

## Purpose

This document defines the wireframe-level structure for the `CGIS Approval` workspace inside the internal portal.

It is intended to help:

- product and compliance stakeholders validate the executive approval experience
- frontend developers implement consistent page structure
- backend developers understand the information payload the UI expects
- testers verify that the workflow is understandable and policy-aligned

This document assumes that `CGIS Approval` remains part of the internal role-based portal and is not implemented as a separate system.

---

## 1. Role and Workflow Context

### Primary actor
- `CGIS` executive approver

### Current implementation mapping
- workflow stage key: `accounting_officer_review`
- user-facing label: `CGIS Approval`

### Route position
- low-value path: `Evaluation -> CGIS Approval -> Award and Publication`

### Core UX goal
- give the approving authority a short, high-confidence path from review to decision

---

## 2. Sitemap Placement

### Internal portal path
- `Internal Dashboard`
  - `CGIS Approval`
    - `CGIS Queue`
    - `CGIS Case Detail`
    - `Decision Confirmation`
    - `Decision Receipt`

### Related modules
- `Tenders Board Approval`
- `BPP Escalation`
- `Audit Dashboard`
- `Workflow Diagnostics`

---

## 3. Wireframe Principles

- show the decision basis before the raw operational data
- expose threshold logic in plain language
- keep executive actions obvious and limited
- preserve traceability without cluttering the main decision surface
- separate read-only review content from write actions

---

## 4. Screen 1: CGIS Queue

### Goal
Show all procurement cases that are waiting for direct CGIS approval.

### Layout

#### Header zone
- page title: `CGIS Approval`
- short subtitle: `Review and decide low-value procurements routed for direct executive approval.`

#### Summary cards row
- `Pending Decisions`
- `Due Today`
- `Average Decision Time`
- `Returned for Clarification`
- `Approved This Week`

#### Filter bar
- search by case reference, title, vendor, or department
- filter by department
- filter by amount band
- filter by procurement method
- filter by risk level
- filter by status
- filter by submission date

#### Queue table
Columns:

- case reference
- title
- department
- selected vendor
- amount
- route
- recommendation
- days pending
- risk flags
- actions

#### Right-side or inline actions
- `Open`
- `Flag for Follow-up`
- `Export`

### Visual hierarchy
- aging cases should be highlighted
- high-risk cases should use a visible attention state
- `CGIS Direct Approval` route should be explicit in every row

### Empty state
Message:
- `No cases are currently awaiting CGIS approval.`

Secondary guidance:
- `Low-value cases routed to direct executive approval will appear here after evaluation is completed.`

---

## 5. Screen 2: CGIS Case Detail

### Goal
Present one case in a decision-ready layout with the least possible ambiguity.

### Layout model
Two-column desktop layout:

- left column: executive summary and recommendation
- right column: diagnostics, documents, audit, and actions

On tablet:
- stack the same blocks vertically

### Section A: Case Header
Content:

- case reference
- title
- current workflow stage
- originating department
- submitted date
- pending duration
- route badge: `CGIS Direct Approval`

Top-right utility actions:

- `Print Brief`
- `Download Pack`
- `Open Audit History`

### Section B: Executive Brief Card
Content:

- procurement purpose
- selected vendor
- recommended amount
- budget source or code
- procurement method
- delivery timeline
- one-paragraph executive summary

This card should answer:
- what is being approved
- who is being recommended
- how much it costs
- why the request is in front of CGIS

### Section C: Why This Reached CGIS
This block explains route logic in plain language.

Fields:

- threshold band matched
- approval authority label
- requires CGIS approval: `Yes`
- requires board review: `No`
- requires BPP prior review: `No`
- workflow note explaining route outcome

This block should be prominent because it prevents confusion with board or BPP cases.

### Section D: Recommendation Snapshot
Content:

- evaluator recommendation
- procurement recommendation
- compliant bidders count
- best-evaluated vendor
- price comparison summary
- reasons for recommendation

### Section E: Compliance and Risk Checklist
Checklist rows:

- APP linkage confirmed
- budget availability confirmed
- legal review completed
- financial validation completed
- vendor compliance pack complete
- complaint or petition pending
- exceptional approval note present

Status values:

- `Pass`
- `Attention Required`
- `Not Applicable`

### Section F: Supporting Pack
Tabbed document area:

- `Evaluation Report`
- `Bid Opening Record`
- `Tender Summary`
- `Vendor File`
- `Internal Notes`
- `Award Draft`

Expected behavior:

- read-only
- preview first when possible
- download only for permitted actors

### Section G: Audit Trail
Timeline component:

- stage entered
- stage exited
- actor
- role
- action performed
- date and time
- reason or note

This should support both:

- quick reading for executives
- deeper verification for audit and compliance

### Section H: Sticky Decision Panel
This panel remains visible while reviewing the case.

Content:

- current decision eligibility
- list of allowed actions
- summary of next step after action
- mandatory rationale field once an action is chosen

Primary actions:

- `Approve`
- `Reject`
- `Return for Clarification`
- `Escalate`

Action notes:

- `Approve` should be visually primary only when route diagnostics are valid
- `Escalate` should be shown only if backend policy allows it
- actions should be disabled when the record is not in a valid decision state

---

## 6. Screen 3: Decision Confirmation Modal

### Goal
Force deliberate decision-making before writing a high-impact approval event.

### Modal content
- selected action
- short action explanation
- mandatory rationale textarea
- optional conditional note
- next-stage preview
- compliance reminder

### Confirmation wording examples
- `You are about to approve this procurement for award publication.`
- `You are returning this case for clarification. The procurement team will need to respond before it can proceed.`

### Controls
- `Confirm Decision`
- `Cancel`

---

## 7. Screen 4: Decision Receipt

### Goal
Provide a final, non-ambiguous summary of what was decided.

### Layout
- success or result banner
- decision summary card
- routing outcome card
- links back to queue and audit record

### Content
- case reference
- actor
- role label shown to user
- decision type
- rationale
- decision timestamp
- next workflow stage
- audit record identifier

### Secondary actions
- `Return to Queue`
- `View Audit History`
- `Download Decision Receipt`

---

## 8. Desktop Wireframe Blocks

### 8.1 Queue page block order
1. page header
2. summary cards
3. filter bar
4. queue table
5. export or utility actions

### 8.2 Case detail page block order
1. case header
2. executive brief
3. route explanation
4. recommendation snapshot
5. compliance checklist
6. supporting pack
7. audit trail
8. sticky decision panel

---

## 9. Responsive Notes

### Desktop
- full split layout
- sticky decision panel on the right
- visible audit timeline without extra navigation

### Tablet
- stacked cards
- decision panel becomes sticky footer or anchored card
- document tabs collapse into accordions

### Mobile
- should support read-only review
- approval submission should only be enabled if leadership explicitly accepts mobile executive approvals

If mobile approval is restricted:
- show a clear message that final action requires a larger screen

---

## 10. UX States

### Loading state
- summary skeletons
- placeholder queue rows
- document preview loader

### Error state
- `Unable to load this approval case.`
- retry button
- optional support reference id

### Access denied state
- `You do not have permission to review or decide this case.`

### Already decided state
- show final decision banner
- disable action panel
- keep documents and audit read-only

---

## 11. Field-Level Content Guidance

### Preferred labels
- `CGIS Approval`
- `Executive Brief`
- `Why this case reached CGIS`
- `Recommendation Snapshot`
- `Compliance Flags`
- `Decision Receipt`

### Avoid
- `accounting_officer_review`
- `workflow payload`
- `policy object`
- `controller diagnostics`

---

## 12. Annotation for Backend Payload Design

Each case detail payload should be sufficient to render:

- executive summary
- route diagnostics
- recommendation details
- compliance indicators
- document links or previews
- audit history
- allowed actions
- next-stage preview for each action

The UI should not infer action validity from role name alone.

---

## 13. Testing Guidance for the Wireframe

The implemented UI should be tested against these questions:

- can the approver tell in under 10 seconds why the case reached CGIS
- can the approver identify the recommended vendor and amount without opening attachments
- can the approver see whether board or BPP review is required
- can the approver make a decision without editing operational records
- is every action accompanied by a clear workflow consequence
- does the page still remain readable when the supporting pack is incomplete

---

## 14. Recommended Next Design Step

Translate these wireframes into:

- component-level UI inventory
- content model for queue and detail pages
- interaction states for approval, return, rejection, and escalation

---

**Document Type:** Wireframe Specification  
**Audience:** Product, Design, Frontend, Backend, QA  
**Format:** Markdown (.md)
