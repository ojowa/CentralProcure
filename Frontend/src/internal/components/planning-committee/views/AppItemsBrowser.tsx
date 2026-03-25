import React from 'react';
import { DepartmentPlansTable } from './DepartmentPlansTable';
import type { ProcurementPlanSummary } from '../../../types/internal';

interface AppItemsBrowserProps {
  token: string | null;
  role?: string | null;
  plans: ProcurementPlanSummary[];
  appItems?: any[];
  selectedPlanId?: string;
  onPlanChange?: (planId: string) => void;
  onLoadItems?: (planId: string) => void;
  onPlanRecommended?: () => Promise<void> | void;
  formatCurrency: (value: number) => string;
  downloadCsv: () => void;
}

/**
 * AppItemsBrowser has been remodeled to show Department Plans table
 * instead of APP line items grid view.
 */
export const AppItemsBrowser: React.FC<AppItemsBrowserProps> = ({
  token,
  role,
  plans,
  onPlanRecommended,
  formatCurrency,
  downloadCsv
}) => {
  const visiblePlans = plans.filter((plan) => {
    const stageKey = String(plan.CurrentStageKey || '').toLowerCase();
    if (stageKey) {
      return stageKey === 'planning_committee_review';
    }
    return plan.Status === 'Under Review' || plan.Status === 'Returned';
  });

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h3>Department Plans</h3>
        <p className="plan-muted">Review departmental procurement plans organized by department.</p>
      </div>

      <DepartmentPlansTable
        token={token}
        role={role}
        plans={visiblePlans}
        onPlanRecommended={onPlanRecommended}
        formatCurrency={formatCurrency}
        onExportCsv={downloadCsv}
      />
    </div>
  );
};
