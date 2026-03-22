import React, { useState } from 'react';
import styles from '../styles/planning-committee.module.css';

interface FinalDecisionFormProps {
  onSubmit: (decision: string, remarks: string) => void;
  disabled?: boolean;
}

export const FinalDecisionForm: React.FC<FinalDecisionFormProps> = ({
  onSubmit,
  disabled = false
}) => {
  const [decision, setDecision] = useState('Recommended');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(decision, remarks);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formSection}>
        <h4 className={styles.formSectionTitle}>Final Decision</h4>
        <p className={styles.formHint}>Only Chairman/Secretary can submit the final decision.</p>
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
          <option value="Recommended">Recommended for Approval</option>
          <option value="Returned">Return to Department</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="finalRemarks">Committee Remarks</label>
        <textarea
          id="finalRemarks"
          className="plan-input"
          rows={3}
          required
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Summary of committee findings..."
          disabled={disabled}
        />
      </div>

      <button
        type="submit"
        className="plan-button plan-button--success"
        style={{ width: '100%' }}
        disabled={disabled || !remarks.trim()}
      >
        Finalize Review
      </button>
    </form>
  );
};
