'use client';

import React from 'react';
import type { AuditSummaryResponse } from '../../types/internal';

type Props = {
  summary: AuditSummaryResponse | null;
};

export const AuditMetrics = ({ summary }: Props) => {
  return (
    <div className="budget-workspace__metrics animate-fade-up">
      <article className="portal-module-card metric-card--glass">
        <h3 style={{ color: 'var(--portal-forest)' }}>Active Contracts</h3>
        <p className="metric-value">{summary?.ActiveContracts ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>of {summary?.TotalContracts ?? 0} total</span>
      </article>
      
      <article className="portal-module-card metric-card--glass">
        <h3 style={{ color: 'var(--portal-gold)' }}>Inspections</h3>
        <p className="metric-value">{summary?.CompletedInspections ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>of {summary?.TotalInspections ?? 0} completed</span>
      </article>

      <article className="portal-module-card metric-card--glass">
        <h3>Total Paid</h3>
        <p className="metric-value">₦{((summary?.TotalPaid ?? 0) / 1_000_000).toFixed(1)}M</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>{summary?.TotalPayments ?? 0} payments</span>
      </article>

      <article className="portal-module-card metric-card--glass" style={{ borderLeft: '4px solid var(--portal-forest)' }}>
        <h3>Closeouts</h3>
        <p className="metric-value">{summary?.TotalCloseouts ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>{summary?.PendingCloseouts ?? 0} pending</span>
      </article>
    </div>
  );
};
