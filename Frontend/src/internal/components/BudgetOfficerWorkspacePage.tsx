'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  BudgetConfirmationDetail,
  BudgetConfirmationQueueItem,
  BudgetDashboardResponse,
  InternalModule,
  RoleKey
} from '../types/internal';
import {
  decideBudgetConfirmation,
  fetchBudgetConfirmationDetail,
  fetchBudgetConfirmations,
  fetchBudgetDashboard
} from '../services/budgetService';
import { formatCurrency, formatDate, formatDateTimeShort, toTitle } from '../utils/procureUtils';

type Props = {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
};

type BudgetFilters = {
  fiscalYear: string;
  department: string;
  stage: string;
  query: string;
};

const defaultFilters: BudgetFilters = {
  fiscalYear: '',
  department: '',
  stage: '',
  query: ''
};

const decisionConfig = {
  start_review: { label: 'Start Budget Review', className: 'plan-button plan-button--secondary' },
  confirm: { label: 'Confirm Funding', className: 'plan-button' },
  hold: { label: 'Place On Hold', className: 'plan-button plan-button--secondary' },
  return: { label: 'Return for Correction', className: 'plan-button plan-button--secondary' },
  reject: { label: 'Reject Budget Support', className: 'plan-button plan-button--danger' }
} as const;

const stageOptions = [
  { value: '', label: 'All active stages' },
  { value: 'planning_committee_review', label: 'Planning Committee Review' },
  { value: 'budget_confirmation', label: 'Budget Confirmation' },
  { value: 'app_approval', label: 'APP Approval' }
];

const getStatusTone = (value?: string | null): string => {
  switch ((value || '').toLowerCase()) {
    case 'budget confirmed':
    case 'approved':
      return 'admin-status admin-status--good';
    case 'on hold':
    case 'returned':
      return 'admin-status admin-status--warn';
    case 'rejected':
      return 'admin-status admin-status--alert';
    default:
      return 'admin-status';
  }
};

const getDecisionOptions = (detail: BudgetConfirmationDetail | null) => {
  if (!detail) {
    return [] as Array<keyof typeof decisionConfig>;
  }

  const options: Array<keyof typeof decisionConfig> = ['hold', 'return', 'reject'];
  if (detail.CurrentStageKey === 'planning_committee_review') {
    options.unshift('start_review');
    options.splice(1, 0, 'confirm');
    return options;
  }

  if (detail.CurrentStageKey === 'budget_confirmation') {
    options.unshift('confirm');
  }

  return options;
};

const getPagingMeta = (page: number, pageSize: number, total: number) => {
  if (!total) {
    return 'No records';
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} of ${total}`;
};

export const BudgetOfficerWorkspacePage = ({ module, token, role }: Props) => {
  const [filters, setFilters] = useState<BudgetFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState<BudgetDashboardResponse | null>(null);
  const [queue, setQueue] = useState<BudgetConfirmationQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BudgetConfirmationDetail | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canTakeDecisions = Boolean(
    token && role && ['financial_unit_officer', 'accounting_officer', 'admin'].includes(role)
  );

  const selectedQueueItem = useMemo(
    () => queue.find((item) => item.PlanId === selectedPlanId) ?? null,
    [queue, selectedPlanId]
  );

  const availableDecisions = useMemo(() => getDecisionOptions(detail), [detail]);

  const loadQueueAndDashboard = async () => {
    if (!token) {
      setDashboard(null);
      setQueue([]);
      setTotal(0);
      setSelectedPlanId(null);
      return;
    }

    const fiscalYear = Number(filters.fiscalYear);

    setIsLoadingQueue(true);
    setError('');
    try {
      const [nextDashboard, nextQueue] = await Promise.all([
        fetchBudgetDashboard(token, {
          fiscalYear: Number.isFinite(fiscalYear) && fiscalYear > 0 ? fiscalYear : undefined,
          department: filters.department || undefined
        }),
        fetchBudgetConfirmations(token, {
          fiscalYear: Number.isFinite(fiscalYear) && fiscalYear > 0 ? fiscalYear : undefined,
          department: filters.department || undefined,
          stage: filters.stage || undefined,
          query: filters.query || undefined,
          page,
          pageSize: 12
        })
      ]);

      setDashboard(nextDashboard);
      setQueue(nextQueue.Items);
      setTotal(nextQueue.Total);
      setSelectedPlanId((current) => {
        if (current && nextQueue.Items.some((item) => item.PlanId === current)) {
          return current;
        }

        return nextQueue.Items[0]?.PlanId ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load budget workspace.');
      setDashboard(null);
      setQueue([]);
      setTotal(0);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    void loadQueueAndDashboard();
  }, [token, filters.department, filters.fiscalYear, filters.query, filters.stage, page]);

  useEffect(() => {
    if (!token || !selectedPlanId) {
      setDetail(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDetail(true);
    setError('');

    fetchBudgetConfirmationDetail(token, selectedPlanId)
      .then((nextDetail) => {
        if (isMounted) {
          setDetail(nextDetail);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setDetail(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load budget detail.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPlanId, token]);

  const handleDecision = async (decision: keyof typeof decisionConfig) => {
    if (!token || !detail) {
      setError('Select a plan before taking a budget decision.');
      return;
    }

    setIsSaving(true);
    setError('');
    setFeedback('');

    try {
      const result = await decideBudgetConfirmation(token, detail.PlanId, {
        Decision: decision,
        Note: decisionNote.trim() || undefined
      });
      setFeedback(result.Message);
      await loadQueueAndDashboard();
      const refreshed = await fetchBudgetConfirmationDetail(token, detail.PlanId);
      setDetail(refreshed);
      setDecisionNote('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to apply budget decision.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module budget-workspace">
      <div className="budget-workspace__hero">
        <div>
          <div className="admin-kicker">Budget Officer Workspace</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="plan-actions">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => void loadQueueAndDashboard()}
            disabled={!token || isLoadingQueue}
          >
            {isLoadingQueue ? 'Refreshing...' : 'Refresh Workspace'}
          </button>
        </div>
      </div>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}
      {feedback ? <div className="plan-loading">{feedback}</div> : null}

      <div className="budget-workspace__metrics">
        <article className="portal-module-card">
          <h3>Appropriated</h3>
          <p>{formatCurrency(dashboard?.Appropriated ?? 0)}</p>
        </article>
        <article className="portal-module-card">
          <h3>Released</h3>
          <p>{formatCurrency(dashboard?.Released ?? 0)}</p>
        </article>
        <article className="portal-module-card">
          <h3>Committed</h3>
          <p>{formatCurrency(dashboard?.Committed ?? 0)}</p>
        </article>
        <article className="portal-module-card">
          <h3>Available</h3>
          <p>{formatCurrency(dashboard?.Available ?? 0)}</p>
        </article>
        <article className="portal-module-card">
          <h3>At Risk</h3>
          <p>{dashboard?.AtRiskCount ?? 0} plans</p>
        </article>
      </div>

      <div className="budget-workspace__layout">
        <section className="budget-workspace__queue">
          <div className="plan-toolbar">
            <div className="plan-filters">
              <label className="plan-field">
                <span>Fiscal Year</span>
                <input
                  className="plan-input"
                  inputMode="numeric"
                  value={filters.fiscalYear}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({ ...current, fiscalYear: event.target.value }));
                  }}
                  placeholder="2026"
                />
              </label>
              <label className="plan-field">
                <span>Department</span>
                <input
                  className="plan-input"
                  value={filters.department}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({ ...current, department: event.target.value }));
                  }}
                  placeholder="Marine Services"
                />
              </label>
              <label className="plan-field">
                <span>Stage</span>
                <select
                  className="plan-select"
                  value={filters.stage}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({ ...current, stage: event.target.value }));
                  }}
                >
                  {stageOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Search</span>
                <input
                  className="plan-input"
                  value={filters.query}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({ ...current, query: event.target.value }));
                  }}
                  placeholder="Plan title, department, budget code"
                />
              </label>
            </div>
          </div>

          <div className="budget-workspace__queue-header">
            <div>
              <h3>Tracked Requisitions</h3>
              <p>Select a requisition to inspect its current routing state and underlying request details.</p>
            </div>
            <span className="plan-muted">{getPagingMeta(page, 12, total)}</span>
          </div>

          {isLoadingQueue ? <div className="plan-loading">Loading budget queue...</div> : null}

          {queue.length ? (
            <div className="budget-workspace__queue-table">
              <table className="plan-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Stage</th>
                    <th>Requested</th>
                    <th>Available</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr
                      key={item.PlanId}
                      className={item.PlanId === selectedPlanId ? 'budget-workspace__row budget-workspace__row--active' : 'budget-workspace__row'}
                    >
                      <td>
                        <button type="button" className="plan-link" onClick={() => setSelectedPlanId(item.PlanId)}>
                          {item.PlanTitle}
                        </button>
                        <div className="plan-muted">{item.Department} · FY {item.FiscalYear}</div>
                      </td>
                      <td>
                        <div>{item.CurrentStageTitle}</div>
                        <span className={getStatusTone(item.WorkflowStatus ?? item.PlanStatus)}>
                          {item.WorkflowStatus ?? item.PlanStatus}
                        </span>
                      </td>
                      <td>{formatCurrency(item.RequestedAmount)}</td>
                      <td>{formatCurrency(item.Available)}</td>
                      <td>{formatCurrency(item.Variance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="plan-empty">No budget confirmation items matched the current filters.</div>
          )}

          <div className="plan-pagination">
            <span className="plan-pagination__meta">{getPagingMeta(page, 12, total)}</span>
            <div className="plan-pagination__controls">
              <button
                type="button"
                className="plan-button plan-button--secondary"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page <= 1 || isLoadingQueue}
              >
                Previous
              </button>
              <button
                type="button"
                className="plan-button plan-button--secondary"
                onClick={() => setPage((current) => current + 1)}
                disabled={page * 12 >= total || isLoadingQueue}
              >
                Next
              </button>
            </div>
          </div>

          <article className="portal-module-card budget-workspace__risk-card">
            <h3>Top Risk Items</h3>
            {dashboard?.TopRisks?.length ? (
              <div className="budget-workspace__risk-list">
                {dashboard.TopRisks.map((risk) => (
                  <button
                    key={risk.PlanId}
                    type="button"
                    className="budget-workspace__risk-item"
                    onClick={() => setSelectedPlanId(risk.PlanId)}
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
        </section>

        <section className="budget-workspace__detail">
          {isLoadingDetail ? <div className="plan-loading">Loading selected plan...</div> : null}

          {detail ? (
            <>
              <div className="requisition-header">
                <div>
                  <h3>{detail.PlanTitle}</h3>
                  <p>
                    {detail.Department} · FY {detail.FiscalYear} · {detail.ItemCount} line items
                  </p>
                </div>
                <div className="requisition-badges">
                  <span className="req-badge">{detail.CurrentStageTitle}</span>
                  <span className="req-badge req-badge--soft">{detail.PlanStatus}</span>
                  <span className={getStatusTone(detail.WorkflowStatus ?? detail.PlanStatus)}>
                    {detail.WorkflowStatus ?? detail.PlanStatus}
                  </span>
                </div>
              </div>

              <div className="budget-workspace__detail-grid">
                <article className="portal-module-card">
                  <h3>Budget Position</h3>
                  <div className="budget-workspace__metric-list">
                    <div>
                      <span>Requested</span>
                      <strong>{formatCurrency(detail.RequestedAmount)}</strong>
                    </div>
                    <div>
                      <span>Appropriated</span>
                      <strong>{formatCurrency(detail.Appropriated)}</strong>
                    </div>
                    <div>
                      <span>Released</span>
                      <strong>{formatCurrency(detail.Released)}</strong>
                    </div>
                    <div>
                      <span>Committed</span>
                      <strong>{formatCurrency(detail.Committed)}</strong>
                    </div>
                    <div>
                      <span>Available</span>
                      <strong>{formatCurrency(detail.Available)}</strong>
                    </div>
                    <div>
                      <span>Variance</span>
                      <strong>{formatCurrency(detail.Variance)}</strong>
                    </div>
                  </div>
                </article>

                <article className="portal-module-card">
                  <h3>APP Linkage</h3>
                  <div className="budget-workspace__metric-list">
                    <div>
                      <span>Total Budget</span>
                      <strong>{formatCurrency(detail.TotalBudget)}</strong>
                    </div>
                    <div>
                      <span>Created</span>
                      <strong>{formatDate(detail.CreatedAt)}</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{formatDateTimeShort(detail.UpdatedAt)}</strong>
                    </div>
                    <div>
                      <span>Current Stage</span>
                      <strong>{detail.CurrentStageTitle}</strong>
                    </div>
                  </div>
                  <p className="plan-muted">{detail.Notes || 'No planning note has been recorded yet.'}</p>
                </article>
              </div>

              <article className="portal-module-card">
                <h3>Budget Lines</h3>
                {detail.BudgetLines.length ? (
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>Budget Code</th>
                        <th>Items</th>
                        <th>Requested</th>
                        <th>Appropriated</th>
                        <th>Available</th>
                        <th>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.BudgetLines.map((line) => (
                        <tr key={line.BudgetCode}>
                          <td>{line.BudgetCode}</td>
                          <td>{line.ItemCount}</td>
                          <td>{formatCurrency(line.RequestedAmount)}</td>
                          <td>{formatCurrency(line.Appropriated)}</td>
                          <td>{formatCurrency(line.Available)}</td>
                          <td>{formatCurrency(line.Variance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="plan-empty">No budget-coded APP lines were found for this plan.</div>
                )}
              </article>

              <article className="portal-module-card">
                <h3>Underlying Request Details</h3>
                {detail.PlanItems.length ? (
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Budget Code</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.PlanItems.map((item) => (
                        <tr key={item.PlanItemId}>
                          <td>
                            <div>{item.Description}</div>
                            <div className="plan-muted">{item.ItemCode || 'No item code'}</div>
                          </td>
                          <td>{item.BudgetCode}</td>
                          <td>{item.ProcurementType || 'Not set'}</td>
                          <td>{item.Status}</td>
                          <td>{formatCurrency(item.EstimatedAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="plan-empty">This plan does not contain any APP items yet.</div>
                )}
              </article>

              <article className="portal-module-card">
                <h3>Routing History</h3>
                {detail.History.length ? (
                  <div className="budget-workspace__history">
                    {detail.History.map((entry) => (
                      <div key={entry.HistoryId} className="budget-workspace__history-item">
                        <strong>{entry.ToStageTitle}</strong>
                        <span>{entry.Actor || 'System'} · {formatDateTimeShort(entry.CreatedAt)}</span>
                        <span>{entry.StageStatus || toTitle(entry.ToStageKey)}</span>
                        <p>{entry.TransitionReason || 'No transition note recorded.'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="plan-empty">No workflow history is available yet.</div>
                )}
              </article>
            </>
          ) : (
            <div className="plan-empty">Select a queued plan to inspect its budget routing details.</div>
          )}
        </section>

        <aside className="budget-workspace__actions">
          <article className="portal-module-card">
            <h3>Budget Decision Panel</h3>
            <p>
              {selectedQueueItem
                ? `Review ${selectedQueueItem.PlanTitle} and record the Budget Officer decision with a clear note.`
                : 'Select a plan from the queue to activate decision controls.'}
            </p>
            <label className="plan-field">
              <span>Decision Note</span>
              <textarea
                className="plan-textarea"
                rows={8}
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                placeholder="Record affordability rationale, clarifications, or corrective instructions."
                disabled={!canTakeDecisions || !detail || isSaving}
              />
            </label>

            <div className="budget-workspace__action-stack">
              {availableDecisions.map((decision) => (
                <button
                  key={decision}
                  type="button"
                  className={decisionConfig[decision].className}
                  onClick={() => void handleDecision(decision)}
                  disabled={!canTakeDecisions || !detail || isSaving}
                >
                  {isSaving ? 'Saving...' : decisionConfig[decision].label}
                </button>
              ))}
            </div>

            {!canTakeDecisions ? (
              <div className="plan-empty">Your current role is not authorized to record budget decisions.</div>
            ) : null}
          </article>

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
        </aside>
      </div>
    </section>
  );
};
