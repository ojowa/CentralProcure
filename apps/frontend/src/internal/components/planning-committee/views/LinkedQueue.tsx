import React, { useMemo } from 'react';
import styles from '../styles/planning-committee.module.css';
import type { RequisitionSummary } from '../../../types/internal';

interface LinkedQueueProps {
  requisitions: RequisitionSummary[];
  onWorkspace: (req: RequisitionSummary) => void;
  onView: (req: RequisitionSummary) => void;
  formatCurrency: (value: number) => string;
  downloadCsv: () => void;
}

export const LinkedQueue: React.FC<LinkedQueueProps> = ({
  requisitions,
  onWorkspace,
  onView,
  formatCurrency,
  downloadCsv
}) => {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>Linked Requisitions</h3>
          <p className="plan-muted">Requisitions already assigned to a committee plan or already finalized into APP items.</p>
        </div>
        <button
          className="plan-button plan-button--secondary"
          onClick={downloadCsv}
          disabled={requisitions.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="portal-table-container">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Required By</th>
              <th>Title</th>
              <th>Department</th>
              <th>Status</th>
              <th>Total Estimate</th>
              <th>Plan / APP</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.map((r) => (
              <tr key={r.RequisitionId}>
                <td>
                  {r.RequiredBy
                    ? new Date(r.RequiredBy).toLocaleDateString()
                    : '—'}
                </td>
                <td>{r.Title}</td>
                <td>{r.Department}</td>
                <td>
                  <span className={`plan-badge plan-badge--${r.Status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {r.Status}
                  </span>
                </td>
                <td>{formatCurrency(r.TotalEstimate)}</td>
                <td>{r.AppItemDescription ?? r.CommitteePlanTitle ?? r.AppItemId ?? r.CommitteePlanId ?? '—'}</td>
                <td>
                  <div className={styles.tableActions}>
                    <button
                      className="plan-button plan-button--sm plan-button--primary"
                      onClick={() => onWorkspace(r)}
                    >
                      Workspace
                    </button>
                    <button
                      className="plan-button plan-button--sm plan-button--secondary"
                      onClick={() => onView(r)}
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {requisitions.length === 0 && (
              <tr>
                <td colSpan={7} className="plan-empty">
                  No linked requisitions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
