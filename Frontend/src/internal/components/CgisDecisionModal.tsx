import React from 'react';

interface CgisDecisionModalProps {
  action: 'approve' | 'reject' | 'return' | 'escalate';
  recordTitle: string;
  rationale: string;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const actionLabels: Record<string, { title: string; theme: string; nextStage: string }> = {
  approve: { title: 'Approve Award', theme: 'plan-button', nextStage: 'Award & Publication' },
  reject: { title: 'Reject Award', theme: 'plan-button-danger', nextStage: 'Evaluation (Re-evaluation required)' },
  return: { title: 'Return for Clarification', theme: 'plan-button-secondary', nextStage: 'Evaluation (Clarification needed)' },
  escalate: { title: 'Escalate to Board', theme: 'plan-button-secondary', nextStage: 'Tenders Board Review' }
};

export const CgisDecisionModal = ({ 
  action, 
  recordTitle, 
  rationale, 
  isProcessing, 
  onConfirm, 
  onCancel 
}: CgisDecisionModalProps) => {
  const config = actionLabels[action];

  return (
    <div className="plan-modal" role="dialog" aria-modal="true">
      <div className="plan-modal__backdrop" onClick={onCancel} />
      <div className="plan-modal__content" style={{ maxWidth: '500px' }}>
        <div className="requisition-card__header">
          <h3>Confirm Executive Decision</h3>
          <button type="button" className="plan-link" onClick={onCancel} disabled={isProcessing}>Close</button>
        </div>

        <div style={{ padding: '20px' }}>
          <p>You are about to <strong>{config.title}</strong> for:</p>
          <p className="portal-module-card" style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f3f4f6' }}>
            {recordTitle}
          </p>

          <div style={{ marginTop: '16px' }}>
            <span className="plan-muted" style={{ display: 'block', marginBottom: '4px' }}>Next Workflow Stage:</span>
            <span className="plan-badge">{config.nextStage}</span>
          </div>

          <div style={{ marginTop: '16px' }}>
            <span className="plan-muted" style={{ display: 'block', marginBottom: '4px' }}>Your Rationale:</span>
            <blockquote style={{ 
              borderLeft: '4px solid #e5e7eb', 
              paddingLeft: '12px', 
              fontStyle: 'italic',
              color: '#4b5563'
            }}>
              {rationale}
            </blockquote>
          </div>

          <div className="plan-actions" style={{ marginTop: '24px', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="plan-button-secondary" 
              onClick={onCancel} 
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className={config.theme} 
              onClick={onConfirm} 
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : `Confirm ${config.title}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
