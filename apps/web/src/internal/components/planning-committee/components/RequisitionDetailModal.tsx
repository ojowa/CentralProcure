import React from 'react';
import styles from '../styles/planning-committee.module.css';
import type { RequisitionDetail } from '../../../types/internal';
import type { MemberReview } from '../hooks/planningCommitteeTypes';

interface RequisitionDetailModalProps {
  requisition: RequisitionDetail | null;
  memberReviews: MemberReview[];
  isOpen: boolean;
  onClose: () => void;
  formatCurrency: (value: number) => string;
}

const excludedCommitteeRoles = new Set(['requisitioning_officer', 'department_user']);
const normalizeRole = (value?: string | null) =>
  value ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';

export const RequisitionDetailModal: React.FC<RequisitionDetailModalProps> = ({
  requisition,
  memberReviews,
  isOpen,
  onClose,
  formatCurrency
}) => {
  if (!isOpen || !requisition) return null;

  const formatDecisionLabel = (value?: string | null) => {
    if (value === 'ReturnedToDepartment') return 'Returned to Department for Correction';
    if (value === 'Recommended') return 'Recommended for Approval';
    return value || 'Pending';
  };

  const filteredReviews = memberReviews.filter(
    (r) => !excludedCommitteeRoles.has(normalizeRole(r.ReviewerRole))
  );

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: '800px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h3>{requisition.Title}</h3>
            <p className="plan-muted">Requisition Details</p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="plan-form-grid">
          <div className={styles.field}>
            <span>Status</span>
            <strong>{requisition.Status}</strong>
          </div>
          <div className={styles.field}>
            <span>Final Committee Decision</span>
            <strong>{formatDecisionLabel(requisition.FinalCommitteeDecision)}</strong>
          </div>
          <div className={styles.field}>
            <span>Current Stage</span>
            <strong>{requisition.CurrentStage ?? '—'}</strong>
          </div>
          <div className={styles.field}>
            <span>Department</span>
            <strong>{requisition.Department}</strong>
          </div>
          <div className={styles.field}>
            <span>Priority</span>
            <strong>{requisition.Priority ?? '—'}</strong>
          </div>
          <div className={styles.field}>
            <span>Required By</span>
            <strong>
              {requisition.RequiredBy
                ? new Date(requisition.RequiredBy).toLocaleDateString()
                : '—'}
            </strong>
          </div>
          <div className={styles.field}>
            <span>Total Estimate</span>
            <strong>{formatCurrency(requisition.TotalEstimate)}</strong>
          </div>
          <div className={styles.field}>
            <span>Funding Source</span>
            <strong>{requisition.FundingSource ?? '—'}</strong>
          </div>
          <div className={styles.field}>
            <span>Budget Code</span>
            <strong>{requisition.BudgetCode ?? '—'}</strong>
          </div>
          <div className={styles.field}>
            <span>Procurement Type</span>
            <strong>{requisition.ProcurementType ?? '—'}</strong>
          </div>
          <div className={styles.field}>
            <span>Delivery Location</span>
            <strong>{requisition.DeliveryLocation ?? '—'}</strong>
          </div>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <span>Justification</span>
            <p className="plan-muted">{requisition.Justification ?? '—'}</p>
          </div>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <span>Risk Notes</span>
            <p className="plan-muted">{requisition.RiskNotes ?? '—'}</p>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <h4>Line Items</h4>
          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {requisition.LineItems?.map((item, idx) => (
                  <tr key={item.ItemId ?? idx}>
                    <td>{item.Description}</td>
                    <td>{item.Unit}</td>
                    <td>{item.Quantity}</td>
                    <td>{formatCurrency(item.UnitCost)}</td>
                  </tr>
                ))}
                {(!requisition.LineItems || requisition.LineItems.length === 0) && (
                  <tr>
                    <td colSpan={4} className="plan-empty">No line items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <h4>Committee Remarks</h4>
          {filteredReviews.length === 0 ? (
            <p className="plan-empty">No committee remarks yet.</p>
          ) : (
            <div className={styles.timeline}>
              {filteredReviews.map((r) => (
                <div key={r.ReviewId} className={styles.timelineItem}>
                  <div className={styles.timelineHeader}>
                    <span className={styles.timelineRole}>
                      {r.ReviewerRole.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className={`plan-badge plan-badge--${r.Decision.toLowerCase()}`}>
                      {r.Decision}
                    </span>
                  </div>
                  <p className={styles.timelineRemarks}>{r.Remarks ?? '—'}</p>
                  <div className={styles.timelineDate}>
                    {new Date(r.UpdatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button className="plan-button plan-button--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
