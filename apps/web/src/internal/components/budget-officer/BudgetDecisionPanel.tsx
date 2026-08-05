'use client';

import { useCallback, useEffect } from 'react';
import type { BudgetConfirmationDetail } from '../../types/internal';
import { formatCurrency, getVarianceColor } from '../../utils/procureUtils';

interface DecisionConfig {
  label: string;
  className: string;
  icon: string;
}

const decisionConfig = {
  start_review: {
    label: 'Start Review',
    className: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
    icon: '📝'
  },
  confirm: {
    label: 'Confirm Funding',
    className: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-200 shadow-md shadow-green-200/50',
    icon: '✅'
  },
  hold: {
    label: 'Place On Hold',
    className: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-200',
    icon: '⏸️'
  },
  return: {
    label: 'Return for Correction',
    className: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-200',
    icon: '↩️'
  },
  reject: {
    label: 'Reject Request',
    className: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-200 shadow-md shadow-red-200/50',
    icon: '❌'
  }
} as const;

type DecisionKey = keyof typeof decisionConfig;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  detail: BudgetConfirmationDetail | null;
  availableDecisions: DecisionKey[];
  decisionNote: string;
  onNoteChange: (note: string) => void;
  onDecision: (decision: DecisionKey, note: string) => void;
  canTakeDecisions: boolean;
  isSaving: boolean;
  error?: string | null;
};

export const BudgetDecisionPanel = ({
  isOpen,
  onClose,
  detail,
  availableDecisions,
  decisionNote,
  onNoteChange,
  onDecision,
  canTakeDecisions,
  isSaving,
  error
}: Props) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleDecision = useCallback(
    (decision: DecisionKey) => {
      onDecision(decision, decisionNote);
    },
    [onDecision, decisionNote]
  );

  if (!isOpen || !detail) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in zoom-in duration-200"
      onClick={onClose}
    >
      <div
        className="budget-modal-card max-w-2xl w-full max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/20 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-8 pb-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="admin-kicker bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold inline-flex items-center gap-2">
                🟋 Decision Terminal
              </div>
              <h3 className="text-2xl font-bold mt-3 mb-1 leading-tight">{detail.PlanTitle}</h3>
              <p className="text-slate-600 text-sm">
                {detail.Department} • FY {detail.FiscalYear} • {formatCurrency(detail.RequestedAmount)}
              </p>
            </div>
            <button
              className="p-2 -m-2 rounded-2xl hover:bg-slate-200 transition-all text-slate-500 hover:text-slate-900"
              onClick={onClose}
              disabled={isSaving}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-sm">
              <div className="font-semibold mb-1">Decision Error</div>
              {error}
            </div>
          )}

          <div className="budget-card p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(detail.Appropriated)}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Appropriated</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getVarianceColor(detail.Variance)}`}>{formatCurrency(detail.Available)}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(Math.abs(detail.Variance))}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Variance</div>
              </div>
              <div>
                <div className="text-lg font-bold">{detail.BudgetLines.length}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Lines</div>
              </div>
            </div>
          </div>

          <label className="block mb-6">
            <span className="block font-semibold text-sm uppercase tracking-wide text-slate-700 mb-2">Rationale</span>
            <textarea
              className="w-full p-4 border border-slate-300 rounded-2xl resize-vertical focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all text-sm min-h-[120px]"
              rows={5}
              value={decisionNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Document your decision rationale, affordability analysis, or instructions..."
              disabled={!canTakeDecisions || isSaving}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableDecisions.map((decision) => (
              <button
                key={decision}
                className={`budget-decision-button h-16 flex items-center justify-center gap-3 font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 p-0 text-sm ${decisionConfig[decision].className} ${
                  isSaving ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                onClick={() => !isSaving && handleDecision(decision)}
                disabled={!canTakeDecisions || isSaving}
              >
                <span className="text-xl">{decisionConfig[decision].icon}</span>
                <span>{decisionConfig[decision].label}</span>
              </button>
            ))}
          </div>

          {!canTakeDecisions && (
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 text-center">
              <div className="text-4xl mb-4 opacity-50">🧭</div>
              <h4 className="font-bold text-lg mb-2 text-slate-900">Role Restricted</h4>
              <p className="text-slate-600 text-sm">Your account does not have permission to record budget decisions. Contact your administrator.</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 bg-slate-50 border-t flex justify-end gap-3">
          <button
            className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition-all flex items-center gap-2"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
