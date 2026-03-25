import React from 'react';
import type { ProcurementPlanItemDetail } from '../../types/internal';

interface CgisQueueItem {
  InstanceId: string;
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  Department: string;
  Amount: number | null;
  ApprovalRoute: string | null;
  ApprovalAuthorityLabel: string | null;
  Status: string | null;
  VendorName: string | null;
  CreatedAt: string;
  DaysPending: number;
}

interface CgisQueueTableProps {
  queue: CgisQueueItem[];
  isLoading: boolean;
  onSelectCase: (item: CgisQueueItem) => void;
}

const formatAmount = (val: number | null) =>
  val !== null ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val) : 'N/A';

export const CgisQueueTable = ({ queue, isLoading, onSelectCase }: CgisQueueTableProps) => {
  if (queue.length === 0 && !isLoading) {
    return (
      <div className="app-empty-state">
        <div className="app-empty-state__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p>No pending cases in the CGIS approval queue.</p>
        <span className="app-muted">All items have been reviewed or no new items require your attention.</span>
      </div>
    );
  }

  return (
    <div className="app-table-wrapper">
      <table className="app-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Department</th>
            <th>Amount</th>
            <th>Route</th>
            <th>Status</th>
            <th>Pending</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={7} className="app-table__empty">
                <div className="app-loading-spinner">Loading CGIS queue...</div>
              </td>
            </tr>
          ) : (
            queue.map((item) => (
              <tr key={item.InstanceId} className="app-table__row">
                <td>
                  <div className="app-case-info">
                    <span className="app-case-info__id">{item.EntityId.slice(0, 8)}...</span>
                    <span className="app-case-info__title">{item.RecordTitle || 'Untitled'}</span>
                  </div>
                </td>
                <td>{item.Department}</td>
                <td className="app-table__cell--numeric">{formatAmount(item.Amount)}</td>
                <td>
                  <span className={`app-badge app-badge--${item.ApprovalRoute?.toLowerCase().replace(/\s+/g, '-') || 'direct'}`}>
                    {item.ApprovalRoute || 'Direct'}
                  </span>
                </td>
                <td>
                  <span className={`app-badge app-badge--${item.Status?.toLowerCase().replace(/\s+/g, '-') || 'pending'}`}>
                    {item.Status || 'Pending Review'}
                  </span>
                </td>
                <td>
                  <span className={`app-pending-days ${item.DaysPending > 5 ? 'app-pending-days--urgent' : ''}`}>
                    {item.DaysPending}d
                  </span>
                </td>
                <td>
                  <button className="app-btn app-btn--sm" onClick={() => onSelectCase(item)}>
                    Review
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

interface CgisCaseDetailProps {
  selectedCase: CgisQueueItem;
  planItems: ProcurementPlanItemDetail[];
  rationale: string;
  isProcessing: boolean;
  error: string | null;
  token: string | null;
  onBack: () => void;
  onRationaleChange: (value: string) => void;
  onActionInitiate: (action: 'approve' | 'reject' | 'return' | 'escalate') => void;
}

export const CgisCaseDetail = ({
  selectedCase,
  planItems,
  rationale,
  isProcessing,
  error,
  token,
  onBack,
  onRationaleChange,
  onActionInitiate
}: CgisCaseDetailProps) => {
  const isPlanCase = selectedCase.EntityType.toLowerCase() === 'procurement_plan';
  const formatAmount = (val: number | null) =>
    val !== null ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val) : 'N/A';

  return (
    <div className="app-detail-view">
      {/* Header */}
      <div className="app-entity-header">
        <button className="app-entity-header__back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Queue
        </button>
        <div className="app-entity-header__info">
          <h2 className="app-entity-header__title">{selectedCase.RecordTitle || 'Untitled Case'}</h2>
          <div className="app-entity-header__meta">
            <span className="app-entity-header__badge">{selectedCase.EntityType.replace(/_/g, ' ')}</span>
            <span className="app-entity-header__badge app-entity-header__badge--secondary">
              {selectedCase.EntityId}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="app-alert app-alert--error animate-shake">
          <span className="app-alert__icon">⚠</span>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="app-stats-grid app-stats-grid--3">
        <div className="app-stat-card">
          <span className="app-stat-card__label">Department</span>
          <strong className="app-stat-card__value">{selectedCase.Department}</strong>
        </div>
        <div className="app-stat-card">
          <span className="app-stat-card__label">Total Amount</span>
          <strong className="app-stat-card__value">{formatAmount(selectedCase.Amount)}</strong>
        </div>
        <div className={`app-stat-card ${selectedCase.DaysPending > 5 ? 'app-stat-card--danger' : 'app-stat-card--warning'}`}>
          <span className="app-stat-card__label">Days Pending</span>
          <strong className="app-stat-card__value">{selectedCase.DaysPending}</strong>
        </div>
      </div>

      {/* Case Context */}
      <div className="app-card">
        <div className="app-card__header">
          <h3 className="app-card__title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Why This Reached CGIS
          </h3>
        </div>
        <div className="app-card__body">
          <p className="app-status-banner app-status-banner--info">
            {isPlanCase
              ? `This departmental plan has been approved by Comptroller Procurement and forwarded to CGIS Approval before procurement process begins.`
              : `This procurement follows the ${selectedCase.ApprovalRoute || 'Low-Value Direct'} path, which mandates final executive review by the Accounting Officer (CGIS) as per PPA 2007 guidelines.`}
          </p>
        </div>
      </div>

      {/* Plan Items Table (for procurement plans) */}
      {isPlanCase && (
        <div className="app-card">
          <div className="app-card__header">
            <h3 className="app-card__title">Departmental Plan Items</h3>
            <p className="app-card__description">
              Review the APP items attached to this departmental plan before recording your decision.
            </p>
          </div>
          <div className="app-card__body">
            {planItems.length > 0 ? (
              <div className="app-table-wrapper">
                <table className="app-table app-table--compact">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Budget Code</th>
                      <th>Procurement Type</th>
                      <th>Estimated Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planItems.map((item) => (
                      <tr key={item.PlanItemId}>
                        <td className="app-table__cell--mono">{item.ItemCode || 'N/A'}</td>
                        <td>{item.Description}</td>
                        <td className="app-table__cell--mono">{item.BudgetCode}</td>
                        <td>{item.ProcurementType || 'Not stated'}</td>
                        <td className="app-table__cell--numeric">{formatAmount(item.EstimatedAmount)}</td>
                        <td>
                          <span className={`app-badge app-badge--${item.Status?.toLowerCase() || 'pending'}`}>
                            {item.Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="app-empty-state app-empty-state--small">
                <p>No APP items found for this departmental plan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Panel */}
      <div className="app-card app-card--highlight">
        <div className="app-card__header">
          <h3 className="app-card__title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Executive Decision
          </h3>
          <p className="app-card__description">Your decision will be recorded in the audit trail and determine the next workflow stage.</p>
        </div>
        <div className="app-card__body">
          <div className="app-form-group">
            <label className="app-form-label">
              Rationale / Decision Note <span className="app-required">*</span>
            </label>
            <textarea
              className="app-textarea"
              rows={4}
              placeholder="Enter the justification for your decision. This will be recorded in the audit trail and may be reviewed by auditors."
              value={rationale}
              onChange={(e) => onRationaleChange(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="app-action-group app-action-group--grid">
            <button
              className="app-btn app-btn--success"
              onClick={() => onActionInitiate('approve')}
              disabled={isProcessing || !rationale.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
              {isPlanCase ? 'Approve Plan' : 'Approve Award'}
            </button>
            <button
              className="app-btn app-btn--danger"
              onClick={() => onActionInitiate('reject')}
              disabled={isProcessing || !rationale.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
              {isPlanCase ? 'Reject Plan' : 'Reject Award'}
            </button>
            <button
              className="app-btn app-btn--secondary"
              onClick={() => onActionInitiate('return')}
              disabled={isProcessing || !rationale.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Return for Clarification
            </button>
            <button
              className="app-btn app-btn--secondary"
              onClick={() => onActionInitiate('escalate')}
              disabled={isProcessing || !rationale.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Escalate to Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
