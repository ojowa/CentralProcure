# Implementation Document: Workflow Visualization & Contextual UI

## 1. Objective
Replace technical state labels (e.g., `inspection_and_payment`) with a visual **Progress Stepper** and action-oriented status badges to improve user clarity while maintaining strict PPA compliance.

## 2. The Phase Mapping (Backend to Frontend)
We will group the 18 technical states into 5 logical phases:

| **Phase** | **Technical States Included** | **Visual Color** |
| :--- | :--- | :--- |
| **Planning** | `draft_requisition`, `needs_assessment`, `budget_reservation` | Blue |
| **Solicitation** | `tender_preparation`, `advertisement`, `bid_submission` | Orange |
| **Evaluation** | `bid_opening`, `technical_evaluation`, `financial_comparison` | Purple |
| **Approval** | `tenders_board_review`, `accounting_officer_approval`, `bpp_no_objection` | Yellow |
| **Post-Award** | `contract_execution`, `inspection_and_payment`, `closeout_and_audit` | NIS Green |

## 3. Core Components

### A. `WorkflowProgressStepper.tsx`
- **Visuals:** A horizontal chevron-style stepper.
- **Intelligence:** Receives the `currentStageKey`. It highlights the active Phase and marks previous phases as "Complete" (✅).

### B. `ContextualActionCard.tsx`
- **Logic:** Placed at the top of detail pages.
- **Content:** Uses the `grantedActions` set to guide the user on the next required step.

### C. `ActionStatusBadge.tsx`
- Replaces standard status text with human-readable labels.

## 4. Implementation Phases

- **Phase 1: Component Development** - Build the `WorkflowProgressStepper` and its styles.
- **Phase 2: Logic Mapping** - Create utility to map technical keys to phases.
- **Phase 3: Module Integration** - Inject components into `PaymentTrackingModulePage`.
- **Phase 4: Global Rollout** - Update Requisitions and Tenders.
