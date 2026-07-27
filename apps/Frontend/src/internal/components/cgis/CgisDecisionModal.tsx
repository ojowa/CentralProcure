import React from 'react';

interface CgisDecisionModalProps {
  action: 'approve' | 'reject' | 'return' | 'escalate';
  recordTitle: string;
  rationale: string;
  error?: string | null;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const actionConfig: Record<string, { title: string; theme: 'success' | 'danger' | 'warning' | 'info'; nextStage: string; icon: string }> = {
  approve: {
    title: 'Approve',
    theme: 'success',
    nextStage: 'Award & Publication',
    icon: 'M5 13l4 4L19 7'
  },
  reject: {
    title: 'Reject',
    theme: 'danger',
    nextStage: 'Evaluation (Re-evaluation required)',
    icon: 'M6 18L18 6M6 6l12 12'
  },
  return: {
    title: 'Return for Clarification',
    theme: 'warning',
    nextStage: 'Evaluation (Clarification needed)',
    icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6'
  },
  escalate: {
    title: 'Escalate to Board',
    theme: 'info',
    nextStage: 'Tenders Board Review',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
  }
};

export const CgisDecisionModal = ({
  action,
  recordTitle,
  rationale,
  error = null,
  isProcessing,
  onConfirm,
  onCancel
}: CgisDecisionModalProps) => {
  const config = actionConfig[action];

  return (
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal__backdrop" onClick={onCancel} />
      <div className="app-modal__content app-modal__content--sm">
        <div className="app-modal__header">
          <h3 className="app-modal__title">Confirm Executive Decision</h3>
          <button type="button" className="app-modal__close" onClick={onCancel} disabled={isProcessing}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="app-modal__body">
          <div className={`app-confirmation-banner app-confirmation-banner--${config.theme}`}>
            <div className="app-confirmation-banner__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={config.icon} />
              </svg>
            </div>
            <div className="app-confirmation-banner__content">
              <h4>You are about to {config.title}</h4>
              <p>{recordTitle}</p>
            </div>
          </div>

          <div className="app-info-rows">
            <div className="app-info-row">
              <span className="app-info-row__label">Next Workflow Stage</span>
              <span className="app-info-row__value">{config.nextStage}</span>
            </div>
            <div className="app-info-row">
              <span className="app-info-row__label">Your Rationale</span>
              <blockquote className="app-blockquote">{rationale}</blockquote>
            </div>
          </div>

          {error ? (
            <div className="app-alert app-alert--error" style={{ marginTop: '16px' }}>
              <span className="app-alert__icon">⚠</span>
              {error}
            </div>
          ) : null}
        </div>

        <div className="app-modal__footer">
          <button type="button" className="app-btn app-btn--secondary" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </button>
          <button
            type="button"
            className={`app-btn app-btn--${config.theme}`}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="app-spinner app-spinner--sm" />
                Processing...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={config.icon} />
                </svg>
                Confirm {config.title}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
