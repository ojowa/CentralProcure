import React, { useState, useEffect } from 'react';
import styles from '../styles/planning-committee.module.css';
import type { RequisitionSummary } from '../../../types/internal';
import type { ProcurementPlanSummary } from '../../../types/internal';

interface LinkToPlanModalProps {
  requisition: RequisitionSummary;
  isOpen: boolean;
  onClose: () => void;
  onLink: (
    mode: 'create' | 'attach',
    config: {
      title?: string;
      fiscalYear?: number;
      existingPlanId?: string;
    }
  ) => Promise<boolean>;
  onLoadPlans: () => Promise<ProcurementPlanSummary[]>;
  notice: string | null;
}

export const LinkToPlanModal: React.FC<LinkToPlanModalProps> = ({
  requisition,
  isOpen,
  onClose,
  onLink,
  onLoadPlans,
  notice
}) => {
  const [mode, setMode] = useState<'create' | 'attach'>('create');
  const [title, setTitle] = useState(`${requisition.Department} Procurement Plan`);
  const [fiscalYear, setFiscalYear] = useState(new Date(requisition.RequiredBy ?? requisition.CreatedAt).getFullYear());
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && mode === 'attach') {
      onLoadPlans().then(setPlans);
    }
  }, [isOpen, mode, onLoadPlans]);

  useEffect(() => {
    setTitle(`${requisition.Department} Procurement Plan`);
  }, [requisition]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setLoading(true);
    const success = await onLink(mode, {
      title,
      fiscalYear,
      existingPlanId: selectedPlanId
    });
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div>
            <h3>Create or Attach Procurement Plan</h3>
            <p className="plan-muted">Assign this requisition to a committee plan for review.</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>&times;</button>
        </div>

        {notice && (
          <div className="portal-alert portal-alert--info" style={{ marginBottom: '16px' }}>
            {notice}
          </div>
        )}

        <div className="plan-form-grid">
          <div className={styles.field}>
            <label>Plan Mode</label>
            <select
              className="plan-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'create' | 'attach')}
            >
              <option value="create">Create New Plan</option>
              <option value="attach">Attach to Existing Plan</option>
            </select>
          </div>

          {mode === 'create' ? (
            <>
              <div className={styles.field}>
                <label>Plan Title</label>
                <input
                  className="plan-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter committee plan title"
                />
              </div>
              <div className={styles.field}>
                <label>Fiscal Year</label>
                <input
                  className="plan-input"
                  type="number"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(Number(e.target.value))}
                />
              </div>
            </>
          ) : (
            <div className={styles.field}>
              <label>Select Plan</label>
              <select
                className="plan-input"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                <option value="">Select committee plan</option>
                {plans
                  .filter((p) => p.Status === 'Under Review')
                  .map((p) => (
                    <option key={p.PlanId} value={p.PlanId}>
                      {p.PlanTitle} ({p.FiscalYear})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="plan-actions" style={{ marginTop: '24px' }}>
          <button
            className="plan-button"
            onClick={handleSubmit}
            disabled={loading || (mode === 'attach' && !selectedPlanId)}
          >
            {loading ? 'Linking...' : 'Link Requisition'}
          </button>
          <button
            className="plan-button plan-button--secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
