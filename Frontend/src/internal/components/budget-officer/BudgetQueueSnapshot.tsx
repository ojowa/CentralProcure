'use client';

import React from 'react';
import type { BudgetDashboardResponse } from '../../types/internal';

type Props = {
  dashboard: BudgetDashboardResponse | null;
};

export const BudgetQueueSnapshot = ({ dashboard }: Props) => {
  return (
    <article className="portal-module-card">
      <h3>Queue Summary</h3>
      <div className="budget-queue-snapshot">
        <div>
          <span>Queue</span>
          <strong>{dashboard?.QueueCount ?? 0}</strong>
        </div>
        <div>
          <span>Pending</span>
          <strong>{dashboard?.AwaitingBudgetReviewCount ?? 0}</strong>
        </div>
        <div>
          <span>Hold</span>
          <strong>{dashboard?.OnHoldCount ?? 0}</strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>{dashboard?.ReadyForApprovalCount ?? 0}</strong>
        </div>
      </div>
      <style jsx>{`
        .budget-queue-snapshot {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .budget-queue-snapshot div {
          border: 1px solid var(--portal-border);
          border-radius: 14px;
          padding: 12px 10px;
          text-align: center;
          background: rgba(248, 250, 252, 0.9);
        }

        .budget-queue-snapshot span {
          display: block;
          font-size: 0.74rem;
          color: #64748b;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .budget-queue-snapshot strong {
          font-size: 1.15rem;
          color: #0f172a;
        }

        @media (max-width: 720px) {
          .budget-queue-snapshot {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </article>
  );
};
