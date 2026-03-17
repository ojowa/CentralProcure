'use client';

import React from 'react';
import type { BudgetDashboardResponse } from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  dashboard: BudgetDashboardResponse | null;
  compact?: boolean;
};

export const BudgetMetrics = ({ dashboard, compact }: Props) => {
  if (compact) {
    return (
      <div className="budget-metrics-compact animate-rise-in">
        <div className="compact-metric">
          <span>Available</span>
          <strong>{formatCurrency(dashboard?.Available ?? 0)}</strong>
        </div>
        <div className="compact-metric">
          <span>At Risk</span>
          <strong style={{ color: 'var(--portal-alert)' }}>{dashboard?.AtRiskCount ?? 0} plans</strong>
        </div>

        <style jsx>{`
          .budget-metrics-compact {
            display: grid;
            gap: 12px;
            padding: 16px;
            background: #fff;
            border: 1px solid var(--portal-border);
            border-radius: 16px;
            margin-bottom: 20px;
          }

          .compact-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .compact-metric span {
            font-size: 0.75rem;
            color: var(--portal-slate);
            font-weight: 500;
          }

          .compact-metric strong {
            font-size: 0.875rem;
            font-weight: 700;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="budget-workspace__metrics animate-fade-up">
      <article className="portal-module-card metric-card--glass">
        <h3>Appropriated</h3>
        <p className="metric-value">{formatCurrency(dashboard?.Appropriated ?? 0)}</p>
      </article>
      <article className="portal-module-card metric-card--glass">
        <h3>Released</h3>
        <p className="metric-value">{formatCurrency(dashboard?.Released ?? 0)}</p>
      </article>
      <article className="portal-module-card metric-card--glass">
        <h3>Committed</h3>
        <p className="metric-value">{formatCurrency(dashboard?.Committed ?? 0)}</p>
      </article>
      <article className="portal-module-card metric-card--glass">
        <h3>Available</h3>
        <p className="metric-value" style={{ color: 'var(--portal-forest)' }}>
          {formatCurrency(dashboard?.Available ?? 0)}
        </p>
      </article>
      <article className="portal-module-card metric-card--glass" style={{ borderLeft: '4px solid var(--portal-alert)' }}>
        <h3>At Risk</h3>
        <p className="metric-value" style={{ color: 'var(--portal-alert)' }}>
          {dashboard?.AtRiskCount ?? 0} <small style={{ fontSize: '0.65em', fontWeight: 400 }}>plans</small>
        </p>
      </article>
    </div>
  );
};
