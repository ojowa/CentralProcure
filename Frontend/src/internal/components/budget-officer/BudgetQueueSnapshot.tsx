'use client';

import React from 'react';
import type { BudgetDashboardResponse } from '../../types/internal';

type Props = {
  dashboard: BudgetDashboardResponse | null;
};

export const BudgetQueueSnapshot = ({ dashboard }: Props) => {
  return (
    <article className="portal-module-card">
      <h3>Queue Snapshot</h3>
      <div className="budget-workspace__metric-list">
        <div>
          <span>In Queue</span>
          <strong>{dashboard?.QueueCount ?? 0}</strong>
        </div>
        <div>
          <span>Awaiting Budget Review</span>
          <strong>{dashboard?.AwaitingBudgetReviewCount ?? 0}</strong>
        </div>
        <div>
          <span>On Hold</span>
          <strong>{dashboard?.OnHoldCount ?? 0}</strong>
        </div>
        <div>
          <span>Ready for APP Approval</span>
          <strong>{dashboard?.ReadyForApprovalCount ?? 0}</strong>
        </div>
      </div>
    </article>
  );
};
