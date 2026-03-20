'use client';

import React from 'react';
import type { BudgetDashboardResponse } from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  dashboard: BudgetDashboardResponse | null;
  onSelectPlan: (planId: string) => void;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(Math.round(value), 100);
};

const getHealthTone = (value: number) => {
  if (value >= 75) return 'good';
  if (value >= 40) return 'warn';
  return 'alert';
};

export const BudgetExecutionDashboard = ({ dashboard, onSelectPlan }: Props) => {
  if (!dashboard) {
    return <div className="plan-loading">Loading dashboard...</div>;
  }

  const releasedOfAppropriated = dashboard.Appropriated > 0
    ? clampPercent((dashboard.Released / dashboard.Appropriated) * 100)
    : 0;
  const committedOfReleased = dashboard.Released > 0
    ? clampPercent((dashboard.Committed / dashboard.Released) * 100)
    : 0;
  const spentOfCommitted = dashboard.Committed > 0
    ? clampPercent((dashboard.Spent / dashboard.Committed) * 100)
    : 0;
  const availableOfAppropriated = dashboard.Appropriated > 0
    ? clampPercent((dashboard.Available / dashboard.Appropriated) * 100)
    : 0;

  const stages = [
    { label: 'Appropriated', value: dashboard.Appropriated, width: 100, tone: 'neutral' },
    { label: 'Released', value: dashboard.Released, width: releasedOfAppropriated, tone: 'info' },
    { label: 'Committed', value: dashboard.Committed, width: committedOfReleased, tone: 'warn' },
    { label: 'Spent', value: dashboard.Spent, width: spentOfCommitted, tone: 'alert' },
    { label: 'Available', value: dashboard.Available, width: availableOfAppropriated, tone: getHealthTone(availableOfAppropriated) }
  ];

  return (
    <section className="budget-execution-dashboard">
      <div className="budget-execution-dashboard__hero">
        <div className="budget-execution-dashboard__hero-copy">
          <span className="admin-kicker">Budget Execution Summary</span>
          <h3>Funding flow from appropriation to available balance</h3>
          <p className="plan-muted">
            Track where the current budget stands, how much has been released into execution, and which plans are
            likely to fail budget confirmation.
          </p>
        </div>
        <div className="budget-execution-dashboard__health">
          <span>Budget Health</span>
          <strong className={`budget-execution-dashboard__health-badge budget-execution-dashboard__health-badge--${getHealthTone(availableOfAppropriated)}`}>
            {availableOfAppropriated >= 75 ? 'Healthy' : availableOfAppropriated >= 40 ? 'Tight' : 'Constrained'}
          </strong>
        </div>
      </div>

      <div className="budget-execution-dashboard__kpis">
        {stages.map((stage) => (
          <article key={stage.label} className={`budget-stage-card budget-stage-card--${stage.tone}`}>
            <span>{stage.label}</span>
            <strong>{formatCurrency(stage.value)}</strong>
          </article>
        ))}
      </div>

      <div className="budget-execution-dashboard__waterfall">
        {stages.map((stage) => (
          <div key={stage.label} className="budget-waterfall-row">
            <div className="budget-waterfall-row__header">
              <span>{stage.label}</span>
              <strong>{stage.width}%</strong>
            </div>
            <div className="budget-waterfall-row__track">
              <div
                className={`budget-waterfall-row__fill budget-waterfall-row__fill--${stage.tone}`}
                style={{ width: `${stage.width}%` }}
              />
            </div>
            <span className="budget-waterfall-row__value">{formatCurrency(stage.value)}</span>
          </div>
        ))}
      </div>

      <div className="budget-execution-dashboard__health-grid">
        <article className="budget-health-card">
          <span>Released vs Appropriated</span>
          <strong>{releasedOfAppropriated}%</strong>
          <p className="plan-muted">{formatCurrency(dashboard.Released)} has been released into execution.</p>
        </article>
        <article className="budget-health-card">
          <span>Committed vs Released</span>
          <strong>{committedOfReleased}%</strong>
          <p className="plan-muted">{formatCurrency(dashboard.Committed)} is already reserved or committed.</p>
        </article>
        <article className="budget-health-card">
          <span>Spent vs Committed</span>
          <strong>{spentOfCommitted}%</strong>
          <p className="plan-muted">{formatCurrency(dashboard.Spent)} has moved into expenditure.</p>
        </article>
      </div>

      <article className="budget-risk-ledger">
        <div className="budget-risk-ledger__header">
          <div>
            <h4>High-Risk Budget Lines</h4>
            <p className="plan-muted">Plans with requested value above current available balance.</p>
          </div>
          <span className="budget-risk-ledger__count">{dashboard.TopRisks?.length ?? 0} flagged</span>
        </div>

        {dashboard.TopRisks?.length ? (
          <div className="budget-risk-ledger__table-shell">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Department</th>
                  <th>Budget Line</th>
                  <th>Requested</th>
                  <th>Available</th>
                  <th>Variance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dashboard.TopRisks.map((risk) => (
                  <tr key={risk.PlanId}>
                    <td>{risk.PlanTitle}</td>
                    <td>{risk.Department}</td>
                    <td>{risk.BudgetCode}</td>
                    <td>{formatCurrency(risk.RequestedAmount)}</td>
                    <td>{formatCurrency(risk.Available)}</td>
                    <td className="variance-negative">{formatCurrency(risk.Variance)}</td>
                    <td>
                      <button type="button" className="plan-button plan-button--secondary" onClick={() => onSelectPlan(risk.PlanId)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="plan-empty">No budget-line risk is currently blocking the queue.</div>
        )}
      </article>

      <style jsx>{`
        .budget-execution-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .budget-execution-dashboard__hero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          padding: 24px;
          border-radius: 22px;
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
          border: 1px solid var(--portal-border);
        }

        .budget-execution-dashboard__hero-copy h3 {
          margin: 6px 0;
        }

        .budget-execution-dashboard__health {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
          min-width: 180px;
        }

        .budget-execution-dashboard__health span {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }

        .budget-execution-dashboard__health-badge {
          padding: 10px 16px;
          border-radius: 999px;
          font-weight: 700;
          background: #e2e8f0;
          color: #0f172a;
        }

        .budget-execution-dashboard__health-badge--good {
          background: #dcfce7;
          color: #166534;
        }

        .budget-execution-dashboard__health-badge--warn {
          background: #fef3c7;
          color: #92400e;
        }

        .budget-execution-dashboard__health-badge--alert {
          background: #fee2e2;
          color: #991b1b;
        }

        .budget-execution-dashboard__kpis {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .budget-stage-card {
          padding: 18px;
          border-radius: 18px;
          border: 1px solid var(--portal-border);
          background: white;
        }

        .budget-stage-card span {
          display: block;
          font-size: 0.78rem;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 8px;
        }

        .budget-stage-card strong {
          font-size: 1.1rem;
          color: #0f172a;
        }

        .budget-stage-card--info {
          background: #eff6ff;
        }

        .budget-stage-card--warn {
          background: #fffbeb;
        }

        .budget-stage-card--alert {
          background: #fef2f2;
        }

        .budget-stage-card--good {
          background: #f0fdf4;
        }

        .budget-execution-dashboard__waterfall,
        .budget-risk-ledger,
        .budget-health-card {
          border: 1px solid var(--portal-border);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.96);
        }

        .budget-execution-dashboard__waterfall {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .budget-waterfall-row {
          display: grid;
          grid-template-columns: 180px minmax(0, 1fr) 180px;
          gap: 14px;
          align-items: center;
        }

        .budget-waterfall-row__header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-weight: 600;
          color: #0f172a;
        }

        .budget-waterfall-row__track {
          height: 12px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .budget-waterfall-row__fill {
          height: 100%;
          border-radius: 999px;
        }

        .budget-waterfall-row__fill--neutral {
          background: #94a3b8;
        }

        .budget-waterfall-row__fill--info {
          background: #3b82f6;
        }

        .budget-waterfall-row__fill--warn {
          background: #f59e0b;
        }

        .budget-waterfall-row__fill--alert {
          background: #ef4444;
        }

        .budget-waterfall-row__fill--good {
          background: #22c55e;
        }

        .budget-waterfall-row__value {
          text-align: right;
          font-weight: 600;
          color: #334155;
        }

        .budget-execution-dashboard__health-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .budget-health-card {
          padding: 18px;
        }

        .budget-health-card span {
          display: block;
          font-size: 0.78rem;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 8px;
        }

        .budget-health-card strong {
          display: block;
          font-size: 1.4rem;
          margin-bottom: 8px;
        }

        .budget-risk-ledger {
          padding: 20px;
        }

        .budget-risk-ledger__header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .budget-risk-ledger__header h4 {
          margin: 0 0 4px;
        }

        .budget-risk-ledger__count {
          padding: 8px 12px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 700;
          white-space: nowrap;
        }

        .budget-risk-ledger__table-shell {
          overflow-x: auto;
        }

        @media (max-width: 1200px) {
          .budget-execution-dashboard__kpis,
          .budget-execution-dashboard__health-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .budget-waterfall-row {
            grid-template-columns: 150px minmax(0, 1fr) 150px;
          }
        }

        @media (max-width: 720px) {
          .budget-execution-dashboard__hero,
          .budget-risk-ledger__header {
            flex-direction: column;
          }

          .budget-execution-dashboard__health {
            align-items: flex-start;
            min-width: 0;
          }

          .budget-execution-dashboard__kpis,
          .budget-execution-dashboard__health-grid {
            grid-template-columns: 1fr;
          }

          .budget-waterfall-row {
            grid-template-columns: 1fr;
          }

          .budget-waterfall-row__value {
            text-align: left;
          }
        }
      `}</style>
    </section>
  );
};
