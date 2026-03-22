import React, { useState } from 'react';
import styles from '../styles/planning-committee.module.css';

interface MemberReviewFormProps {
  onSubmit: (decision: string, remarks: string) => void;
  disabled?: boolean;
}

export const MemberReviewForm: React.FC<MemberReviewFormProps> = ({
  onSubmit,
  disabled = false
}) => {
  const [decision, setDecision] = useState('Cleared');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(decision, remarks);
    setRemarks('');
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="reviewDecision">Your Decision</label>
        <select
          id="reviewDecision"
          className="plan-input"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          disabled={disabled}
        >
          <option value="Cleared">Cleared</option>
          <option value="Queried">Queried</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="reviewRemarks">Remarks</label>
        <textarea
          id="reviewRemarks"
          className="plan-input"
          rows={3}
          required
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Provide justification for your decision..."
          disabled={disabled}
        />
      </div>
      <button
        type="submit"
        className="plan-button"
        style={{ width: '100%' }}
        disabled={disabled || !remarks.trim()}
      >
        Submit Review
      </button>
    </form>
  );
};
