import type { ProcurementPlanDetail, ProcurementPlanItemDetail } from '../types/internal';
import type { YearlyAppDetail, YearlyAppPlanSummary } from '../services/procurementPlanService';
import { ProcurementPlanActionsPanel } from './ProcurementPlanActionsPanel';
import { ProcurementPlanWorkflowSummary } from './ProcurementPlanWorkflowSummary';

type Props = {
  selectedYearlyApp: YearlyAppDetail;
  includedPlans: YearlyAppPlanSummary[];
  pendingPlans: YearlyAppPlanSummary[];
  selectedPlan: ProcurementPlanDetail | null;
  planItems: ProcurementPlanItemDetail[];
  loading: boolean;
  actionError: string | null;
  approvalNote: string;
  thresholdSummary: string | null;
  canTakeApprovalDecision: boolean;
  isAwaitingAppApproval: boolean;
  isAwaitingCgisApproval: boolean;
  isAtProcurementInitiation: boolean;
  onApprovalNoteChange: (value: string) => void;
  onApprovalDecision: (decision: 'approve' | 'return' | 'reject') => void;
  onInitiateProcurement: () => void;
  onOpenPlan: (planId: string) => void;
  onEditYearlyApp?: (app: YearlyAppDetail) => void;
  onSubmitYearlyApp?: (app: YearlyAppDetail) => void;
};

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

export const ProcurementPlanYearlyAppDetail = ({
  selectedYearlyApp,
  includedPlans = [],
  pendingPlans = [],
  selectedPlan,
  planItems,
  loading,
  actionError,
  approvalNote,
  thresholdSummary,
  canTakeApprovalDecision,
  isAwaitingAppApproval,
  isAwaitingCgisApproval,
  isAtProcurementInitiation,
  onApprovalNoteChange,
  onApprovalDecision,
  onInitiateProcurement,
  onOpenPlan,
  onEditYearlyApp,
  onSubmitYearlyApp
}: Props) => (
  <div className="app-detail-view">
    {/* Yearly APP Summary Card */}
    <div className="app-card app-card--highlight">
      <div className="app-card__header">
        <div className="app-entity-header">
          <div className="app-entity-header__icon">📅</div>
          <div className="app-entity-header__info">
            <h3 className="app-entity-header__title">{selectedYearlyApp.Title}</h3>
            <p className="app-entity-header__meta">Yearly Annual Procurement Plan • Fiscal Year {selectedYearlyApp.FiscalYear}</p>
          </div>
          <div className="app-entity-header__badge">
            <span className={`app-badge app-badge--${selectedYearlyApp.Status.toLowerCase().replace(' ', '-')}`}>
              {selectedYearlyApp.Status}
            </span>
          </div>
          <div className="app-entity-header__actions">
            {onEditYearlyApp && selectedYearlyApp.Status === 'Draft' && (
              <button
                className="app-btn app-btn--secondary app-btn--sm"
                onClick={() => onEditYearlyApp(selectedYearlyApp)}
              >
                Edit
              </button>
            )}
            {onSubmitYearlyApp && selectedYearlyApp.Status === 'Draft' && (
              <button
                className="app-btn app-btn--primary app-btn--sm"
                onClick={() => onSubmitYearlyApp(selectedYearlyApp)}
              >
                Submit for Approval
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="app-metrics-row">
        <div className="app-metric">
          <span className="app-metric__label">Total Budget</span>
          <strong className="app-metric__value">{money(selectedYearlyApp.TotalBudget)}</strong>
        </div>
        <div className="app-metric">
          <span className="app-metric__label">Departmental Plans</span>
          <strong className="app-metric__value">{selectedYearlyApp.PlansCount}</strong>
        </div>
        <div className="app-metric">
          <span className="app-metric__label">Approved Plans</span>
          <strong className="app-metric__value app-metric__value--success">{selectedYearlyApp.IncludedPlansCount}</strong>
        </div>
        <div className="app-metric">
          <span className="app-metric__label">Pending Plans</span>
          <strong className="app-metric__value app-metric__value--warning">{selectedYearlyApp.PendingPlansCount}</strong>
        </div>
        <div className="app-metric">
          <span className="app-metric__label">Total Items</span>
          <strong className="app-metric__value">{selectedYearlyApp.ItemsCount}</strong>
        </div>
      </div>
    </div>

    {/* Included Plans Section */}
    <section className="app-card">
      <div className="app-card__header">
        <div className="app-section-title">
          <span className="app-section-title__icon app-section-title__icon--success">✓</span>
          <h3 className="app-section-title__text">Included Departmental Plans</h3>
          <span className="app-section-title__count">{includedPlans.length}</span>
        </div>
        <p className="app-card__description">Approved departmental plans that are part of this yearly APP</p>
      </div>

      <div className="app-table-wrapper">
        <table className="app-table app-table--compact">
          <thead>
            <tr>
              <th>Plan Title</th>
              <th>Department</th>
              <th>Stage</th>
              <th>Status</th>
              <th className="app-table__cell--numeric">Total Budget</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {includedPlans.map((plan) => (
              <tr
                key={plan.PlanId}
                className={`app-table__row ${selectedPlan?.PlanId === plan.PlanId ? 'app-table__row--selected' : ''}`}
              >
                <td className="app-table__cell app-table__cell--strong">{plan.PlanTitle}</td>
                <td className="app-table__cell">{plan.Department}</td>
                <td className="app-table__cell">
                  <span className="app-stage-tag">{plan.CurrentStageTitle || plan.CurrentStageKey}</span>
                </td>
                <td className="app-table__cell">
                  <span className={`app-badge app-badge--${plan.Status.toLowerCase()}`}>{plan.Status}</span>
                </td>
                <td className="app-table__cell app-table__cell--numeric">{money(plan.TotalBudget)}</td>
                <td className="app-table__cell">
                  <button className="app-btn app-btn--sm app-btn--secondary" onClick={() => onOpenPlan(plan.PlanId)}>
                    View Plan
                  </button>
                </td>
              </tr>
            ))}
            {includedPlans.length === 0 && (
              <tr>
                <td colSpan={6} className="app-table__empty">
                  <div className="app-empty-state app-empty-state--small">
                    <span className="app-empty-state__icon">📋</span>
                    <p>No approved departmental plans included yet</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>

    {/* Pending Plans Section */}
    <section className="app-card">
      <div className="app-card__header">
        <div className="app-section-title">
          <span className="app-section-title__icon app-section-title__icon--warning">⏳</span>
          <h3 className="app-section-title__text">Pending Departmental Plans</h3>
          <span className="app-section-title__count">{pendingPlans.length}</span>
        </div>
        <p className="app-card__description">Plans awaiting Procurement Secretary recommendation to Comptroller Procurement</p>
      </div>

      <div className="app-table-wrapper">
        <table className="app-table app-table--compact">
          <thead>
            <tr>
              <th>Plan Title</th>
              <th>Department</th>
              <th>Stage</th>
              <th>Status</th>
              <th className="app-table__cell--numeric">Total Budget</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingPlans.map((plan) => (
              <tr
                key={plan.PlanId}
                className={`app-table__row ${selectedPlan?.PlanId === plan.PlanId ? 'app-table__row--selected' : ''}`}
              >
                <td className="app-table__cell app-table__cell--strong">{plan.PlanTitle}</td>
                <td className="app-table__cell">{plan.Department}</td>
                <td className="app-table__cell">
                  <span className="app-stage-tag">{plan.CurrentStageTitle || plan.CurrentStageKey}</span>
                </td>
                <td className="app-table__cell">
                  <span className={`app-badge app-badge--${plan.Status.toLowerCase()}`}>{plan.Status}</span>
                </td>
                <td className="app-table__cell app-table__cell--numeric">{money(plan.TotalBudget)}</td>
                <td className="app-table__cell">
                  <button className="app-btn app-btn--sm app-btn--primary" onClick={() => onOpenPlan(plan.PlanId)}>
                    Open Plan
                  </button>
                </td>
              </tr>
            ))}
            {pendingPlans.length === 0 && (
              <tr>
                <td colSpan={6} className="app-table__empty">
                  <div className="app-empty-state app-empty-state--small">
                    <span className="app-empty-state__icon">✓</span>
                    <p>No pending departmental plans</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>

    {/* Selected Plan Details */}
    {selectedPlan ? (
      <>
        <section className="app-card app-card--selected">
          <div className="app-card__header">
            <div className="app-section-title">
              <span className="app-section-title__icon">📄</span>
              <h3 className="app-section-title__text">Selected Departmental Plan</h3>
            </div>
          </div>

          <div className="app-plan-summary">
            <div className="app-plan-summary__item">
              <span className="app-plan-summary__label">Plan Title</span>
              <strong className="app-plan-summary__value">{selectedPlan.PlanTitle}</strong>
            </div>
            <div className="app-plan-summary__item">
              <span className="app-plan-summary__label">Department</span>
              <strong className="app-plan-summary__value">{selectedPlan.Department}</strong>
            </div>
            <div className="app-plan-summary__item">
              <span className="app-plan-summary__label">Current Stage</span>
              <span className="app-stage-tag app-stage-tag--active">{selectedPlan.CurrentStageTitle || selectedPlan.CurrentStageKey}</span>
            </div>
            <div className="app-plan-summary__item">
              <span className="app-plan-summary__label">Total Budget</span>
              <strong className="app-plan-summary__value app-plan-summary__value--highlight">{money(selectedPlan.TotalBudget)}</strong>
            </div>
          </div>
        </section>

        <ProcurementPlanWorkflowSummary selectedPlan={selectedPlan} />

        {/* APP Items Section */}
        <section className="app-card">
          <div className="app-card__header">
            <div className="app-section-title">
              <span className="app-section-title__icon">📦</span>
              <h3 className="app-section-title__text">APP Items</h3>
              <span className="app-section-title__count">{planItems.length}</span>
            </div>
            <p className="app-card__description">Items generated for this departmental plan</p>
          </div>

          <div className="app-table-wrapper">
            <table className="app-table app-table--compact">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Budget Code</th>
                  <th>Procurement Type</th>
                  <th className="app-table__cell--numeric">Estimated Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {planItems.map((item) => (
                  <tr key={item.PlanItemId} className="app-table__row">
                    <td className="app-table__cell app-table__cell--mono">{item.ItemCode || 'N/A'}</td>
                    <td className="app-table__cell">{item.Description}</td>
                    <td className="app-table__cell app-table__cell--mono">{item.BudgetCode}</td>
                    <td className="app-table__cell">{item.ProcurementType || 'Not stated'}</td>
                    <td className="app-table__cell app-table__cell--numeric">{money(item.EstimatedAmount)}</td>
                    <td className="app-table__cell">
                      <span className={`app-badge app-badge--${item.Status.toLowerCase()}`}>{item.Status}</span>
                    </td>
                  </tr>
                ))}
                {!loading && planItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="app-table__empty">
                      <div className="app-empty-state app-empty-state--small">
                        <span className="app-empty-state__icon">📭</span>
                        <p>This departmental plan has no generated items yet</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Actions Panel */}
        <ProcurementPlanActionsPanel
          selectedPlan={selectedPlan}
          loading={loading}
          actionError={actionError}
          approvalNote={approvalNote}
          thresholdSummary={thresholdSummary}
          canTakeApprovalDecision={canTakeApprovalDecision}
          isAwaitingAppApproval={isAwaitingAppApproval}
          isAwaitingCgisApproval={isAwaitingCgisApproval}
          isAtProcurementInitiation={isAtProcurementInitiation}
          onApprovalNoteChange={onApprovalNoteChange}
          onApprovalDecision={onApprovalDecision}
          onInitiateProcurement={onInitiateProcurement}
        />
      </>
    ) : (
      <section className="app-card app-card--placeholder">
        <div className="app-placeholder">
          <span className="app-placeholder__icon">👆</span>
          <h4 className="app-placeholder__title">Select a Departmental Plan</h4>
          <p className="app-placeholder__text">Open a departmental plan above to recommend it, approve it, and inspect its APP items</p>
        </div>
      </section>
    )}
  </div>
);
