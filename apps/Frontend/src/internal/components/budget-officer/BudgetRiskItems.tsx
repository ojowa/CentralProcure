'use client';

import React from 'react';
import type { BudgetDashboardResponse } from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  dashboard: BudgetDashboardResponse | null;
  onSelectPlan: (planId: string) => void;
};

export const BudgetRiskItems = ({ dashboard, onSelectPlan }: Props) => {
  return (
    <article className="portal-module-card budget-workspace__risk-card">
      <h3>Top Risk Items</h3>
      {dashboard?.TopRisks?.length ? (
        <div className="budget-workspace__risk-list">
          {dashboard.TopRisks.map((risk) => (
            <button
              key={risk.PlanId}
              type="button"
              className="budget-workspace__risk-item"
              onClick={() => onSelectPlan(risk.PlanId)}
            >
              <strong>{risk.PlanTitle}</strong>
              <span>{risk.Department}</span>
              <span>{risk.BudgetCode}</span>
              <span>Variance {formatCurrency(risk.Variance)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="plan-empty">No over-budget items are currently flagged.</div>
      )}
    </article>
  );
};
