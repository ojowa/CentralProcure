'use client';

type ViewType = 'dashboard' | 'ledger' | 'releaseledger' | 'commitments' | 'create' | 'review';

type Props = {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  hasSelection: boolean;
  canCreateBudget: boolean;
  canViewLedger: boolean;
};

export const BudgetSubNav = ({
  activeView,
  onViewChange,
  hasSelection,
  canCreateBudget,
  canViewLedger
}: Props) => {
  const views: Array<{
    key: ViewType;
    title: string;
    subtitle: string;
    disabled?: boolean;
    badge?: string;
  }> = [
    { key: 'dashboard', title: 'Dashboard', subtitle: 'Insights', disabled: false },
    { key: 'ledger', title: 'Ledger', subtitle: 'Appropriations', disabled: !canViewLedger, badge: canViewLedger ? undefined : 'Locked' },
    { key: 'releaseledger', title: 'Release Ledger', subtitle: 'Fund logs', disabled: !canViewLedger, badge: canViewLedger ? undefined : 'Locked' },
    { key: 'commitments', title: 'Commitments', subtitle: 'Committed funds', disabled: !canViewLedger, badge: canViewLedger ? undefined : 'Locked' },
    { key: 'create', title: 'Create Budget', subtitle: 'New appropriation', disabled: !canCreateBudget, badge: canCreateBudget ? undefined : 'Restricted' }
  ];

  return (
    <nav className="budget-top-tabs" aria-label="Budget workspace sections">
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          className={`budget-top-tabs__item ${activeView === view.key ? 'is-active' : ''}`}
          onClick={() => !view.disabled && onViewChange(view.key)}
          disabled={view.disabled}
          title={`${view.title}: ${view.subtitle}${view.badge ? ` (${view.badge})` : ''}`}
        >
          <span className="budget-top-tabs__title">{view.title}</span>
          <span className="budget-top-tabs__subtitle">{view.subtitle}</span>
          {view.badge ? <span className="budget-top-tabs__badge">{view.badge}</span> : null}
        </button>
      ))}

      <style jsx>{`
        .budget-top-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .budget-top-tabs__item {
          position: relative;
          min-width: 128px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--portal-border);
          background: rgba(255, 255, 255, 0.92);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex-shrink: 0;
          transition: 160ms ease;
        }

        .budget-top-tabs__item:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .budget-top-tabs__item.is-active {
          border-color: #2563eb;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.12);
        }

        .budget-top-tabs__title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.1;
        }

        .budget-top-tabs__subtitle {
          font-size: 0.72rem;
          color: #64748b;
          line-height: 1.05;
        }

        .budget-top-tabs__badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          font-size: 0.62rem;
          font-weight: 700;
          color: #475569;
        }
      `}</style>
    </nav>
  );
};
