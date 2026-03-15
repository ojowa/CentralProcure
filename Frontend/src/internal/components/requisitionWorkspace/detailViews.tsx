'use client';

import type { ReactNode } from 'react';
import { requisitionSteps, thresholdBands, type BudgetLineItem } from '../../data/internalData';
import type {
  RequisitionDetail,
  RequisitionSummary,
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../../types/internal';
import {
  formatCurrency,
  formatDate,
  formatDateTimeShort,
  requisitionStatusTone,
  resolveThresholdRouting,
  toTitle
} from '../../utils/procureUtils';
import { buildDepartmentHeadChecklist, resolveDepartmentHeadAction, type WorkspaceMode } from './helpers';

interface QuickLinksProps {
  mode: WorkspaceMode;
  onModuleChange?: (moduleId: string) => void;
}

export const RequisitionQuickLinks = ({ mode, onModuleChange }: QuickLinksProps) => (
  <div className="requisition-actions">
    <button
      type="button"
      className={`plan-button ${mode === 'create' ? '' : 'plan-button--secondary'}`}
      onClick={() => onModuleChange?.('create-requisition')}
    >
      Create Requisition
    </button>
    <button
      type="button"
      className={`plan-button ${mode === 'history' ? '' : 'plan-button--secondary'}`}
      onClick={() => onModuleChange?.('requisition-history')}
    >
      Requisition History
    </button>
    <button
      type="button"
      className={`plan-button ${mode === 'tracking' ? '' : 'plan-button--secondary'}`}
      onClick={() => onModuleChange?.('requisition-tracking')}
    >
      Requisition Tracking
    </button>
  </div>
);

interface DepartmentHeadQueueCardProps {
  queue: RequisitionSummary[];
  selectedId: string | null;
  onOpenDetail: (requisitionId: string, modal?: boolean) => void;
}

export const DepartmentHeadQueueCard = ({
  queue,
  selectedId,
  onOpenDetail
}: DepartmentHeadQueueCardProps) => {
  const submittedCount = queue.filter((record) => record.Status === 'Submitted').length;
  const draftCount = queue.filter((record) => record.Status === 'Draft' || record.Status === 'Rejected').length;
  const underReviewCount = queue.filter((record) => record.Status === 'Under Review').length;

  return (
    <article className="requisition-card">
      <div className="requisition-card__header">
        <div>
          <h3>Department Review Queue</h3>
          <p>Open departmental requests that still need head validation, endorsement, or follow-up.</p>
        </div>
        <span className="requisition-tag requisition-tag--accent">{queue.length} in queue</span>
      </div>

      <div className="requisition-summary">
        <div>
          <span>Needs submission</span>
          <strong>{draftCount}</strong>
        </div>
        <div>
          <span>Awaiting confirmation</span>
          <strong>{submittedCount}</strong>
        </div>
        <div>
          <span>Already under review</span>
          <strong>{underReviewCount}</strong>
        </div>
      </div>

      <div className="requisition-tracking-cards">
        {queue.slice(0, 5).map((record) => (
          <button
            type="button"
            key={`department-head-${record.RequisitionId}`}
            className={`requisition-track-card ${record.RequisitionId === selectedId ? 'requisition-track-card--active' : ''}`.trim()}
            onClick={() => onOpenDetail(record.RequisitionId, true)}
          >
            <div>
              <h4>{record.Title}</h4>
              <p>{record.Department} · {formatDate(record.RequiredBy)}</p>
            </div>
            <div className="requisition-badges">
              <span className={`req-badge ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span>
              <span className="req-badge req-badge--soft">{formatCurrency(record.TotalEstimate)}</span>
            </div>
          </button>
        ))}
        {!queue.length ? <div className="plan-empty">No requisitions currently need department head intervention.</div> : null}
      </div>
    </article>
  );
};

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
        <p>{workflowRuntime?.CurrentPhaseKey ? `Current phase: ${toTitle(workflowRuntime.CurrentPhaseKey)}` : 'Live workflow timeline for this requisition.'}</p>

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
  canEditDrafts: boolean;
  isSaving: boolean;
  onOpenSelectedForEdit: () => void;
  onSubmitSelectedDraft: () => void;
  departmentHeadPanel?: ReactNode;
}

export const RequisitionDetailContent = ({
  detail,
  activeStepIndex,
  isSelectedEditable,
  isDepartmentHead,
  canEditDrafts,
  isSaving,
  onOpenSelectedForEdit,
  onSubmitSelectedDraft,
  departmentHeadPanel
}: RequisitionDetailContentProps) => {
  const band = resolveThresholdRouting(detail.TotalEstimate, thresholdBands);

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

      <div className="requisition-detail-grid">
        <div><span>Department</span><strong>{detail.Department}</strong></div>
        <div><span>Priority</span><strong>{detail.Priority || 'Not set'}</strong></div>
        <div><span>Funding Source</span><strong>{detail.FundingSource || 'Not set'}</strong></div>
        <div><span>Procurement Type</span><strong>{detail.ProcurementType || 'Not set'}</strong></div>
        <div><span>Required By</span><strong>{formatDate(detail.RequiredBy)}</strong></div>
        <div><span>Current Stage</span><strong>{detail.CurrentStage || detail.Status}</strong></div>
        <div><span>Budget Code</span><strong>{detail.BudgetCode || 'Not linked'}</strong></div>
        <div><span>APP Item</span><strong>{detail.AppItemId || 'Not linked'}</strong></div>
        <div><span>Project Code</span><strong>{detail.ProjectCode || 'Not set'}</strong></div>
      </div>

      <div className="routing-panel" style={{ marginTop: '16px' }}>
        <div className="routing-panel__header">
          <div>
            <h4>Routing Outlook</h4>
            <p>{band.escalation}</p>
          </div>
          <div className="routing-panel__badges">
            <span className="requisition-tag">{band.label}</span>
            <span className="requisition-tag requisition-tag--accent">{band.approvalLevel}</span>
          </div>
        </div>
        <div className="routing-panel__grid">
          <div><span>Timeline</span><strong>{band.timeline}</strong></div>
          <div><span>BPP Requirement</span><strong>{band.requiresBpp ? 'Required' : 'Not required'}</strong></div>
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

      {isSelectedEditable && !isDepartmentHead ? (
        <div className="requisition-actions">
          <button type="button" className="plan-button" onClick={onOpenSelectedForEdit}>
            Edit Draft
          </button>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            disabled={isSaving || !canEditDrafts}
            onClick={onSubmitSelectedDraft}
          >
            {isSaving ? 'Submitting...' : 'Submit Draft'}
          </button>
        </div>
      ) : null}
    </>
  );
};
