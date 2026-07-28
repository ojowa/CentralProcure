import React, { useState } from 'react';
import styles from '../styles/planning-committee.module.css';

interface FinalDecisionFormProps {
  onSubmit: (decision: string, remarks: string, minuteUrl?: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export const FinalDecisionForm: React.FC<FinalDecisionFormProps> = ({
  onSubmit,
  error = null,
  disabled = false
}) => {
  const [decision, setDecision] = useState('Recommended');
  const [remarks, setRemarks] = useState('');
  const [minuteUrl, setMinuteUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(decision, remarks, minuteUrl);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // In a real implementation, this would call a file upload service
    // For now, we simulate a successful upload to a temporary path
    setTimeout(() => {
      setMinuteUrl(`https://storage.centralprocure.gov.ng/minutes/${Date.now()}_${file.name}`);
      setIsUploading(false);
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formSection}>
        <h4 className={styles.formSectionTitle}>Final Committee Decision</h4>
        <p className={styles.formHint}>Only the Procurement Secretary or Chairman can finalize this requisition.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="finalDecision">Overall Decision</label>
        <select
          id="finalDecision"
          className="plan-input"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          disabled={disabled}
        >
          <option value="Recommended">Recommended (Add to Plan)</option>
          <option value="ReturnedToDepartment">Returned to Department</option>
          <option value="Rejected">Rejected (Drop from Plan)</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="finalRemarks">Committee Remarks</label>
        <select
          id="finalRemarks"
          className="plan-input"
          required
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={disabled}
        >
          <option value="">-- Select committee rationale --</option>
          <option value="Requisition cleared by all technical units for APP inclusion.">Requisition cleared by all technical units for APP inclusion.</option>
          <option value="Budgetary provision confirmed; item approved for procurement.">Budgetary provision confirmed; item approved for procurement.</option>
          <option value="Requisition returned due to insufficient technical specifications.">Requisition returned due to insufficient technical specifications.</option>
          <option value="Item dropped due to duplication in other departmental plans.">Item dropped due to duplication in other departmental plans.</option>
          <option value="Strategic priority confirmed by committee resolution.">Strategic priority confirmed by committee resolution.</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="meetingMinutes">Upload Meeting Minutes</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="meetingMinutes"
            type="file"
            className="plan-input"
            accept=".pdf,.doc,.docx"
            onChange={handleFileUpload}
            disabled={disabled || isUploading}
          />
          {isUploading && <span className={styles.sidebarDescription}>Uploading...</span>}
        </div>
        {minuteUrl && (
          <p className={styles.sidebarDescription} style={{ color: 'var(--success-color)', marginTop: '4px' }}>
            ✓ Minutes attached
          </p>
        )}
      </div>

      {error ? (
        <div className="portal-alert" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        className="plan-button plan-button--success"
        style={{ width: '100%' }}
        disabled={disabled || isUploading || !remarks.trim() || !minuteUrl}
      >
        Finalize & Sync Plan
      </button>
    </form>
  );
};
