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
        <select
          id="reviewRemarks"
          className="plan-input"
          required
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={disabled}
        >
          <option value="">-- Select a remark --</option>
          <option value="Requisition satisfies departmental procurement guidelines.">Requisition satisfies departmental procurement guidelines.</option>
          <option value="Budget alignment confirmed for this line item.">Budget alignment confirmed for this line item.</option>
          <option value="Technical specifications require further clarification.">Technical specifications require further clarification.</option>
          <option value="Proposed cost exceeds market threshold for this category.">Proposed cost exceeds market threshold for this category.</option>
          <option value="Item description is too vague for accurate sourcing.">Item description is too vague for accurate sourcing.</option>
          <option value="Recommended for inclusion in the annual plan.">Recommended for inclusion in the annual plan.</option>
        </select>
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
