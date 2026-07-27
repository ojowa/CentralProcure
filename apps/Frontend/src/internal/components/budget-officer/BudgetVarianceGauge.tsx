'use client';

import React from 'react';
import { formatCurrency } from '../../utils/procureUtils';
import type { BudgetDashboardResponse } from '../../types/internal';

type Props = {
  dashboard: BudgetDashboardResponse;
  className?: string;
};

export const BudgetVarianceGauge = ({ dashboard, className = '' }: Props) => {
  const variancePercent = dashboard.Available > 0 
    ? Math.min((dashboard.Available / dashboard.Appropriated) * 100, 100) 
    : 0;
  const valuePercent = Math.round(variancePercent);

  return (
    <div className={`budget-gauge ${className}`} style={{ '--value': `${valuePercent}` } as React.CSSProperties}>
      <div className="budget-gauge-circle" />
      <div className="budget-gauge-inner">
        <div className="budget-kpi-value">{formatCurrency(dashboard.Available)}</div>
        <div className="budget-kpi-label">Available</div>
        <div className={`text-sm mt-2 ${valuePercent > 70 ? 'variance-positive' : valuePercent > 40 ? '' : 'variance-negative'}`}>
          {valuePercent}%
        </div>
      </div>
      
      <style jsx>{`
        .budget-gauge {
          --size: 160px;
          --stroke: 16px;
          width: var(--size);
          height: var(--size);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .budget-gauge-circle {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: conic-gradient(
            var(--budget-success) 0deg calc(var(--value) * 3.6deg),
            var(--budget-warning) calc(var(--value) * 3.6deg) 75%,
            var(--budget-danger) 75% 100%
          );
          mask: radial-gradient(farthest-side, transparent calc(100% - var(--stroke) / 2), black 0);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--stroke) / 2), black 0);
          margin-bottom: -var(--stroke);
        }
        .budget-gauge-inner {
          background: white;
          border-radius: 50%;
          width: calc(var(--size) - var(--stroke) * 2);
          height: calc(var(--size) - var(--stroke) * 2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          position: relative;
          z-index: 1;
        }
      `}</style>
    </div>
  );
};

