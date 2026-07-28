'use client';

import React from 'react';
import { BudgetVarianceGauge } from './BudgetVarianceGauge';
import { BudgetRiskChart } from './BudgetRiskChart';
import type { BudgetDashboardResponse } from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  dashboard: BudgetDashboardResponse | null;
  compact?: boolean;
};

export const BudgetMetrics = ({ dashboard, compact }: Props) => {
  if (!dashboard) return <div className="plan-loading">Loading dashboard...</div>;

  if (compact) {
    return (
      <div className="budget-metrics-compact animate-rise-in budget-card p-4">
        <div className="compact-metric compact-metric--primary">
          <span>Available Budget</span>
          <strong className="budget-kpi-value">{formatCurrency(dashboard.Available)}</strong>
        </div>
        <div className="compact-metric">
          <span>At Risk</span>
          <strong className={`variance-negative text-lg font-bold`}>{dashboard.AtRiskCount}</strong>
        </div>
        <style jsx>{`
          .budget-metrics-compact {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(110px, 0.6fr);
            gap: 12px;
            align-items: stretch;
          }

          .compact-metric {
            border: 1px solid var(--portal-border);
            border-radius: 16px;
            padding: 12px 14px;
            background: rgba(248, 250, 252, 0.9);
          }

          .compact-metric span {
            display: block;
            font-size: 0.78rem;
            color: #64748b;
            margin-bottom: 6px;
          }

          .compact-metric strong {
            display: block;
            line-height: 1.2;
          }

          .compact-metric--primary {
            background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="budget-hero-dashboard grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 animate-fade-up">
      {/* Central Gauge */}
      <div className="col-span-full flex justify-center">
        <BudgetVarianceGauge dashboard={dashboard} />
      </div>

      {/* KPI Grid */}
      <div className="budget-kpi-grid grid grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="budget-kpi budget-card text-center p-6">
          <div className="budget-kpi-value variance-positive">{formatCurrency(dashboard.Appropriated)}</div>
          <div className="budget-kpi-label mt-2">Appropriated</div>
        </div>
        <div className="budget-kpi budget-card text-center p-6">
          <div className="budget-kpi-value" style={{ color: 'var(--budget-info)' }}>{formatCurrency(dashboard.Released)}</div>
          <div className="budget-kpi-label mt-2">Released</div>
        </div>
        <div className="budget-kpi budget-card text-center p-6">
          <div className="budget-kpi-value variance-negative">{formatCurrency(dashboard.Committed)}</div>
          <div className="budget-kpi-label mt-2">Committed</div>
        </div>
        <div className="budget-kpi budget-card text-center p-6 lg:col-span-2">
          <div className="budget-kpi-value variance-positive text-3xl">{formatCurrency(dashboard.Available)}</div>
          <div className="budget-kpi-label mt-2 text-base">Remaining Capacity</div>
        </div>
        <div className="budget-kpi budget-card text-center p-6">
          <div className="text-3xl font-bold variance-negative">{dashboard.AtRiskCount}</div>
          <div className="budget-kpi-label mt-2">Critical Risks</div>
        </div>
      </div>

      {/* Risk Heatmap */}
      <BudgetRiskChart risks={dashboard.TopRisks || []} className="lg:col-span-2" />

      <style jsx>{`
        .budget-hero-dashboard {
          max-width: 1400px;
        }
        .budget-kpi-grid {
          margin-top: -2rem;
        }
        .budget-metrics-compact {
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 768px) {
          .budget-kpi-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

