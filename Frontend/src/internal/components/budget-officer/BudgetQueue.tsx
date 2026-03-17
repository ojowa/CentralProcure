'use client';

import React from 'react';
import type { BudgetConfirmationQueueItem } from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  queue: BudgetConfirmationQueueItem[];
  selectedPlanId: string | null;
  onSelectPlan: (planId: string) => void;
  isLoading: boolean;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
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

const getPagingMeta = (page: number, pageSize: number, total: number) => {
  if (!total) {
    return 'No records';
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} of ${total}`;
};

export const BudgetQueue = ({
  queue,
  selectedPlanId,
  onSelectPlan,
  isLoading,
  page,
  total,
  onPageChange
}: Props) => {
  const pageSize = 12;

  return (
    <>
      <div className="budget-workspace__queue-header">
        <div>
          <h3>Tracked Requisitions</h3>
          <p>Select a requisition to inspect its current routing state and underlying request details.</p>
        </div>
        <span className="plan-muted">{getPagingMeta(page, pageSize, total)}</span>
      </div>

      {isLoading ? <div className="plan-loading">Loading budget queue...</div> : null}

      {queue.length ? (
        <div className="budget-workspace__queue-table">
          <div className="plan-table-wrapper">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Stage</th>
                  <th>Requested</th>
                  <th>Available</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr
                    key={item.PlanId}
                    className={
                      item.PlanId === selectedPlanId
                        ? 'budget-workspace__row budget-workspace__row--active'
                        : 'budget-workspace__row'
                    }
                  >
                    <td>
                      <button type="button" className="plan-link" onClick={() => onSelectPlan(item.PlanId)}>
                        {item.PlanTitle}
                      </button>
                      <div className="plan-muted">
                        {item.Department} · FY {item.FiscalYear}
                      </div>
                    </td>
                    <td>
                      <div>{item.CurrentStageTitle}</div>
                      <span className={getStatusTone(item.WorkflowStatus ?? item.PlanStatus)}>
                        {item.WorkflowStatus ?? item.PlanStatus}
                      </span>
                    </td>
                    <td>{formatCurrency(item.RequestedAmount)}</td>
                    <td>{formatCurrency(item.Available)}</td>
                    <td>{formatCurrency(item.Variance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="plan-empty">No budget confirmation items matched the current filters.</div>
      )}

      <div className="plan-pagination">
        <span className="plan-pagination__meta">{getPagingMeta(page, pageSize, total)}</span>
        <div className="plan-pagination__controls">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1 || isLoading}
          >
            Previous
          </button>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={page * pageSize >= total || isLoading}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
};
