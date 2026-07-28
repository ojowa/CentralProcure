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
        <h3 style={{ color: 'var(--portal-forest)' }}>Active Workflow</h3>
        <p className="metric-value">{summary?.ActiveWorkflowItems ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>Live tracked items</span>
      </article>
      
      <article className="portal-module-card metric-card--glass">
        <h3 style={{ color: 'var(--portal-gold)' }}>Administrative Review</h3>
        <p className="metric-value">{summary?.AdministrativeReviewsOpen ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>Open petitions/challenges</span>
      </article>

      <article className="portal-module-card metric-card--glass">
        <h3>Completed Closeouts</h3>
        <p className="metric-value">{summary?.CloseoutsArchived ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>Archived records</span>
      </article>

      <article className="portal-module-card metric-card--glass" style={{ borderLeft: '4px solid var(--portal-forest)' }}>
        <h3>30-Day Velocity</h3>
        <p className="metric-value">{summary?.RecentTransitions ?? 0}</p>
        <span className="plan-muted" style={{ fontSize: '0.75rem' }}>Workflow transitions</span>
      </article>
    </div>
  );
};
