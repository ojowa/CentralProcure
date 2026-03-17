'use client';

import React, { useEffect } from 'react';
import type { BudgetConfirmationDetail, BudgetConfirmationQueueItem } from '../../types/internal';

const decisionConfig = {
  start_review: { label: 'Start Budget Review', className: 'plan-button plan-button--secondary' },
  confirm: { label: 'Confirm Funding', className: 'plan-button' },
  hold: { label: 'Place On Hold', className: 'plan-button plan-button--secondary' },
  return: { label: 'Return for Correction', className: 'plan-button plan-button--secondary' },
  reject: { label: 'Reject Budget Support', className: 'plan-button plan-button--danger' }
} as const;

type DecisionKey = keyof typeof decisionConfig;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedQueueItem: BudgetConfirmationQueueItem | null;
  detail: BudgetConfirmationDetail | null;
  availableDecisions: DecisionKey[];
  decisionNote: string;
  onNoteChange: (note: string) => void;
  onDecision: (decision: DecisionKey) => void;
  canTakeDecisions: boolean;
  isSaving: boolean;
  error?: string | null;
};

export const BudgetDecisionPanel = ({
  isOpen,
  onClose,
  selectedQueueItem,
  detail,
  availableDecisions,
  decisionNote,
  onNoteChange,
  onDecision,
  canTakeDecisions,
  isSaving,
  error
}: Props) => {
  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="budget-modal-overlay animate-fade" onClick={onClose}>
      <div 
        className="budget-modal-card animate-rise-in" 
        onClick={(e) => e.stopPropagation()} 
      >
        <header className="budget-modal-header">
          <div>
            <div className="admin-kicker">Budget Decision Terminal</div>
            <h3>Record Financial Status</h3>
            <p className="plan-muted">
              {selectedQueueItem?.PlanTitle || 'Reviewing Requisition'}
            </p>
          </div>
          <button type="button" className="budget-modal-close" onClick={onClose} disabled={isSaving}>
            &times;
          </button>
        </header>

        <div className="budget-modal-body">
          {error && (
            <div className="portal-alert animate-shake" style={{ marginBottom: '20px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <label className="plan-field">
            <span style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Decision Note & Rationale</span>
            <textarea
              className="plan-textarea"
              rows={6}
              value={decisionNote}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Record affordability rationale or corrective instructions..."
              disabled={!canTakeDecisions || !detail || isSaving}
              autoFocus
            />
          </label>

          <div className="budget-decision-grid">
            {availableDecisions.map((decision) => (
              <button
                key={decision}
                type="button"
                className={decisionConfig[decision].className}
                style={{ height: '48px', fontWeight: 600 }}
                onClick={() => onDecision(decision)}
                disabled={!canTakeDecisions || !detail || isSaving}
              >
                {isSaving ? 'Processing...' : decisionConfig[decision].label}
              </button>
            ))}
          </div>

          {!canTakeDecisions ? (
            <div className="plan-empty" style={{ marginTop: '16px', fontSize: '13px' }}>
              Your current role is not authorized to record budget decisions.
            </div>
          ) : null}
        </div>

        <footer className="budget-modal-footer">
          <button type="button" className="plan-button plan-button--secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
        </footer>
      </div>

      <style jsx>{`
        .budget-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(11, 18, 33, 0.85); /* Full dark grey/ink overlay */
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          padding: 24px;
          z-index: 9999;
        }

        .budget-modal-card {
          background: #fff;
          width: min(600px, 100%);
          border-radius: 28px;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .budget-modal-header {
          padding: 24px 32px;
          border-bottom: 1px solid var(--portal-border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: #fff;
        }

        .budget-modal-header h3 {
          margin: 4px 0 0;
          font-family: 'Fraunces', serif;
          font-size: 1.35rem;
          color: var(--portal-ink);
        }

        .budget-modal-close {
          background: var(--portal-mist);
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 1.5rem;
          line-height: 1;
          cursor: pointer;
          color: var(--portal-slate);
          display: grid;
          place-items: center;
          transition: all 0.2s ease;
        }

        .budget-modal-close:hover {
          background: var(--portal-border);
          color: var(--portal-ink);
        }

        .budget-modal-body {
          padding: 32px;
          background: #fff;
        }

        .budget-decision-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 24px;
        }

        .budget-modal-footer {
          padding: 20px 32px;
          background: var(--portal-mist);
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid var(--portal-border);
        }

        @media (max-width: 600px) {
          .budget-decision-grid {
            grid-template-columns: 1fr;
          }
          
          .budget-modal-body {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
};
