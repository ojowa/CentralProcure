'use client';

import React from 'react';
import type { BudgetConfirmationDetail } from '../../types/internal';
import { formatCurrency, formatDate, formatDateTimeShort, toTitle } from '../../utils/procureUtils';
import { WorkflowProgressStepper } from '../WorkflowProgressStepper';

type Props = {
  detail: BudgetConfirmationDetail | null;
  isLoading: boolean;
};

const getStatusTone = (value?: string | null): string => {
  switch ((value || '').toLowerCase()) {
    case 'budget confirmed':
    case 'approved':
      return 'admin-status admin-status--good';
    case 'on hold':
    case 'returned':
      return 'admin-status admin-status--warn';
    case 'rejected':
      return 'admin-status admin-status--alert';
    default:
      return 'admin-status';
  }
};

export const BudgetDetailView = ({ detail, isLoading }: Props) => {
  if (isLoading) {
    return (
      <section className="budget-workspace__detail">
        <div className="plan-loading">Loading selected plan...</div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="budget-workspace__detail">
        <div className="plan-empty">Select a queued plan to inspect its budget routing details.</div>
      </section>
    );
  }

  return (
    <section className="budget-workspace__detail animate-fade-up">
      <div className="requisition-header">
        <div>
          <div className="admin-kicker">Requisition ID: {detail.PlanId.split('-')[0].toUpperCase()}</div>
          <h3>{detail.PlanTitle}</h3>
          <p>
            {detail.Department} · FY {detail.FiscalYear} · {detail.ItemCount} line items
          </p>
        </div>
        <div className="requisition-badges">
          <span className="req-badge">{detail.CurrentStageTitle}</span>
          <span className="req-badge req-badge--soft">{detail.PlanStatus}</span>
          <span className={getStatusTone(detail.WorkflowStatus ?? detail.PlanStatus)}>
            {detail.WorkflowStatus ?? detail.PlanStatus}
          </span>
        </div>
      </div>

      <article className="portal-module-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--portal-slate)', marginBottom: '1rem' }}>
          Procurement Lifecycle Progress
        </h4>
        <WorkflowProgressStepper currentStageKey={detail.CurrentStageKey} />
      </article>

      <div className="budget-workspace__detail-grid">
        <article className="portal-module-card metric-card--glass">
          <h3>Budget Position</h3>
          <div className="budget-workspace__metric-list">
            <div>
              <span>Requested</span>
              <strong>{formatCurrency(detail.RequestedAmount)}</strong>
            </div>
            <div>
              <span>Appropriated</span>
              <strong>{formatCurrency(detail.Appropriated)}</strong>
            </div>
            <div>
              <span>Released</span>
              <strong>{formatCurrency(detail.Released)}</strong>
            </div>
            <div>
              <span>Committed</span>
              <strong>{formatCurrency(detail.Committed)}</strong>
            </div>
            <div>
              <span>Available</span>
              <strong style={{ color: detail.Available < detail.RequestedAmount ? 'var(--portal-alert)' : 'var(--portal-forest)' }}>
                {formatCurrency(detail.Available)}
              </strong>
            </div>
            <div>
              <span>Variance</span>
              <strong style={{ color: detail.Variance < 0 ? 'var(--portal-alert)' : 'inherit' }}>
                {formatCurrency(detail.Variance)}
              </strong>
            </div>
          </div>
        </article>

        <article className="portal-module-card">
          <h3>APP Linkage</h3>
          <div className="budget-workspace__metric-list">
            <div>
              <span>Total Budget</span>
              <strong>{formatCurrency(detail.TotalBudget)}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{formatDate(detail.CreatedAt)}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{formatDateTimeShort(detail.UpdatedAt)}</strong>
            </div>
            <div>
              <span>Current Stage</span>
              <strong>{detail.CurrentStageTitle}</strong>
            </div>
          </div>
          <p className="plan-muted" style={{ marginTop: '12px', borderTop: '1px solid var(--portal-border)', paddingTop: '12px' }}>
            {detail.Notes || 'No planning note has been recorded yet.'}
          </p>
        </article>
      </div>

      <article className="portal-module-card">
        <h3>Budget Lines</h3>
        {detail.BudgetLines.length ? (
          <div className="plan-table-wrapper">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Budget Code</th>
                  <th>Items</th>
                  <th>Requested</th>
                  <th>Appropriated</th>
                  <th>Available</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {detail.BudgetLines.map((line) => (
                  <tr key={line.BudgetCode}>
                    <td><code className="plan-code">{line.BudgetCode}</code></td>
                    <td>{line.ItemCount}</td>
                    <td>{formatCurrency(line.RequestedAmount)}</td>
                    <td>{formatCurrency(line.Appropriated)}</td>
                    <td>{formatCurrency(line.Available)}</td>
                    <td style={{ color: line.Variance < 0 ? 'var(--portal-alert)' : 'inherit' }}>
                      {formatCurrency(line.Variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="plan-empty">No budget-coded APP lines were found for this plan.</div>
        )}
      </article>

      <article className="portal-module-card">
        <h3>Underlying Request Details</h3>
        {detail.PlanItems.length ? (
          <div className="plan-table-wrapper">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Budget Code</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.PlanItems.map((item) => (
                  <tr key={item.PlanItemId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.Description}</div>
                      <div className="plan-muted">{item.ItemCode || 'No item code'}</div>
                    </td>
                    <td><code className="plan-code">{item.BudgetCode}</code></td>
                    <td>{item.ProcurementType || 'Not set'}</td>
                    <td><span className="admin-status admin-status--soft">{item.Status}</span></td>
                    <td>{formatCurrency(item.EstimatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="plan-empty">This plan does not contain any APP items yet.</div>
        )}
      </article>

      <article className="portal-module-card">
        <h3>Routing History</h3>
        {detail.History.length ? (
          <div className="budget-workspace__history">
            {detail.History.map((entry) => (
              <div key={entry.HistoryId} className="budget-workspace__history-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong>{entry.ToStageTitle}</strong>
                  <span className="plan-muted">{formatDateTimeShort(entry.CreatedAt)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--portal-slate)', marginBottom: '8px' }}>
                  Actor: <strong>{entry.Actor || 'System'}</strong> · Status: {entry.StageStatus || toTitle(entry.ToStageKey)}
                </div>
                <p style={{ background: 'var(--portal-background)', padding: '10px', borderRadius: '8px', fontSize: '0.8125rem' }}>
                  {entry.TransitionReason || 'No transition note recorded.'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="plan-empty">No workflow history is available yet.</div>
        )}
      </article>
    </section>
  );
};
