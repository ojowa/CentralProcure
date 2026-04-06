'use client';

import { useEffect, useMemo, useState } from 'react';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import { CgisDocumentsPanel } from './cgis/CgisDocumentsPanel';
import { fetchTenderDetails } from '../services/moduleService';
import { fetchEvaluationReportDetail } from '../services/evaluationReportService';
import {
  applyTendersBoardDecision,
  fetchTendersBoardQueue
} from '../services/tendersBoardApprovalService';
import {
  fetchWorkflowActionSnapshot,
  fetchWorkflowRuntime,
  fetchWorkflowRuntimeHistory
} from '../services/workflowContextService';
import type {
  EvaluationReportItem,
  InternalModule,
  RoleKey,
  TenderDetail,
  TendersBoardQueueItem,
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../types/internal';

type WorkspaceMode = 'review' | 'decision';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
  initialData?: unknown;
  mode: WorkspaceMode;
}

const formatCurrency = (value: number | null | undefined) =>
  value == null
    ? 'Not stated'
    : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const formatDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString() : 'Not scheduled');

const toTitle = (value: string | null | undefined) =>
  value
    ? value
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Not stated';

export const TendersBoardWorkspacePage = ({
  module,
  token,
  role,
  userEmail,
  availableModuleIds = [],
  onModuleChange,
  initialData,
  mode
}: Props) => {
  const [queue, setQueue] = useState<TendersBoardQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TendersBoardQueueItem | null>(null);
  const [selectedTender, setSelectedTender] = useState<TenderDetail | null>(null);
  const [selectedReport, setSelectedReport] = useState<EvaluationReportItem | null>(null);
  const [workflowRuntime, setWorkflowRuntime] = useState<WorkflowRuntimeSnapshot | null>(null);
  const [workflowActions, setWorkflowActions] = useState<WorkflowActionSnapshotResponse | null>(null);
  const [history, setHistory] = useState<WorkflowRuntimeHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rationale, setRationale] = useState('');
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seedQueue = (payload: unknown): TendersBoardQueueItem[] =>
    Array.isArray(payload)
      ? payload as TendersBoardQueueItem[]
      : Array.isArray((payload as { Items?: unknown[] } | null)?.Items)
        ? ((payload as { Items: TendersBoardQueueItem[] }).Items ?? [])
        : [];

  const loadQueue = async (seedData?: unknown) => {
    if (!token) {
      setQueue([]);
      return;
    }

    setIsListLoading(true);
    setError(null);
    try {
      if (seedData !== undefined) {
        setQueue(seedQueue(seedData));
      } else {
        setQueue(await fetchTendersBoardQueue(token));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Tenders Board queue.');
      setQueue([]);
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue(initialData);
  }, [token, initialData]);

  useEffect(() => {
    if (!token || !selectedItem) {
      setSelectedTender(null);
      setSelectedReport(null);
      setWorkflowRuntime(null);
      setWorkflowActions(null);
      setHistory([]);
      return;
    }

    const loadDetail = async () => {
      setIsDetailLoading(true);
      setError(null);
      try {
        const [tender, runtime, actions, runtimeHistory, report] = await Promise.all([
          fetchTenderDetails(selectedItem.TenderId, token),
          fetchWorkflowRuntime(token, 'tender', selectedItem.TenderId),
          fetchWorkflowActionSnapshot(token, 'tender', selectedItem.TenderId),
          fetchWorkflowRuntimeHistory(token, 'tender', selectedItem.TenderId),
          selectedItem.ReportCode ? fetchEvaluationReportDetail(token, selectedItem.ReportCode) : Promise.resolve(null)
        ]);

        setSelectedTender(tender as TenderDetail);
        setWorkflowRuntime(runtime);
        setWorkflowActions(actions);
        setHistory(runtimeHistory);
        setSelectedReport(report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load Tenders Board review detail.');
      } finally {
        setIsDetailLoading(false);
      }
    };

    void loadDetail();
  }, [selectedItem, token]);

  const filteredQueue = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return queue.filter((item) => {
      const matchesStatus = statusFilter === 'all' || (item.Status ?? '').toLowerCase() === statusFilter.toLowerCase();
      const haystack = [
        item.TenderTitle,
        item.Department,
        item.VendorName,
        item.ReportCode,
        item.Recommendation,
        item.ScoreSummary,
        item.TenderId
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [queue, query, statusFilter]);

  const summary = useMemo(() => ({
    total: queue.length,
    bpp: queue.filter((item) => item.RequiresBpp).length,
    dueReview: queue.filter((item) => item.DaysPending >= 5).length,
    directAward: queue.filter((item) => !item.RequiresBpp).length
  }), [queue]);

  const canDecide = mode === 'decision' &&
    (workflowActions?.Actions?.some((action) => action.ActionKey.toLowerCase() === 'approval.decide') ?? false);
  const canCreateBpp = availableModuleIds.includes('bpp-escalation');
  const canOpenAwardWorkspace = availableModuleIds.includes('contract-award');
  const activeFilterCount = (query.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const handleDecision = async (action: 'approve' | 'reject' | 'return') => {
    if (!token || !selectedItem || !rationale.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await applyTendersBoardDecision(token, action, selectedItem.TenderId, rationale.trim(), userEmail);
      setRationale('');
      setSelectedItem(null);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record Tenders Board decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
          {role ? <p className="app-muted">Current role: {toTitle(role)}</p> : null}
        </div>
        <button className="app-btn app-btn--secondary" onClick={() => void loadQueue()} disabled={!token || isListLoading}>
          {isListLoading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </header>

      {error ? <div className="app-alert app-alert--error">{error}</div> : null}

      {selectedItem ? (
        <div className="app-detail-view">
          <div className="app-entity-header">
            <button className="app-entity-header__back" onClick={() => setSelectedItem(null)}>
              Back to Board Queue
            </button>
            <div className="app-entity-header__info">
              <h2 className="app-entity-header__title">{selectedItem.TenderTitle}</h2>
              <div className="app-entity-header__meta">
                <span className="app-entity-header__badge">{selectedItem.TenderId}</span>
                <span className="app-entity-header__badge app-entity-header__badge--secondary">
                  {selectedItem.RequiresBpp ? 'Board + BPP Route' : 'Board Final Route'}
                </span>
              </div>
            </div>
          </div>

          {isDetailLoading ? (
            <div className="app-loading-spinner">Loading Tenders Board review detail...</div>
          ) : (
            <>
              {workflowRuntime ? (
                <div className="app-card">
                  <div className="app-card__header">
                    <h3 className="app-card__title">Workflow Position</h3>
                  </div>
                  <div className="app-card__body">
                    <WorkflowProgressStepper currentStageKey={workflowRuntime.CurrentStageKey} display={workflowRuntime.Display ?? null} />
                    <p className="app-status-banner app-status-banner--info">
                      Current stage: {workflowRuntime.CurrentStageTitle}. Approval route: {selectedItem.ApprovalRoute || 'Not resolved'}.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className={`app-status-banner ${selectedItem.RequiresBpp ? 'app-status-banner--warning' : 'app-status-banner--success'}`}>
                {selectedItem.RequiresBpp
                  ? 'Board approval here is not the final award. This case must be endorsed onward to BPP before publication.'
                  : 'Board approval here is the final approval step before award publication and contract award preparation.'}
              </div>

              <div className="app-stats-grid app-stats-grid--4">
                <div className="app-stat-card app-stat-card--info">
                  <span className="app-stat-card__label">Tender amount</span>
                  <strong className="app-stat-card__value">{formatCurrency(selectedItem.Amount)}</strong>
                </div>
                <div className="app-stat-card">
                  <span className="app-stat-card__label">Recommended vendor</span>
                  <strong className="app-stat-card__value">{selectedItem.VendorName || 'Pending'}</strong>
                </div>
                <div className="app-stat-card app-stat-card--success">
                  <span className="app-stat-card__label">Evaluation report</span>
                  <strong className="app-stat-card__value">{selectedItem.ReportCode || 'Not linked'}</strong>
                </div>
                <div className={`app-stat-card ${selectedItem.DaysPending >= 5 ? 'app-stat-card--danger' : 'app-stat-card--warning'}`}>
                  <span className="app-stat-card__label">Days pending</span>
                  <strong className="app-stat-card__value">{selectedItem.DaysPending}</strong>
                </div>
              </div>

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Tender Submission</h3>
                </div>
                <div className="app-card__body">
                  <div className="portal-module-grid">
                    <article className="portal-module-card">
                      <h3>Department</h3>
                      <p>{selectedItem.Department || 'Not stated'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Procurement Type</h3>
                      <p>{selectedItem.ProcurementType || selectedTender?.Category || 'Not stated'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Publish / Close</h3>
                      <p>{formatDate(selectedTender?.PublishDate)} / {formatDate(selectedTender?.ClosingDate)}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Authority Label</h3>
                      <p>{selectedItem.ApprovalAuthorityLabel || 'NIS Tenders Board'}</p>
                    </article>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <p><strong>Description:</strong> {selectedTender?.Description || 'No tender description available.'}</p>
                    <p><strong>Specifications:</strong> {selectedTender?.Specifications || 'No technical specification uploaded.'}</p>
                    <p><strong>Eligibility:</strong> {selectedTender?.EligibilityCriteria || 'No eligibility criteria recorded.'}</p>
                    <p><strong>Evaluation Criteria:</strong> {selectedTender?.EvaluationCriteria || 'No evaluation criteria recorded.'}</p>
                  </div>
                </div>
              </div>

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Evaluation Recommendation</h3>
                </div>
                <div className="app-card__body">
                  <div className="portal-module-grid">
                    <article className="portal-module-card">
                      <h3>Recommendation</h3>
                      <p>{selectedItem.Recommendation || selectedReport?.Recommendation || 'Not stated'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Score Summary</h3>
                      <p>{selectedItem.ScoreSummary || selectedReport?.ScoreSummary || 'No score summary available.'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Committee Lead</h3>
                      <p>{selectedReport?.CommitteeLead || 'Not stated'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Submitted</h3>
                      <p>{formatDate(selectedItem.ReportSubmittedAt || selectedReport?.SubmittedAt)}</p>
                    </article>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <p><strong>Committee Notes:</strong> {selectedReport?.Notes || 'No evaluation notes were returned.'}</p>
                  </div>
                </div>
              </div>

              <CgisDocumentsPanel entityType="tender" entityId={selectedItem.TenderId} token={token ?? null} />

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Workflow History</h3>
                </div>
                <div className="app-card__body">
                  {history.length === 0 ? (
                    <div className="app-empty-state app-empty-state--small">
                      <p>No workflow history was returned for this tender.</p>
                    </div>
                  ) : (
                    <div className="app-table-wrapper">
                      <table className="app-table app-table--compact">
                        <thead>
                          <tr>
                            <th>Stage</th>
                            <th>Status</th>
                            <th>Actor</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.slice(0, 6).map((entry) => (
                            <tr key={entry.HistoryId}>
                              <td>{entry.ToStageTitle}</td>
                              <td>{entry.StageStatus || 'Recorded'}</td>
                              <td>{entry.Actor || 'System'}</td>
                              <td>{formatDate(entry.CreatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {mode === 'decision' ? (
                <div className="app-card app-card--highlight">
                  <div className="app-card__header">
                    <h3 className="app-card__title">Board Decision</h3>
                    <p className="app-card__description">
                      Approval moves the case to {selectedItem.RequiresBpp ? 'BPP no-objection' : 'award publication'} based on threshold routing.
                    </p>
                  </div>
                  <div className="app-card__body">
                    <div className="app-form-group">
                      <label className="app-form-label" htmlFor="board-rationale">Rationale</label>
                      <textarea
                        id="board-rationale"
                        className="app-textarea"
                        rows={4}
                        value={rationale}
                        onChange={(event) => setRationale(event.target.value)}
                        placeholder="Record the board's decision basis, conditions, or return note."
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="app-action-group app-action-group--grid">
                      <button className="app-btn app-btn--success" disabled={!canDecide || !rationale.trim() || isSubmitting} onClick={() => void handleDecision('approve')}>
                        {selectedItem.RequiresBpp ? 'Endorse to BPP' : 'Approve Award'}
                      </button>
                      <button className="app-btn app-btn--danger" disabled={!canDecide || !rationale.trim() || isSubmitting} onClick={() => void handleDecision('reject')}>
                        Reject Recommendation
                      </button>
                      <button className="app-btn app-btn--secondary" disabled={!canDecide || !rationale.trim() || isSubmitting} onClick={() => void handleDecision('return')}>
                        Return to Evaluation
                      </button>
                    </div>
                    {!canDecide ? (
                      <p className="app-muted" style={{ marginTop: 12 }}>
                        Decision controls are unavailable for your current granted actions on this tender.
                      </p>
                    ) : null}
                    {selectedItem.RequiresBpp && canCreateBpp ? (
                      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button className="app-btn app-btn--secondary" onClick={() => onModuleChange?.('bpp-escalation')}>
                          Open BPP Escalation Workspace
                        </button>
                        {canOpenAwardWorkspace ? (
                          <button className="app-btn app-btn--secondary" onClick={() => onModuleChange?.('contract-award')}>
                            Open Contract Award Workspace
                          </button>
                        ) : null}
                      </div>
                    ) : canOpenAwardWorkspace && !selectedItem.RequiresBpp ? (
                      <div style={{ marginTop: 12 }}>
                        <button className="app-btn app-btn--secondary" onClick={() => onModuleChange?.('contract-award')}>
                          Open Contract Award Workspace
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="app-stats-grid app-stats-grid--4">
            <div className="app-stat-card app-stat-card--info">
              <span className="app-stat-card__label">Board cases</span>
              <strong className="app-stat-card__value">{summary.total}</strong>
            </div>
            <div className="app-stat-card app-stat-card--success">
              <span className="app-stat-card__label">Direct award route</span>
              <strong className="app-stat-card__value">{summary.directAward}</strong>
            </div>
            <div className="app-stat-card app-stat-card--warning">
              <span className="app-stat-card__label">BPP route</span>
              <strong className="app-stat-card__value">{summary.bpp}</strong>
            </div>
            <div className="app-stat-card">
              <span className="app-stat-card__label">Over 5 days pending</span>
              <strong className="app-stat-card__value">{summary.dueReview}</strong>
            </div>
          </div>

          <div className={`app-status-banner ${mode === 'decision' ? 'app-status-banner--warning' : 'app-status-banner--info'}`}>
            {mode === 'decision'
              ? 'Use this workspace to record the formal Tenders Board decision. Threshold routing will determine whether approval goes to award publication or onward to BPP.'
              : 'Use this workspace to inspect evaluation recommendations, procurement context, and supporting documents before any formal board decision is recorded.'}
          </div>

          <div className="app-card">
            <div className="app-card__body" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}>
              <input
                className="plan-input"
                placeholder="Search tender, vendor, report code, department, or recommendation"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select className="plan-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="under review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="app-btn app-btn--secondary"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          </div>

          <p className="app-muted">
            Showing {filteredQueue.length} of {queue.length} board-routed tenders{activeFilterCount > 0 ? ' with active filters applied' : ''}.
          </p>

          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Recommendation</th>
                  <th>Route</th>
                  <th>Pending</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isListLoading ? (
                  <tr>
                    <td colSpan={7} className="app-table__empty">Loading Tenders Board queue...</td>
                  </tr>
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="app-table__empty">No board-routed tenders matched the current filters.</td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => (
                    <tr key={item.InstanceId}>
                      <td>
                        <div className="app-case-info">
                          <span className="app-case-info__id">{item.ReportCode || item.TenderId.slice(0, 8)}</span>
                          <span className="app-case-info__title">{item.TenderTitle}</span>
                        </div>
                      </td>
                      <td>{item.VendorName || 'Pending recommendation'}</td>
                      <td className="app-table__cell--numeric">{formatCurrency(item.Amount)}</td>
                      <td>{item.Recommendation || 'Not stated'}</td>
                      <td>{item.RequiresBpp ? 'Board + BPP' : 'Board Final'}</td>
                      <td>{item.DaysPending}d</td>
                      <td>
                        <button className="app-btn app-btn--sm" onClick={() => setSelectedItem(item)}>
                          {mode === 'decision' ? 'Decide' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
