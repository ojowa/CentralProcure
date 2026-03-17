'use client';

import React from 'react';

type ViewType = 'dashboard' | 'queue' | 'review';

type Props = {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  hasSelection: boolean;
};

export const BudgetSubNav = ({ activeView, onViewChange, hasSelection }: Props) => {
  return (
    <nav className="budget-nav-stack">
      <button
        type="button"
        className={activeView === 'dashboard' ? 'budget-nav-item active' : 'budget-nav-item'}
        onClick={() => onViewChange('dashboard')}
      >
        <span className="nav-icon">📊</span>
        <div className="nav-label">
          <strong>Insights Dashboard</strong>
          <span>Appropriations & Risk</span>
        </div>
      </button>
      
      <button
        type="button"
        className={activeView === 'queue' ? 'budget-nav-item active' : 'budget-nav-item'}
        onClick={() => onViewChange('queue')}
      >
        <span className="nav-icon">🔄</span>
        <div className="nav-label">
          <strong>Requisition Queue</strong>
          <span>Pipeline Management</span>
        </div>
      </button>
      
      <button
        type="button"
        className={activeView === 'review' ? 'budget-nav-item active' : 'budget-nav-item'}
        onClick={() => onViewChange('review')}
        disabled={!hasSelection}
      >
        <span className="nav-icon">⚖️</span>
        <div className="nav-label">
          <strong>Active Review</strong>
          <span>Decision Terminal</span>
        </div>
        {!hasSelection && <span className="nav-badge">Select Item</span>}
      </button>

      <style jsx>{`
        .budget-nav-stack {
          display: grid;
          gap: 10px;
          margin-bottom: 24px;
        }

        .budget-nav-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.4);
          border: 1px solid var(--portal-border);
          border-radius: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          color: var(--portal-ink);
          font-family: inherit;
        }

        .budget-nav-item:hover:not(:disabled) {
          background: #fff;
          border-color: var(--portal-forest);
          transform: translateX(4px);
        }

        .budget-nav-item.active {
          background: #fff;
          border-color: var(--portal-forest);
          box-shadow: 0 4px 12px rgba(11, 93, 59, 0.08);
          border-left-width: 4px;
        }

        .nav-icon {
          font-size: 1.25rem;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .nav-label {
          display: flex;
          flex-direction: column;
        }

        .nav-label strong {
          font-size: 0.875rem;
          font-weight: 700;
        }

        .nav-label span {
          font-size: 0.75rem;
          color: var(--portal-slate);
        }

        .nav-badge {
          position: absolute;
          right: 12px;
          top: 12px;
          font-size: 9px;
          text-transform: uppercase;
          background: var(--portal-mist);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .budget-nav-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(1);
        }
      `}</style>
    </nav>
  );
};
