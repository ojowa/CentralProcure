'use client';

import React from 'react';
import type { BudgetDashboardRiskItem } from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  risks: BudgetDashboardRiskItem[];
  className?: string;
};

const getRiskLevel = (variance: number, requested: number) => {
  const ratio = Math.abs(variance) / requested;
  if (ratio > 0.3) return 'risk-high';
  if (ratio > 0.1) return 'risk-medium';
  return 'risk-low';
};

export const BudgetRiskChart = ({ risks, className = '' }: Props) => (
  <div className={`risk-heatmap budget-card p-6 ${className}`}>
    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-4">Top Risks</h4>
    {risks.slice(0, 6).map((risk, idx) => {
      const riskClass = getRiskLevel(risk.Variance, risk.RequestedAmount);
      return (
        <div key={risk.PlanId} className={`risk-item ${riskClass}`}>
          <div className="font-mono text-xs text-slate-500 mb-1">{risk.BudgetCode}</div>
          <div className="text-lg font-bold">{risk.Department}</div>
          <div className={`text-sm mt-1 ${risk.Variance > 0 ? 'variance-positive' : 'variance-negative'}`}>
            {formatCurrency(risk.Variance)}
          </div>
        </div>
      );
    })}
    {risks.length === 0 && (
      <div className="text-center py-8 text-slate-500">
        No risks detected
      </div>
    )}
  </div>
);

