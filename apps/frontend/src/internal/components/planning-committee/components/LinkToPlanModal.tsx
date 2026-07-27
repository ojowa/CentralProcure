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
  error: string | null;
  notice: string | null;
}

export const LinkToPlanModal: React.FC<LinkToPlanModalProps> = ({
  requisition,
  isOpen,
  onClose,
  onLink,
  onLoadPlans,
  error,
  notice
}) => {
  const [mode, setMode] = useState<'create' | 'attach'>('create');
  const [title, setTitle] = useState(`${requisition.Department} Procurement Plan`);
  const [fiscalYear, setFiscalYear] = useState(new Date(requisition.RequiredBy ?? requisition.CreatedAt).getFullYear());
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'attach') {
      onLoadPlans().then(setPlans);
    }
  }, [isOpen, mode, onLoadPlans]);

  useEffect(() => {
    setTitle(`${requisition.Department} Procurement Plan`);
    setFiscalYear(new Date(requisition.RequiredBy ?? requisition.CreatedAt).getFullYear());
    setSelectedPlanId('');
    setLocalError(null);
  }, [requisition]);

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
    }
  }, [isOpen, mode]);

  const validate = () => {
    if (mode === 'create') {
      const normalizedTitle = title.trim();

      if (!normalizedTitle) {
        return 'Plan title is required.';
      }

      if (normalizedTitle.length < 5 || normalizedTitle.length > 255) {
        return 'Plan title must be between 5 and 255 characters.';
      }

      if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
        return 'Enter a valid fiscal year.';
      }
    }

    if (mode === 'attach' && !selectedPlanId) {
      return 'Select a committee plan to continue.';
    }

    return null;
  };

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    setLoading(true);
    const success = await onLink(mode, {
      title: title.trim(),
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

        {(localError || error) && (
          <div className="portal-alert" style={{ marginBottom: '16px' }}>
            {localError || error}
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
                {plans.map((p) => (
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
