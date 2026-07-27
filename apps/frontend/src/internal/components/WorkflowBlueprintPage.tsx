'use client';

import React, { useEffect, useState } from 'react';
import type { InternalModule, WorkflowBlueprint } from '../types/internal';
import { fetchWorkflowBlueprint } from '../services/workflowBlueprintService';
import { formatCurrency } from '../utils/procureUtils';

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const WorkflowBlueprintPage = ({ module, token }: Props) => {
  const [blueprint, setBlueprint] = useState<WorkflowBlueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    setIsLoading(true);
    fetchWorkflowBlueprint(token)
      .then(setBlueprint)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load blueprint.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) return <div className="plan-loading">Loading statutory workflow blueprint...</div>;
  if (error) return <div className="portal-alert">{error}</div>;
  if (!blueprint) return <div className="plan-empty">No workflow blueprint data available.</div>;

  return (
    <section className="portal-module blueprint-page animate-fade-up">
      <header className="blueprint-header">
        <div className="admin-kicker">{module.controlPurpose}</div>
        <h2>{blueprint.Title}</h2>
        <p>{blueprint.Summary}</p>
        <div className="blueprint-meta">
          <span>Source: <strong>{blueprint.ThresholdSource}</strong></span>
          <span>Tables: <strong>{blueprint.DatabaseTables.join(', ')}</strong></span>
        </div>
      </header>

      <div className="blueprint-grid">
        <div className="blueprint-main">
          <article className="portal-module-card">
            <h3>Approval Thresholds (PPA 2007)</h3>
            <div className="plan-table-wrapper">
              <table className="plan-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Range (NGN)</th>
                    <th>Authority</th>
                    <th>Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {blueprint.Thresholds.map((t, i) => (
                    <tr key={i}>
                      <td><strong>{t.ProcurementType}</strong></td>
                      <td>
                        {formatCurrency(t.MinAmount)} — {t.MaxAmount ? formatCurrency(t.MaxAmount) : '∞'}
                      </td>
                      <td>
                        <div>{t.ApprovalAuthorityLabel}</div>
                        <div className="plan-muted">{t.ApprovalRoute}</div>
                      </td>
                      <td>
                        <div className="blueprint-badges">
                          {t.RequiresCgisApproval && <span className="req-badge">CGIS</span>}
                          {t.RequiresBoard && <span className="req-badge req-badge--warn">Board</span>}
                          {t.RequiresBpp && <span className="req-badge req-badge--alert">BPP</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="portal-module-card" style={{ marginTop: '24px' }}>
            <h3>Statutory Phases & States</h3>
            <div className="blueprint-phases">
              {blueprint.Phases.map(phase => (
                <div key={phase.Id} className="blueprint-phase">
                  <div className="phase-indicator">Phase {phase.Sequence}: {phase.Title}</div>
                  <div className="phase-states">
                    {blueprint.States.filter(s => s.PhaseId === phase.Id).map(state => (
                      <div key={state.Id} className="blueprint-state-card">
                        <div className="state-header">
                          <strong>{state.Title}</strong>
                          {state.IsDecisionGate && <span className="gate-icon" title="Decision Gate">⚖️</span>}
                        </div>
                        <p>{state.Description}</p>
                        <div className="state-meta">
                          <span>Ref: {state.PpaReference}</span>
                          <span>Owner: {state.PrimaryOwners.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="blueprint-sidebar">
          <article className="portal-module-card">
            <h3>Role Matrix</h3>
            <div className="blueprint-role-list">
              {blueprint.RoleTasks.map((rt, i) => (
                <div key={i} className="role-task-item">
                  <strong>{rt.DisplayName}</strong>
                  <div className="plan-muted">{rt.Task}</div>
                  <div className="task-outcome">Outcome: {rt.ExpectedOutcome}</div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>

      <style jsx>{`
        .blueprint-page {
          display: grid;
          gap: 24px;
        }
        .blueprint-header {
          border-bottom: 1px solid var(--portal-border);
          padding-bottom: 24px;
        }
        .blueprint-meta {
          display: flex;
          gap: 20px;
          margin-top: 12px;
          font-size: 0.875rem;
          color: var(--portal-slate);
        }
        .blueprint-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
          align-items: start;
        }
        .blueprint-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .blueprint-phase {
          margin-bottom: 24px;
        }
        .phase-indicator {
          background: var(--portal-forest);
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .phase-states {
          display: grid;
          gap: 12px;
        }
        .blueprint-state-card {
          background: #fff;
          border: 1px solid var(--portal-border);
          padding: 16px;
          border-radius: 12px;
        }
        .state-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .state-meta {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--portal-slate);
        }
        .blueprint-role-list {
          display: grid;
          gap: 16px;
        }
        .role-task-item {
          padding-bottom: 12px;
          border-bottom: 1px solid var(--portal-mist);
        }
        .task-outcome {
          margin-top: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--portal-forest);
        }
        @media (max-width: 1100px) {
          .blueprint-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
};
