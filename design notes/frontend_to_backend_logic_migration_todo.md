# Frontend-to-Backend Authority Migration TODO

## Goal

Move authority decisions out of the frontend and into the backend for the following concerns:

- who can access a module
- who can perform an action
- what workflow state comes next
- whether a record is editable
- whether a complaint, link, or approval is allowed
- how thresholds and approval routes are resolved

The frontend should remain responsible for rendering, local interaction state, and presentation only.

## Current Frontend-Owned Authority Logic

### 1. Module Access and Role-Based Visibility

Frontend currently contains access policy and fallback behavior in:

- `Frontend/src/internal/data/internalData.ts`
- `Frontend/src/internal/components/InternalShellLayout.tsx`
- `Frontend/src/internal/services/internalAuthService.ts`

Current problems:

- `allowedRoles` and `actions` are still defined in frontend fallback catalog data.
- `roleModuleFallbacks` can synthesize module access even when backend data is incomplete.
- role normalization and alias resolution are interpreted in the frontend.
- module availability is partly a client decision instead of a server decision.

Backend target:

- backend returns the exact module catalog visible to the current user
- backend returns canonical role keys and display labels
- backend returns module action grants per module
- frontend does not merge policy fallbacks on top of backend access decisions

### 2. Record-Level Action Eligibility

Frontend currently decides editability and role-based action eligibility in:

- `Frontend/src/internal/components/CreateRequisitionPage.tsx`
- `Frontend/src/internal/data/internalData.ts`
- `Frontend/src/internal/components/AdminRequisitionManagementPage.tsx`
- `Frontend/src/internal/components/RequisitionHistoryPage.tsx`
- `Frontend/src/internal/components/RequisitionTrackingPage.tsx`

Current problems:

- editable statuses are maintained in frontend sets
- role checks such as `admin`, `department_head`, `comptroller_procurement` are made in UI code
- departmenct head queues are built from client-side status buckets
- screens infer permissions from `role + status` instead of consuming backend grants

Backend target:

- backend returns record-level action grants such as `CanEdit`, `CanDelete`, `CanSubmit`, `CanEndorse`, `CanRoute`, `CanApprove`
- backend returns queue membership and workflow task assignment from canonical workflow rules
- frontend only checks returned grants to show or hide controls

### 3. Workflow State and Transition Rules

Frontend currently owns workflow grouping and some transition assumptions in:

- `Frontend/src/internal/utils/workflow.ts`
- `Frontend/src/internal/components/WorkflowProgressStepper.tsx`
- `Frontend/src/internal/components/ComplaintFilingModule.tsx`
- `Frontend/src/internal/components/planning-committee/hooks/usePlanningCommittee.ts`
- `Frontend/src/internal/services/moduleService.ts`

Current problems:

- stage-to-phase mapping is defined in frontend constants
- human-readable workflow status is derived in frontend mapping tables
- complaint-eligible stages are hardcoded in frontend
- planning committee flow decisions are partly client-assembled
- administrative review update payloads force workflow outcomes in frontend

Backend target:

- backend returns workflow runtime snapshot with:
  - current stage key
  - current phase key
  - phase label
  - next available actions
  - current actor grants
  - editability flags
  - complaint eligibility
- backend accepts action intents and computes resulting transitions internally
- frontend never decides the next workflow state

### 4. Threshold and Approval Route Resolution

Frontend currently derives threshold and routing behavior in:

- `Frontend/src/internal/data/internalData.ts`
- `Frontend/src/internal/components/CreateRequisitionPage.tsx`
- `Frontend/src/internal/utils/procureUtils.ts`

Current problems:

- threshold bands are available in frontend catalog data
- routing is resolved in the browser from estimated amount
- approval path can be inferred without a backend decision

Backend target:

- backend resolves threshold route from persisted threshold configuration
- backend returns route decision fields such as:
  - `ApprovalRoute`
  - `ApprovalAuthorityCode`
  - `ApprovalAuthorityLabel`
  - `RequiresBoard`
  - `RequiresCgisApproval`
  - `RequiresBpp`
- frontend displays backend decisions only

### 5. Planning Committee Linking and Finalization Rules

Frontend currently performs planning committee workflow decisions in:

- `Frontend/src/internal/components/planning-committee/hooks/usePlanningCommittee.ts`
- `Frontend/src/internal/components/planning-committee/views/ReviewWorkspace.tsx`
- `Frontend/src/internal/components/planning-committee/components/LinkToPlanModal.tsx`

Current problems:

- frontend filters only `Under Review` requisitions for committee work
- frontend splits linked and unlinked requisitions
- frontend checks for duplicate plans before creating a new plan
- frontend generates `MeetingDate`
- frontend sends both `ChairmanUserId` and `SecretaryUserId` from the same UI identity
- frontend decides when unlinking requires a reason

Backend target:

- backend exposes explicit committee queue endpoints
- backend validates and creates or reuses committee plan links
- backend sets meeting metadata and actor attribution from authenticated identity
- backend decides unlink preconditions and required reason rules
- backend returns committee state already normalized for rendering

## Migration Principles

1. The backend is the source of truth for policy, workflow, and authorization.
2. The frontend consumes explicit grants and display metadata.
3. The frontend may validate for user experience, but backend validation must be authoritative.
4. No workflow transition should be inferable only from client code.
5. Every mutating endpoint should enforce role, module, workflow-stage, and record-state rules.

## Implementation Plan

### Phase 1. Inventory and Lock Down Existing Authority Logic

TODO:

- Identify all frontend files that check role names directly.
- Identify all frontend files that branch on workflow status directly for authority decisions.
- Identify all frontend files that compute threshold or approval routing.
- Identify all frontend files that hardcode module access or fallback access.
- Add a temporary migration checklist issue per feature area:
  - requisitions
  - planning committee
  - approvals
  - complaints
  - module access
  - threshold routing

Done when:

- every frontend authority rule has an owner and a backend destination

### Phase 2. Define Backend Contract for Authority and Workflow Metadata

TODO:

- Add or extend backend DTOs to return explicit action grants.
- Add or extend workflow runtime DTOs to return:
  - current stage
  - current phase
  - stage label
  - workflow status label
  - allowed actions
  - complaint eligibility
  - editability
  - threshold decision
- Add or extend module access DTOs to return:
  - module id
  - title
  - section
  - description
  - visible actions
  - effective grants
- Standardize canonical role names in backend responses.

Suggested DTO additions:

- `AllowedActions: string[]`
- `CanEdit: bool`
- `CanDelete: bool`
- `CanSubmit: bool`
- `CanApprove: bool`
- `CanReject: bool`
- `CanLinkPlan: bool`
- `CanUnlinkPlan: bool`
- `CanFileComplaint: bool`
- `CurrentPhaseKey: string`
- `CurrentPhaseLabel: string`
- `WorkflowDisplayStatus: string`
- `ThresholdDecision: { ... }`

Done when:

- frontend can render state and permissions without inferring business rules

### Phase 3. Centralize Authorization in Backend

TODO:

- Ensure module visibility is derived from backend role and module access tables only.
- Remove any need for frontend `roleModuleFallbacks`.
- Ensure backend returns effective grants for:
  - module access by role
  - module access by user override
  - record-level action eligibility
- Ensure backend denies unauthorized actions even if frontend submits them manually.

Backend focus areas:

- `Backend/Modules/eProcurement.Modules.Identity`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow`
- `Backend/Shared/Workflow`

Done when:

- backend can answer both:
  - "can this user see this module?"
  - "can this user do this action on this record right now?"

### Phase 4. Centralize Workflow Decisions in Backend

TODO:

- Move stage-to-phase ownership into backend workflow metadata.
- Return display-ready workflow labels from backend.
- Add backend checks for complaint eligibility based on live stage and statutory rules.
- Ensure committee decision submission computes:
  - actor roles
  - stage transition
  - audit trail
  - meeting metadata
- Ensure administrative review resolution computes resulting workflow status server-side.

Done when:

- frontend only submits action intent, not transition logic

### Phase 5. Centralize Threshold and Route Resolution in Backend

TODO:

- Make threshold configuration endpoints the only source of route rules.
- Move amount-to-route resolution into backend service logic.
- Return computed threshold decision on requisition detail and workflow detail endpoints.
- Prevent frontend from choosing route labels or BPP requirements.

Done when:

- all approval route and threshold decisions are computed server-side

### Phase 6. Centralize Planning Committee Queue and Linking Rules

TODO:

- Add backend endpoints for:
  - committee pending queue
  - committee linked queue
  - committee workspace detail
- Move duplicate-plan detection and plan reuse logic to backend.
- Move plan-link and unlink validation to backend.
- Derive chair, secretary, and reviewer identity from authenticated session and backend role assignments.
- Set meeting timestamps server-side.

Done when:

- frontend no longer assembles committee workflow rules from raw data

### Phase 7. Refactor Frontend to Consume Backend Grants

TODO:

- Remove `roleModuleFallbacks` usage from `InternalShellLayout`.
- Remove frontend `allowedRoles` dependency for authority decisions.
- Replace role/status checks in pages with backend grant flags.
- Replace stage-to-phase mapping constants with backend-provided phase metadata.
- Replace threshold route derivation with backend-provided threshold decision.
- Keep only presentation behavior in frontend.

High-priority frontend files to simplify:

- `Frontend/src/internal/components/InternalShellLayout.tsx`
- `Frontend/src/internal/data/internalData.ts`
- `Frontend/src/internal/utils/workflow.ts`
- `Frontend/src/internal/components/WorkflowProgressStepper.tsx`
- `Frontend/src/internal/components/CreateRequisitionPage.tsx`
- `Frontend/src/internal/components/ComplaintFilingModule.tsx`
- `Frontend/src/internal/components/planning-committee/hooks/usePlanningCommittee.ts`
- `Frontend/src/internal/services/moduleService.ts`
- `Frontend/src/internal/services/internalAuthService.ts`

Done when:

- frontend branches only on backend grants and presentation state

## Suggested Backend Endpoint Changes

### Module Access

- extend `GET /api/Auth/internal/modules`
- optionally add `GET /api/Auth/internal/modules/effective`

Expected behavior:

- return only modules the current user can access
- include effective actions and grants
- include canonical role and source of access if needed for auditing

### Requisition Detail and List

- extend requisition list/detail payloads with:
  - workflow phase metadata
  - threshold decision
  - record action grants
  - complaint eligibility

### Planning Committee

- add queue-focused endpoints instead of client filtering raw requisitions
- return fully prepared workspace state
- accept action-intent requests rather than client-decided transitions

### Workflow Runtime

- extend runtime endpoints to return:
  - phase
  - labels
  - next actions
  - record editability
  - complaint permission

## Frontend Removal Checklist

Remove or neutralize the following frontend authority patterns:

- direct checks like `role === 'admin'`
- `allowedRoles` used as enforcement
- hardcoded editable status sets
- hardcoded complaint-eligible stage lists
- hardcoded threshold bands for authority decisions
- client-generated workflow status labels where backend can supply them
- client-side queue splitting based on domain rules
- client-generated meeting metadata for workflow decisions

## Acceptance Criteria

- A user cannot gain access to a module because of frontend fallback logic.
- A user cannot perform an action because the frontend guessed it was allowed.
- Every mutating request is validated against backend workflow state.
- Workflow phase and display labels come from backend metadata.
- Threshold and approval route decisions come from backend logic only.
- Planning committee queue composition and link rules come from backend endpoints.
- Frontend remains responsible only for rendering and UX.

## Recommended Work Order

1. module access and canonical role contract
2. requisition action grants and editability flags
3. workflow runtime metadata and display fields
4. threshold route resolution
5. planning committee queue and link rules
6. complaint eligibility and administrative review action intents
7. frontend cleanup and fallback removal

## Notes

- Do not migrate simple UX validation that only improves usability.
- Do not remove frontend loading, sorting, search, and presentation logic unless it encodes policy.
- The safest migration path is additive first:
  - add backend grants and metadata
  - switch frontend to consume them
  - remove old frontend authority logic after parity is verified

## Backend Execution Checklist

This section maps the migration to concrete backend files that already exist in the codebase.

### Identity Module Access and Canonical Role Contract

Primary backend files:

- `Backend/Modules/eProcurement.Modules.Identity/Controllers/AuthController.Internal.cs`
- `Backend/Modules/eProcurement.Modules.Identity/Controllers/AuthController.ModuleAccess.cs`
- `Backend/Modules/eProcurement.Modules.Identity/Controllers/AuthController.Users.Core.cs`
- `Backend/Modules/eProcurement.Modules.Identity/Controllers/AuthController.Mapping.cs`
- `Backend/Modules/eProcurement.Modules.Identity/DTOs/AuthDTOs.cs`
- `Backend/Modules/eProcurement.Modules.Identity/Services/InternalModuleCatalog.cs`

Implementation checklist:

- [ ] Review `GET /api/Auth/internal/modules` in `AuthController.Internal.cs` and make it the single source of module visibility.
- [ ] Remove the need for frontend module fallback merging by ensuring the endpoint always returns the effective module set for the authenticated user.
- [ ] Add effective grant fields to the internal module response DTO in `AuthDTOs.cs`.
- [ ] Ensure module responses include canonical role keys and not just display labels.
- [ ] Move any remaining role alias normalization into backend mapping helpers in `AuthController.Mapping.cs`.
- [ ] Extend `InternalModuleCatalog.cs` so module definitions are complete enough for the frontend to render without policy fallbacks.
- [ ] Verify `AuthController.ModuleAccess.cs` exposes enough data to distinguish:
  - role-based grants
  - user override grants
  - effective grant outcome
- [ ] Add an endpoint if needed for `effective modules` instead of making the client infer them.

Definition of done:

- `GET /api/Auth/internal/modules` returns the exact modules and action grants the user may access.
- frontend no longer uses `roleModuleFallbacks` for enforcement.

### Workflow Action Grants and Record Editability

Primary backend files:

- `Backend/Shared/Workflow/WorkflowActionGrantService.cs`
- `Backend/Shared/Workflow/WorkflowRuntimeTracker.cs`
- `Backend/Shared/Workflow/WorkflowPolicyGuard.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowActionsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowRuntimeController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/RequisitionDTOs.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/PlanningCommitteeReviewDTOs.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/AdministrativeReviewDTOs.cs`

Implementation checklist:

- [ ] Audit `WorkflowActionGrantService.cs` and align its stage-to-action grants with current frontend permission checks.
- [ ] Extend action grant output so it can drive UI booleans such as:
  - `CanEdit`
  - `CanDelete`
  - `CanSubmit`
  - `CanApprove`
  - `CanReject`
  - `CanLinkPlan`
  - `CanUnlinkPlan`
  - `CanFileComplaint`
- [ ] Extend `WorkflowActionsController.cs` to expose effective action grants for any entity with runtime state.
- [ ] Extend `WorkflowRuntimeController.cs` to return editability and action grant metadata with runtime snapshots.
- [ ] Add DTO fields in the workflow DTOs so requisition, committee, and administrative review pages do not infer permissions from role and status.
- [ ] Ensure grants are computed from:
  - current role
  - current workflow stage
  - live threshold route
  - record status
  - linked entity state

Definition of done:

- frontend pages use backend grant fields instead of checking `role === ...` or `status === ...` for authority.

### Threshold and Approval Route Resolution

Primary backend files:

- `Backend/Shared/Workflow/WorkflowPolicyGuard.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/RequisitionsController.Workflow.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowRoutingController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowConfigurationsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowConfigurationsController.Data.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowConfigurationsController.Thresholds.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Services/WorkflowBlueprintCatalog.cs`

Implementation checklist:

- [ ] Treat `WorkflowPolicyGuard.ResolveThresholdAsync` as the only authority for route resolution.
- [ ] Extend `WorkflowRoutingController.cs` to return display-ready threshold decisions for frontend consumption.
- [ ] Extend requisition workflow DTOs to carry threshold resolution output directly.
- [ ] Ensure `RequisitionsController.Workflow.cs` persists threshold results into workflow runtime consistently.
- [ ] Reuse `WorkflowConfigurationsController.*` as the admin source of truth for live threshold policy.
- [ ] Ensure `WorkflowBlueprintCatalog.cs` fallback thresholds are clearly marked as fallback-only and not used when live thresholds exist.
- [ ] Return route fields the frontend can render directly:
  - `ApprovalRoute`
  - `ApprovalAuthorityCode`
  - `ApprovalAuthorityLabel`
  - `RequiresCgisApproval`
  - `RequiresBoard`
  - `RequiresBpp`
  - `GovernanceBodyName`
  - `ThresholdNotes`

Definition of done:

- frontend never computes threshold bands or approval routes from local constants.

### Requisition Workflow and Record-Level Authority

Primary backend files:

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/RequisitionsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/RequisitionsController.Data.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/RequisitionsController.Validation.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/RequisitionsController.Workflow.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/RequisitionDTOs.cs`

Implementation checklist:

- [ ] Extend requisition list endpoints to return record-level grants and workflow metadata.
- [ ] Extend requisition detail endpoints to return:
  - current stage key
  - current phase key
  - workflow display status
  - threshold decision
  - action grants
  - complaint eligibility
- [ ] Move all status-based editability checks into backend validation and response metadata.
- [ ] Add backend queue semantics for department head and administrative review worklists instead of client-side status buckets.
- [ ] Ensure requisition write endpoints reject unauthorized edits even if the frontend submits them.

Definition of done:

- requisition screens can render entirely from backend grants and metadata.

### Planning Committee Queue, Linking, and Decision Rules

Primary backend files:

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/PlanningCommitteeReviewController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/ProcurementPlansController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/ProcurementPlanItemsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/PlanningCommitteeReviewDTOs.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/ProcurementPlanDTOs.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/RequisitionDTOs.cs`
- `Backend/Shared/Workflow/WorkflowRuntimeTracker.cs`
- `Backend/Shared/Workflow/WorkflowPolicyGuard.cs`

Implementation checklist:

- [ ] Add queue-oriented endpoints to `PlanningCommitteeReviewController.cs` for:
  - pending committee queue
  - linked committee queue
  - committee workspace detail
- [ ] Move linked vs unlinked requisition classification into backend responses.
- [ ] Move duplicate committee plan detection into backend create/link flow.
- [ ] Ensure link and unlink rules are enforced server-side, including reason requirements.
- [ ] Ensure committee decision endpoints derive:
  - acting user
  - chairman identity
  - secretary identity
  - meeting timestamp
  - next workflow transition
  from authenticated backend context and persisted role assignment, not from client payload assumptions.
- [ ] Extend planning committee DTOs with action grants and normalized queue fields.
- [ ] Ensure runtime tracking is updated whenever a plan link, unlink, review, or final decision changes workflow state.

Definition of done:

- frontend planning committee screens only render queue data and submit action intents.

### Complaint Eligibility and Administrative Review Actions

Primary backend files:

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.Read.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.Write.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.Validation.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/AdministrativeReviewsController.Data.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/AdministrativeReviewDTOs.cs`
- `Backend/Shared/Workflow/WorkflowPolicyGuard.cs`
- `Backend/Shared/Workflow/WorkflowRuntimeTracker.cs`

Implementation checklist:

- [ ] Move complaint-eligible stage validation fully into `AdministrativeReviewsController.Validation.cs`.
- [ ] Add response fields that tell the frontend whether complaint filing is currently allowed for a record.
- [ ] Refactor write endpoints so the frontend submits action intent, not forced resulting status.
- [ ] Ensure complaint creation updates workflow runtime consistently through `WorkflowRuntimeTracker.cs`.
- [ ] Ensure complaint resolution and closure transitions are computed server-side.
- [ ] Return updated workflow metadata after complaint actions.

Definition of done:

- complaint filing and resolution are governed entirely by backend workflow rules.

### CGIS, Board, BPP, and Approval Path Decisions

Primary backend files:

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/CgisApprovalController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/BppNoObjectionsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/EvaluationsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/EvaluationReportsController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowRoutingController.cs`
- `Backend/Shared/Workflow/WorkflowPolicyGuard.cs`
- `Backend/Shared/Workflow/WorkflowActionGrantService.cs`

Implementation checklist:

- [ ] Verify each approval controller enforces live threshold route decisions from `WorkflowPolicyGuard.cs`.
- [ ] Ensure evaluation outputs expose the next valid approval path from backend metadata.
- [ ] Ensure approval controllers reject actions inconsistent with current stage or threshold policy.
- [ ] Return updated action grants after approval actions so frontend controls refresh from backend truth.

Definition of done:

- approval workflows are not inferred by frontend stage names or amount bands.

### Workflow Metadata and Display Contract

Primary backend files:

- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Services/WorkflowBlueprintCatalog.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowBlueprintController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/Controllers/WorkflowRuntimeController.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/WorkflowBlueprintDTOs.cs`
- `Backend/Modules/eProcurement.Modules.ProcurementWorkflow/DTOs/WorkflowConfigurationDTOs.cs`

Implementation checklist:

- [ ] Use `WorkflowBlueprintCatalog.cs` as the canonical source for phase and stage display metadata.
- [ ] Extend runtime responses to include phase label and workflow display status so frontend mapping tables can be removed.
- [ ] Make sure display labels align with workflow configuration and runtime state.
- [ ] If needed, add a compact display DTO for stepper and badges.

Definition of done:

- frontend components render workflow visuals from backend-supplied metadata only.

## Suggested Delivery Sequence by Backend File Group

### Sprint 1

- `AuthController.Internal.cs`
- `AuthController.ModuleAccess.cs`
- `AuthDTOs.cs`
- `InternalModuleCatalog.cs`

Goal:

- eliminate frontend module fallback enforcement

### Sprint 2

- `WorkflowActionGrantService.cs`
- `WorkflowRuntimeController.cs`
- `WorkflowActionsController.cs`
- `RequisitionDTOs.cs`
- `RequisitionsController.*`

Goal:

- expose action grants and editability on requisitions

### Sprint 3

- `WorkflowPolicyGuard.cs`
- `WorkflowRoutingController.cs`
- `WorkflowConfigurationsController.*`
- `RequisitionsController.Workflow.cs`

Goal:

- make threshold and approval routing fully backend-derived

### Sprint 4

- `PlanningCommitteeReviewController.cs`
- `PlanningCommitteeReviewDTOs.cs`
- `ProcurementPlansController.cs`
- `ProcurementPlanItemsController.cs`

Goal:

- move planning committee queue, linking, and finalization rules to backend

### Sprint 5

- `AdministrativeReviewsController.*`
- `AdministrativeReviewDTOs.cs`
- `WorkflowRuntimeTracker.cs`

Goal:

- move complaint eligibility and review transitions fully to backend

## Frontend Refactor Trigger Points

Once the backend work above lands, remove or simplify these frontend files in this order:

1. `Frontend/src/internal/components/InternalShellLayout.tsx`
2. `Frontend/src/internal/services/internalAuthService.ts`
3. `Frontend/src/internal/data/internalData.ts`
4. `Frontend/src/internal/components/CreateRequisitionPage.tsx`
5. `Frontend/src/internal/utils/workflow.ts`
6. `Frontend/src/internal/components/WorkflowProgressStepper.tsx`
7. `Frontend/src/internal/components/planning-committee/hooks/usePlanningCommittee.ts`
8. `Frontend/src/internal/components/ComplaintFilingModule.tsx`
9. `Frontend/src/internal/services/moduleService.ts`
