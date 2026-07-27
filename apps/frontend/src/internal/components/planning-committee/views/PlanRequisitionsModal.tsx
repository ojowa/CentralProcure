import React, { useEffect, useState } from 'react';
import styles from '../styles/planning-committee.module.css';
import type { RequisitionSummary } from '../../../types/internal';
import { fetchProcurementPlanRequisitions } from '../../../services/procurementPlanService';

interface PlanRequisitionsModalProps {
  token: string | null;
  planId: string | null;
  planTitle: string;
  isOpen: boolean;
  onClose: () => void;
  formatCurrency: (value: number) => string;
}

export const PlanRequisitionsModal: React.FC<PlanRequisitionsModalProps> = ({
  token,
  planId,
  planTitle,
  isOpen,
  onClose,
  formatCurrency
}) => {
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestPath, setRequestPath] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && planId && token) {
      void loadRequisitions();
    }
  }, [isOpen, planId, token]);

  const loadRequisitions = async () => {
    if (!planId || !token) return;
    setLoading(true);
    setError(null);
    try {
      setRequestPath(`/api/procurement-plans/${planId}/requisitions`);
      const results = await fetchProcurementPlanRequisitions(token, planId);
      setRequisitions(results);
    } catch (err: any) {
      setError(`${err.message || 'Failed to load requisitions'}${planId ? ` [planId=${planId}]` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3>Requisitions for {planTitle}</h3>
            <p className="plan-muted">All requisitions linked to this procurement plan</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {loading && (
          <div className={styles.empty}>
            <span style={{ fontSize: '1.5rem' }}>⏳</span>
            <p>Loading requisitions...</p>
          </div>
        )}

        {error && (
          <div className="portal-alert" style={{ marginBottom: '16px' }}>
            {error}
            {requestPath ? <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>Request: {requestPath}</div> : null}
          </div>
        )}

        {!loading && !error && requisitions.length === 0 && (
          <div className={styles.empty}>
            <span style={{ fontSize: '2rem' }}>📭</span>
            <p>No requisitions found for this plan.</p>
            <span className="plan-muted">
              Requisitions will appear once they are linked to this procurement plan.
            </span>
          </div>
        )}

        {!loading && !error && requisitions.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Requisition ID</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th className={styles.numericCell}>Total Estimate</th>
                  <th>Required By</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => (
                  <tr key={req.RequisitionId}>
                    <td className={styles.cellStrong}>{req.RequisitionId}</td>
                    <td>{req.Title}</td>
                    <td>{req.Department}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${
                        req.Status === 'Approved' ? styles.statusSuccess :
                        req.Status === 'Under Review' ? styles.statusWarning :
                        req.Status === 'Rejected' ? styles.statusDanger :
                        req.Status === 'Submitted' ? styles.statusPending :
                        styles.statusNeutral
                      }`}>
                        {req.Status}
                      </span>
                    </td>
                    <td className={styles.numericCell}>{formatCurrency(req.TotalEstimate)}</td>
                    <td>{req.RequiredBy ? new Date(req.RequiredBy).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.summaryCard} style={{ marginTop: '20px' }}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <small>Total Requisitions</small>
                  <p>{requisitions.length}</p>
                </div>
                <div className={styles.summaryItem}>
                  <small>Approved</small>
                  <p>{requisitions.filter(r => r.Status === 'Approved').length}</p>
                </div>
                <div className={styles.summaryItem}>
                  <small>Under Review</small>
                  <p>{requisitions.filter(r => r.Status === 'Under Review').length}</p>
                </div>
                <div className={styles.summaryItem}>
                  <small>Total Value</small>
                  <p>{formatCurrency(requisitions.reduce((sum, r) => sum + r.TotalEstimate, 0))}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanRequisitionsModal;
