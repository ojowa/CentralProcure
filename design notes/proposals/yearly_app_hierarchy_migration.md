# Yearly APP Hierarchy Migration

## Objective

Reshape APP data and workflow from the current flat model:

`Requisition -> Procurement Plan -> APP Item`

to the required annual hierarchy:

`Yearly APP -> Departmental Procurement Plan -> APP Item <- Requisition`

Example:

- `2026 APP`
- `ICT & Cybersecurity Procurement Plan 2026`
- `APP Items`: `Network Connectivity`, `MIDAS Installation`, other requisitions that passed planning committee

## Target Business Model

### 1. Yearly APP

One parent APP per fiscal year.

Example:

- `2026 APP`

Purpose:

- top-level annual container
- approval object for Procurement Secretary and Comptroller Procurement
- umbrella record for all departmental plans in that year

### 2. Departmental Procurement Plan

A plan belongs to one yearly APP.

Examples:

- `ICT & Cybersecurity Procurement Plan 2026`
- `Works Procurement Plan 2026`
- `Admin Procurement Plan 2026`

Purpose:

- groups APP items by department or planning domain
- receives requisitions that pass planning committee

### 3. APP Item

Each APP item belongs to one departmental procurement plan and is derived from one requisition that passed planning committee.

Purpose:

- line-level planning artifact
- traceable conversion of requisition into approved annual planning content

### 4. Requisition

The requisition remains the source transaction.

Purpose:

- enters planning committee
- if recommended, becomes an APP item under the correct departmental plan inside the yearly APP

## Proposed Schema

### New Table: `procurement_workflow.yearly_apps`

Suggested columns:

- `yearly_app_id uuid primary key`
- `fiscal_year int not null unique`
- `title varchar(150) not null`
- `status varchar(50) not null`
- `notes text null`
- `submitted_at timestamp null`
- `approved_at timestamp null`
- `created_at timestamp not null default now()`
- `updated_at timestamp not null default now()`

Suggested constraints:

- unique on `fiscal_year`
- check valid year range if already used elsewhere

### Change: `procurement_workflow.procurement_plans`

Add:

- `yearly_app_id uuid not null`

Foreign key:

- `procurement_plans.yearly_app_id -> yearly_apps.yearly_app_id`

Result:

- every departmental plan must belong to a yearly APP

### Change: `procurement_workflow.procurement_plan_items`

Add:

- `source_requisition_id uuid null`

Foreign key:

- `procurement_plan_items.source_requisition_id -> requisitions.requisition_id`

Recommended constraint:

- unique on `source_requisition_id` where not null

Reason:

- preserves hard trace from requisition to APP item
- avoids needing to rely only on `requisitions.app_item_id`

### Keep: `procurement_workflow.requisitions.app_item_id`

Keep it for backward compatibility and direct navigation.

Longer term it can remain as a convenience pointer if `source_requisition_id` is introduced on items.

## Data Relationship

Final relationship should be:

- `yearly_apps.yearly_app_id`
- `procurement_plans.yearly_app_id`
- `procurement_plan_items.plan_id`
- `procurement_plan_items.source_requisition_id`
- `requisitions.app_item_id`

That gives two-way traceability:

- `Yearly APP -> Plan -> APP Item -> Requisition`
- `Requisition -> APP Item -> Plan -> Yearly APP`

## Migration Steps

### Phase 1. Create yearly APP table

Add migration:

- create `procurement_workflow.yearly_apps`

Backfill:

- create one yearly APP row for each fiscal year already present in `procurement_plans`
- title format: `{fiscal_year} APP`
- status default:
  - if any plan in that year is `Approved`, use `Under Review` or `Submitted` based on current workflow policy
  - otherwise use `Under Review`

### Phase 2. Attach existing plans to yearly APP

Add migration:

- add `yearly_app_id` to `procurement_plans`

Backfill rule:

- join every plan to the `yearly_apps` row with matching `fiscal_year`

Then:

- set `yearly_app_id` `not null`

### Phase 3. Add requisition trace to APP items

Add migration:

- add `source_requisition_id` to `procurement_plan_items`

Backfill rule:

- for each requisition with `app_item_id`, set `procurement_plan_items.source_requisition_id = requisition_id`

Then:

- add unique index on `source_requisition_id`

### Phase 4. Add yearly workflow runtime

Create workflow runtime support for:

- entity type: `yearly_app`

Stages:

- `planning_committee_review`
- `app_approval`
- `procurement_initiation`

This becomes the approval workflow container instead of using each departmental plan as the approval object.

## Backend Workflow Changes

### A. Planning Committee Link Stage

Current behavior:

- requisition links directly to `procurement_plan`

Target behavior:

1. determine fiscal year from requisition
2. find or create `yearly_app` for that year
3. find or create departmental plan under that yearly APP
4. save requisition-to-plan link in `planning_committee_plan_links`

Files to change first:

- [PlanningCommitteeWorkspaceController.Linking.cs](/C:/Users/OJOWA/Documents/Project%204/CentralProcure/Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/PlanningCommitteeWorkspaceController.Linking.cs)

Required logic changes:

- replace flat plan lookup with:
  - resolve yearly APP by fiscal year
  - resolve departmental plan by `yearly_app_id + department + title`
- default new plan title should include year:
  - `ICT & Cybersecurity Procurement Plan 2026`

### B. Planning Committee Final Decision

Current behavior:

- final recommended decision creates APP item under `plan_id`

Target behavior:

- keep creating item under `plan_id`
- but that plan must already belong to a yearly APP
- add `source_requisition_id` when creating the item

Files to change first:

- [PlanningCommitteeWorkspaceController.Finalize.cs](/C:/Users/OJOWA/Documents/Project%204/CentralProcure/Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/PlanningCommitteeWorkspaceController.Finalize.cs)

Required logic changes:

- validate `plan.yearly_app_id` exists before item creation
- write `source_requisition_id`
- do not use departmental plan as final approval object
- sync yearly APP workflow instead

### C. Recommendation Readiness

Current behavior:

- readiness is checked per `procurement_plan`

Target behavior:

- readiness is checked per `yearly_app`
- counts requisitions across all plans under that yearly APP
- Procurement Secretary recommends the yearly APP, not an individual plan

Files to change first:

- [ProcurementPlanRecommendationsController.cs](/C:/Users/OJOWA/Documents/Project%204/CentralProcure/Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/ProcurementPlanRecommendationsController.cs)

Required refactor:

- split into:
  - `YearlyAppRecommendationsController`
  - optional helper service for rollup queries
- roll up readiness using:
  - all plans under `yearly_app_id`
  - all requisitions tied to those plans
  - all created APP items under those plans

### D. APP Approval Workflow

Current behavior:

- workflow runtime is tracked on `procurement_plan`

Target behavior:

- yearly APP is the workflow approval entity
- departmental plans remain organizational children

Required backend changes:

- add `yearly_app` runtime sync in `WorkflowRuntimeTracker`
- add display/DTO support for yearly APP stage and status
- move secretary recommendation from `procurement_plan` to `yearly_app`

### E. Procurement Initiation

Target behavior:

- after yearly APP approval, initiation can happen from approved plan items under approved yearly APP

Policy decision needed:

- whether initiation is triggered:
  - at yearly APP level
  - at departmental plan level
  - at APP item level

Recommended:

- yearly APP controls approval
- plan items control execution

## API Changes

### New Endpoints

- `GET /api/yearly-apps`
- `GET /api/yearly-apps/{yearlyAppId}`
- `GET /api/yearly-apps/{yearlyAppId}/plans`
- `GET /api/yearly-apps/{yearlyAppId}/recommendation-readiness`
- `POST /api/yearly-apps/{yearlyAppId}/recommend-for-approval`
- `POST /api/yearly-apps/{yearlyAppId}/approve`

### Existing Endpoint Changes

- `GET /api/procurement-plans`
  - include `yearlyAppId`
  - include `yearlyAppTitle`

- `GET /api/procurement-plans/{planId}`
  - include parent yearly APP summary

- planning committee workspace DTOs
  - include:
    - `YearlyAppId`
    - `YearlyAppTitle`
    - `FiscalYear`

## UI Redesign

### Main APP Module

Replace the current APP mental model with:

#### Level 1: Yearly APP Table

Table example:

- `2026 APP`
- `2027 APP`

Columns:

- title
- fiscal year
- status
- current stage
- plans count
- items count
- total budget
- recommendation readiness
- actions

Clicking a yearly APP opens its plans.

#### Level 2: Departmental Plan Table

Inside `2026 APP`:

- `ICT & Cybersecurity Procurement Plan 2026`
- `Works Procurement Plan 2026`
- `Admin Procurement Plan 2026`

Columns:

- plan title
- department
- status
- items count
- total amount

Clicking a plan opens its APP items.

#### Level 3: APP Item Table

Inside `ICT & Cybersecurity Procurement Plan 2026`:

- `Network Connectivity`
- `MIDAS Installation`

Columns:

- item description
- source requisition
- budget code
- procurement type
- amount
- status
- committee decision

### Secretary UI

Procurement Secretary should operate at yearly APP level.

The recommendation page should show:

- yearly APP summary
- all departmental plans under that year
- requisition readiness rollup
- blocking requisitions if any
- `Recommend APP to Comptroller` action

### Planning Committee UI

Planning committee still operates on requisitions, not yearly APP.

Needed additions:

- show target yearly APP for the requisition
- show target departmental plan for the requisition
- on recommendation, item is added under that plan inside that year

## Recommended Implementation Order

1. Add `yearly_apps` table and backfill.
2. Add `yearly_app_id` to `procurement_plans` and backfill.
3. Add `source_requisition_id` to `procurement_plan_items`.
4. Refactor planning committee link flow to resolve yearly APP first.
5. Refactor finalization flow to create items with parent yearly APP context.
6. Move APP recommendation endpoints from plan level to yearly APP level.
7. Redesign APP frontend to `Year -> Plans -> Items`.
8. Remove old plan-level APP recommendation UI.

## Risks

### 1. Current plan-level approval semantics

The code currently treats `procurement_plan` as the approval object. That will conflict with the yearly APP hierarchy until workflow runtime is moved to `yearly_app`.

### 2. Existing data duplication

Current plan creation reuses by `title + department + fiscal_year`. Backfill may reveal duplicates that need manual merge rules.

### 3. UI ambiguity

If both yearly APP and departmental plan are called “APP” in the UI, users will keep confusing container and child plan. Labels need to be explicit.

Recommended labels:

- `Annual APP`
- `Departmental Plan`
- `APP Item`

## Acceptance Criteria

- there is exactly one yearly APP per fiscal year
- every procurement plan belongs to a yearly APP
- every APP item belongs to a procurement plan and references its source requisition
- a recommended requisition becomes an APP item under the correct departmental plan
- Procurement Secretary recommends yearly APP, not departmental plan
- Comptroller Procurement approves yearly APP
- the APP UI renders `Yearly APP -> Plans -> Items`

## Decision Still Needed

One policy decision is still open:

- should there be exactly one departmental plan per department per year
- or can a department have multiple plans within the same year

Current recommendation:

- one yearly APP per fiscal year
- one departmental procurement plan per department per year
- many APP items per departmental plan

That gives the cleanest workflow and UI.
