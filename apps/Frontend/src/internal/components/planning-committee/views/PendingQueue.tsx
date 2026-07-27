import React, { useMemo } from 'react';
import styles from '../styles/planning-committee.module.css';
import type { RequisitionSummary } from '../../../types/internal';

interface PendingQueueProps {
  requisitions: RequisitionSummary[];
  onLink: (req: RequisitionSummary) => void;
  formatCurrency: (value: number) => string;
  downloadCsv: () => void;
}

export const PendingQueue: React.FC<PendingQueueProps> = ({
  requisitions,
  onLink,
  formatCurrency,
  downloadCsv
}) => {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>Pending Link</h3>
          <p className="plan-muted">Requisitions that need to be assigned to a committee plan before review.</p>
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
                <td>
                  <button
                    className="plan-button plan-button--sm"
                    onClick={() => onLink(r)}
                  >
                    Select Committee Plan
                  </button>
                </td>
              </tr>
            ))}
            {requisitions.length === 0 && (
              <tr>
                <td colSpan={6} className="plan-empty">
                  No requisitions awaiting committee plan assignment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
