'use client';

import type { ReactNode } from 'react';
import { requisitionSteps, type BudgetLineItem } from '../../data/internalData';
import type { RequisitionDetail, WorkflowActionSnapshotResponse, WorkflowRuntimeHistoryEntry, WorkflowRuntimeSnapshot } from '../../types/internal';
import { formatCurrency, formatDate, formatDateTimeShort, requisitionStatusTone, toTitle } from '../../utils/procureUtils';
import { getHumanStatus } from '../../utils/workflow';
import { WorkflowProgressStepper } from '../WorkflowProgressStepper';
import type { WorkflowRuntimeWithDisplay } from '../workflowDisplayTypes';
import { buildDepartmentHeadChecklist, resolveDepartmentHeadAction, type WorkspaceMode } from './helpers';
import { DepartmentHeadQueueCard, RequisitionQuickLinks } from './quickLinks';
import { RequisitionRoutingTimeline } from '../RequisitionRoutingTimeline';

export { DepartmentHeadQueueCard, RequisitionQuickLinks } from './quickLinks';

type RequisitionRouteDecision = {
  ApprovalRoute?: string | null;
  ApprovalAuthorityCode?: string | null;
  ApprovalAuthorityLabel?: string | null;
  RequiresCgisApproval?: boolean;
  RequiresBoard?: boolean;
  RequiresBpp?: boolean;
  GovernanceBodyName?: string | null;
  Notes?: string | null;
};

type RequisitionDetailWithRouteDecision = RequisitionDetail & { RouteDecision?: RequisitionRouteDecision | null };

interface DepartmentHeadPanelProps {
  detail: RequisitionDetail;
  catalog: BudgetLineItem[];
  workflowSnapshot: WorkflowActionSnapshotResponse | null;
  workflowRuntime: WorkflowRuntimeSnapshot | null;
  workflowHistory: WorkflowRuntimeHistoryEntry[];
  isWorkflowLoading: boolean;
  workflowError: string;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  reviewError: string;
  reviewFeedback: string;
  isSaving: boolean;
  isSelectedEditable: boolean;
  onApplyAction: () => void;
  onOpenSelectedForEdit: () => void;
}

export const DepartmentHeadPanel = ({
  detail,
  catalog,
  workflowSnapshot,
  workflowRuntime,
  workflowHistory,
  isWorkflowLoading,
  workflowError,
  reviewNote,
  onReviewNoteChange,
  reviewError,
  reviewFeedback,
  isSaving,
  isSelectedEditable,
  onApplyAction,
  onOpenSelectedForEdit
}: DepartmentHeadPanelProps) => {
  const actionConfig = resolveDepartmentHeadAction(detail);
  const checklist = buildDepartmentHeadChecklist(detail, catalog);
  const completedChecks = checklist.filter((item) => item.complete).length;
  const readinessPercent = Math.round((completedChecks / Math.max(checklist.length, 1)) * 100);
  const runtimeStage = workflowRuntime?.CurrentStageTitle || workflowSnapshot?.CurrentStageTitle || detail.CurrentStage || detail.Status;
  const routeDecision = workflowSnapshot?.RouteDecision;
  const grantedActions = workflowSnapshot?.Actions ?? [];
  const runtimeWithDisplay = workflowRuntime as WorkflowRuntimeWithDisplay | null;

  return (
    <>
      <div className="requisition-detail-note">
        <h4>Department Head Review</h4>
        <p>Validate departmental completeness, confirm accountability, and record the handoff note before procurement takes over.</p>

        <div className="requisition-summary">
          <div>
            <span>Readiness score</span>
            <strong>{readinessPercent}%</strong>
          </div>
          <div>
            <span>Current stage</span>
            <strong>{runtimeStage}</strong>
          </div>
          <div>
            <span>Approval route</span>
            <strong>{routeDecision?.ApprovalAuthorityLabel || routeDecision?.ApprovalRoute || 'Route not resolved'}</strong>
          </div>
        </div>

        <div className="requisition-checklist">
          {checklist.map((item) => (
            <div key={item.label} className="requisition-check">
              <input type="checkbox" checked={item.complete} readOnly />
              <span>
                <strong>{item.label}</strong>
                <br />
                {item.detail}
              </span>
            </div>
          ))}
        </div>

        <div className="budget-check__meta" style={{ marginTop: '12px' }}>
          <span>Authority code: {routeDecision?.ApprovalAuthorityCode || 'Not resolved'}</span>
          <span>Governance body: {routeDecision?.GovernanceBodyName || 'Direct executive route'}</span>
          <span>CGIS required: {routeDecision?.RequiresCgisApproval ? 'Yes' : 'No'}</span>
          <span>Board route: {routeDecision?.RequiresBoard ? 'Yes' : 'No'}</span>
          <span>BPP required: {routeDecision?.RequiresBpp ? 'Yes' : 'No'}</span>
          <span>Granted actions: {grantedActions.length ? grantedActions.map((action) => action.ActionKey).join(', ') : 'None at this stage'}</span>
        </div>

        {isWorkflowLoading ? <div className="plan-loading" style={{ marginTop: '12px' }}>Refreshing workflow context...</div> : null}
        {workflowError ? <div className="req-error req-error--block">{workflowError}</div> : null}

        {actionConfig ? (
          <>
            <label className="plan-field plan-field--span" style={{ marginTop: '16px' }}>
              <span>Department Head Note</span>
              <textarea
                className="plan-textarea"
                rows={4}
                value={reviewNote}
                onChange={(event) => onReviewNoteChange(event.target.value)}
                placeholder="Record scope concerns, timing confirmation, or departmental endorsement notes."
              />
            </label>
            <p className="plan-muted">{actionConfig.helper}</p>
            {reviewError ? <div className="req-error req-error--block">{reviewError}</div> : null}
            {reviewFeedback ? <div className="requisition-success">{reviewFeedback}</div> : null}
            <div className="requisition-actions">
              <button type="button" className="plan-button" disabled={isSaving} onClick={onApplyAction}>
                {isSaving ? 'Saving...' : actionConfig.label}
              </button>
              {isSelectedEditable ? (
                <button type="button" className="plan-button plan-button--secondary" onClick={onOpenSelectedForEdit}>
                  Open for Edit
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="plan-muted" style={{ marginTop: '12px' }}>
            Department head actions are complete for the current status. Use tracking below to follow downstream movement.
          </p>
        )}
      </div>

      <div className="requisition-detail-note">
        <h4>Workflow Timeline</h4>
        <p>{runtimeWithDisplay?.Display?.CurrentPhaseLabel ? `Current phase: ${runtimeWithDisplay.Display.CurrentPhaseLabel}` : workflowRuntime?.CurrentPhaseKey ? `Current phase: ${toTitle(workflowRuntime.CurrentPhaseKey)}` : 'Live workflow timeline for this requisition.'}</p>

        {workflowRuntime?.NextTransitions?.length ? (
          <div className="routing-steps" style={{ marginTop: '12px' }}>
            {workflowRuntime.NextTransitions.map((transition, index) => (
              <div key={`${transition.ToStageKey}-${index}`} className="routing-step">
                <span className="routing-step__index">{index + 1}</span>
                <div>
                  <strong>{transition.StageTitle}</strong>
                  <span className="routing-step__meta">{transition.TransitionCondition}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="plan-muted">No next transitions are currently exposed for this requisition.</p>
        )}

        <table className="plan-table" style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {workflowHistory.slice(0, 6).map((entry) => (
              <tr key={entry.HistoryId}>
                <td>{formatDateTimeShort(entry.CreatedAt)}</td>
                <td>{entry.ToStageTitle}</td>
                <td>{entry.StageStatus || 'Recorded'}</td>
                <td>{entry.TransitionReason || entry.TransitionSource}</td>
              </tr>
            ))}
            {!workflowHistory.length ? (
              <tr>
                <td colSpan={4} className="plan-empty">
                  No workflow history entries were returned for this requisition.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
};

interface RequisitionDetailContentProps {
  detail: RequisitionDetail;
  activeStepIndex: number;
  isSelectedEditable: boolean;
  isDepartmentHead: boolean;
  isAdmin: boolean;
  canEditDrafts: boolean;
  canOpenSelectedForEdit?: boolean;
  isSaving: boolean;
  workflowRuntime: WorkflowRuntimeSnapshot | null;
  workflowHistory?: WorkflowRuntimeHistoryEntry[];
  isWorkflowLoading?: boolean;
  onOpenSelectedForEdit: () => void;
  onSubmitSelectedDraft: () => void;
  onDeleteRequisition: () => void;
  departmentHeadPanel?: ReactNode;
}

export const RequisitionDetailContent = ({
  detail,
  activeStepIndex,
  isSelectedEditable,
  isDepartmentHead,
  isAdmin,
  canEditDrafts,
  canOpenSelectedForEdit = true,
  isSaving,
  workflowRuntime,
  workflowHistory = [],
  isWorkflowLoading = false,
  onOpenSelectedForEdit,
  onSubmitSelectedDraft,
  onDeleteRequisition,
  departmentHeadPanel
}: RequisitionDetailContentProps) => {
  const routeDecision = (detail as RequisitionDetailWithRouteDecision).RouteDecision;
  const runtimeWithDisplay = workflowRuntime as WorkflowRuntimeWithDisplay | null;
  const routingSummary = routeDecision?.ApprovalAuthorityLabel || routeDecision?.ApprovalRoute || 'Route not resolved';
  const routingNotes = routeDecision?.Notes || 'Live approval route and threshold decision from backend workflow policy.';

  return (
    <>
      <div className="requisition-card__header">
        <div>
          <h3>{detail.Title}</h3>
          <p>{detail.Department} · {detail.RequisitionId}</p>
        </div>
        <div className="requisition-badges">
          <span className={`req-badge ${requisitionStatusTone(detail.Status)}`.trim()}>{detail.Status}</span>
          <span className="req-badge req-badge--soft">{formatCurrency(detail.TotalEstimate)}</span>
        </div>
      </div>

      {workflowRuntime?.CurrentStageKey ? (
        <div style={{ marginBottom: '20px' }}>
          <WorkflowProgressStepper currentStageKey={workflowRuntime.CurrentStageKey} display={runtimeWithDisplay?.Display} />
        </div>
      ) : null}

      <div className="requisition-detail-grid">
        <div><span>Department</span><strong>{detail.Department}</strong></div>
        <div><span>Priority</span><strong>{detail.Priority || 'Not set'}</strong></div>
        <div><span>Funding Source</span><strong>{detail.FundingSource || 'Not set'}</strong></div>
        <div><span>Procurement Type</span><strong>{detail.ProcurementType || 'Not set'}</strong></div>
        <div><span>Required By</span><strong>{formatDate(detail.RequiredBy)}</strong></div>
        <div><span>Current Stage</span><strong>{getHumanStatus(detail.CurrentStage, detail.Status)}</strong></div>
        <div><span>Final Committee Decision</span><strong>{detail.FinalCommitteeDecision || 'Pending'}</strong></div>
        <div><span>Budget Code</span><strong>{detail.BudgetCode || 'Not linked'}</strong></div>
        <div><span>APP Item</span><strong>{detail.AppItemId || 'Not linked'}</strong></div>
        <div><span>Project Code</span><strong>{detail.ProjectCode || 'Not set'}</strong></div>
      </div>

      <div className="routing-panel" style={{ marginTop: '16px' }}>
        <div className="routing-panel__header">
          <div>
            <h4>Routing Outlook</h4>
            <p>{routingNotes}</p>
          </div>
          <div className="routing-panel__badges">
            <span className="requisition-tag">{routingSummary}</span>
            <span className="requisition-tag requisition-tag--accent">{routeDecision?.ApprovalAuthorityCode || 'Pending'}</span>
          </div>
        </div>
        <div className="routing-panel__grid">
          <div><span>Governance Body</span><strong>{routeDecision?.GovernanceBodyName || 'Direct executive route'}</strong></div>
          <div><span>BPP Requirement</span><strong>{routeDecision?.RequiresBpp ? 'Required' : 'Not required'}</strong></div>
          <div><span>CGIS Review</span><strong>{routeDecision?.RequiresCgisApproval ? 'Required' : 'Not required'}</strong></div>
          <div><span>Board Review</span><strong>{routeDecision?.RequiresBoard ? 'Required' : 'Not required'}</strong></div>
        </div>
      </div>

      <div className="requisition-detail-items">
        <h4>Line Items</h4>
        <table className="plan-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Unit Cost</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {detail.LineItems.map((item, index) => (
              <tr key={`${item.ItemId ?? 'line'}-${index}`}>
                <td>{item.Description}</td>
                <td>{item.Unit}</td>
                <td>{item.Quantity}</td>
                <td>{formatCurrency(item.UnitCost)}</td>
                <td>{formatCurrency(Number(item.Quantity) * Number(item.UnitCost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="requisition-detail-note">
        <h4>Justification</h4>
        <p>{detail.Justification || 'No justification recorded.'}</p>
      </div>

      <div className="requisition-detail-note">
        <h4>Delivery and Risk Notes</h4>
        <p>{detail.DeliveryLocation || 'No delivery location provided.'}</p>
        <p>{detail.RiskNotes || 'No risk note recorded.'}</p>
      </div>

      {departmentHeadPanel}

      <div className="requisition-detail-note">
        <h4>Workflow Steps</h4>
        <div className="requisition-steps">
          {requisitionSteps.map((step, index) => {
            const stepClassName =
              index < activeStepIndex
                ? 'requisition-step requisition-step--done'
                : index === activeStepIndex
                  ? 'requisition-step requisition-step--active'
                  : 'requisition-step';

            return (
              <div key={step.key} className={stepClassName}>
                <div>
                  <strong>{step.title}</strong>
                  <span className="requisition-step__detail">{step.detail}</span>
                </div>
                <span className="requisition-step__status">{index === activeStepIndex ? detail.Status : step.status}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Routing Timeline */}
      <div className="requisition-detail-note">
        <RequisitionRoutingTimeline
          history={workflowHistory}
          currentStage={workflowRuntime?.CurrentStageTitle || detail.CurrentStage}
          isLoading={isWorkflowLoading}
        />
      </div>

      <div className="requisition-actions">
        {isAdmin && (
          <button
            type="button"
            className="plan-button plan-button--secondary text-red-600 border-red-200 hover:bg-red-50"
            disabled={isSaving}
            onClick={onDeleteRequisition}
          >
            Delete Requisition
          </button>
        )}
        {isSelectedEditable && !isDepartmentHead && canOpenSelectedForEdit && (
          <>
            <button type="button" className="plan-button" onClick={onOpenSelectedForEdit}>
              Edit Draft
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              disabled={isSaving || !canEditDrafts}
              onClick={onSubmitSelectedDraft}
            >
              {isSaving ? 'Submitting...' : 'Submit Requisition'}
            </button>
          </>
        )}
      </div>
    </>
  );
};
