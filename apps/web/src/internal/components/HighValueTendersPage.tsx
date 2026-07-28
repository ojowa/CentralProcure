'use client';

import { useEffect, useMemo, useState } from 'react';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import { CgisDecisionModal } from './cgis/CgisDecisionModal';
import { CgisDocumentsPanel } from './cgis/CgisDocumentsPanel';
import { applyCgisAction, fetchCgisQueue, fetchTenderDetails } from '../services/moduleService';
import {
  fetchWorkflowActionSnapshot,
  fetchWorkflowRuntime,
  fetchWorkflowRuntimeHistory
} from '../services/workflowContextService';
import type {
  CgisQueueItem,
  InternalModule,
  RoleKey,
  TenderDetail,
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../types/internal';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
  initialData?: unknown;
}

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined
    ? 'Not stated'
    : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : 'Not scheduled';

const toTitle = (value: string | null | undefined) =>
  value
    ? value
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Not stated';

export const HighValueTendersPage = ({
  module,
  token,
  role,
  userEmail,
  availableModuleIds = [],
  onModuleChange,
  initialData
}: Props) => {
  const [queue, setQueue] = useState<CgisQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState<CgisQueueItem | null>(null);
  const [selectedTender, setSelectedTender] = useState<TenderDetail | null>(null);
  const [workflowRuntime, setWorkflowRuntime] = useState<WorkflowRuntimeSnapshot | null>(null);
  const [actionSnapshot, setActionSnapshot] = useState<WorkflowActionSnapshotResponse | null>(null);
  const [history, setHistory] = useState<WorkflowRuntimeHistoryEntry[]>([]);
  const [detailError, setDetailError] = useState('');
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [rationale, setRationale] = useState('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'return' | 'escalate' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizeQueuePayload = (payload: unknown): CgisQueueItem[] => {
    const source = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { Items?: unknown[] } | null)?.Items)
        ? (payload as { Items: unknown[] }).Items
        : [];

    return source.filter((item): item is CgisQueueItem =>
      typeof item === 'object' &&
      item !== null &&
      'EntityType' in item &&
      String((item as CgisQueueItem).EntityType).toLowerCase() === 'tender');
  };

  const loadQueue = async (seedData?: unknown) => {
    if (!token) {
      setQueue([]);
      return;
    }

    setIsLoadingQueue(true);
    setQueueError('');

    try {
      const payload = seedData ?? await fetchCgisQueue(token);
      setQueue(normalizeQueuePayload(payload));
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : 'Unable to load high-value tender queue.');
      setQueue([]);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    void loadQueue(initialData);
  }, [token, initialData]);

  useEffect(() => {
    if (!token || !selectedCase) {
      setSelectedTender(null);
      setWorkflowRuntime(null);
      setActionSnapshot(null);
      setHistory([]);
      setDetailError('');
      return;
    }

    const loadDetail = async () => {
      setIsDetailLoading(true);
      setDetailError('');

      try {
        const [tender, runtime, actions, runtimeHistory] = await Promise.all([
          fetchTenderDetails(selectedCase.EntityId, token),
          fetchWorkflowRuntime(token, 'tender', selectedCase.EntityId),
          fetchWorkflowActionSnapshot(token, 'tender', selectedCase.EntityId),
          fetchWorkflowRuntimeHistory(token, 'tender', selectedCase.EntityId)
        ]);

        setSelectedTender(tender as TenderDetail);
        setWorkflowRuntime(runtime);
        setActionSnapshot(actions);
        setHistory(runtimeHistory);
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : 'Unable to load tender review context.');
      } finally {
        setIsDetailLoading(false);
      }
    };

    void loadDetail();
  }, [selectedCase, token]);

  const filteredQueue = useMemo(() => {
    const query = search.trim().toLowerCase();

    return queue.filter((item) => {
      const matchesStatus = statusFilter === 'all'
        || (item.Status ?? 'Pending').toLowerCase() === statusFilter.toLowerCase();
      const haystack = [
        item.RecordTitle,
        item.Department,
        item.ApprovalRoute,
        item.ApprovalAuthorityLabel,
        item.VendorName,
        item.EntityId
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [queue, search, statusFilter]);

  const summary = useMemo(() => ({
    total: queue.length,
    pending: queue.filter((item) => !item.Status || item.Status.toLowerCase() === 'under review').length,
    escalated: queue.filter((item) => item.ApprovalRoute?.toLowerCase().includes('bpp')).length,
    urgent: queue.filter((item) => item.DaysPending >= 5).length
  }), [queue]);

  const grantedActionKeys = actionSnapshot?.Actions?.map((action) => action.ActionKey.toLowerCase()) ?? [];
  const canApprove = grantedActionKeys.includes('cgis.approve');
  const canReject = grantedActionKeys.includes('cgis.reject');
  const canReturn = grantedActionKeys.includes('cgis.return');
  const canEscalate = grantedActionKeys.includes('cgis.escalate');
  const canCreateBpp = grantedActionKeys.includes('bpp.create') && availableModuleIds.includes('bpp-escalation');
  const canOpenAwardWorkspace = availableModuleIds.includes('contract-award');
  const activeFilterCount = (search.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const submitAction = async () => {
    if (!token || !selectedCase || !pendingAction || !rationale.trim()) {
      return;
    }

    setIsSubmitting(true);
    setDetailError('');

    try {
      await applyCgisAction(
        pendingAction,
        {
          EntityType: selectedCase.EntityType,
          EntityId: selectedCase.EntityId,
          Rationale: rationale.trim(),
          Actor: userEmail
        },
        token
      );

      setPendingAction(null);
      setRationale('');
      setSelectedCase(null);
      await loadQueue();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Unable to record CGIS decision.');
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
          {role ? <p className="app-muted">Current authority: {toTitle(role)}</p> : null}
        </div>
        <button className="app-btn app-btn--secondary" onClick={() => void loadQueue()} disabled={!token || isLoadingQueue}>
          {isLoadingQueue ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </header>

      {!token ? <div className="app-alert app-alert--error">Authentication token is missing.</div> : null}
      {queueError ? <div className="app-alert app-alert--error">{queueError}</div> : null}

      {selectedCase ? (
        <div className="app-detail-view">
          <div className="app-entity-header">
            <button
              className="app-entity-header__back"
              onClick={() => {
                setSelectedCase(null);
                setSelectedTender(null);
                setWorkflowRuntime(null);
                setActionSnapshot(null);
                setHistory([]);
                setDetailError('');
              }}
            >
              Back to Queue
            </button>
            <div className="app-entity-header__info">
              <h2 className="app-entity-header__title">{selectedCase.RecordTitle || 'Untitled Tender'}</h2>
              <div className="app-entity-header__meta">
                <span className="app-entity-header__badge">{selectedCase.EntityId}</span>
                <span className="app-entity-header__badge app-entity-header__badge--secondary">
                  {selectedCase.ApprovalAuthorityLabel || 'CGIS Review'}
                </span>
              </div>
            </div>
          </div>

          {detailError ? <div className="app-alert app-alert--error">{detailError}</div> : null}

          <div className={`app-status-banner ${selectedCase.ApprovalRoute?.toLowerCase().includes('bpp') ? 'app-status-banner--warning' : 'app-status-banner--info'}`}>
            {selectedCase.ApprovalRoute?.toLowerCase().includes('bpp')
              ? 'This case sits on a threshold route that may still require BPP no-objection after executive review.'
              : 'This case is in the CGIS approval lane for executive threshold review before award publication.'}
          </div>

          <div className="app-stats-grid app-stats-grid--3">
            <div className="app-stat-card app-stat-card--info">
              <span className="app-stat-card__label">Department</span>
              <strong className="app-stat-card__value">{selectedCase.Department || 'Not stated'}</strong>
            </div>
            <div className="app-stat-card app-stat-card--success">
              <span className="app-stat-card__label">Tender Value</span>
              <strong className="app-stat-card__value">{formatCurrency(selectedCase.Amount)}</strong>
            </div>
            <div className={`app-stat-card ${selectedCase.DaysPending >= 5 ? 'app-stat-card--danger' : 'app-stat-card--warning'}`}>
              <span className="app-stat-card__label">Days Pending</span>
              <strong className="app-stat-card__value">{selectedCase.DaysPending}</strong>
            </div>
          </div>

          {isDetailLoading ? (
            <div className="app-loading-spinner">Loading tender review context...</div>
          ) : (
            <>
              {workflowRuntime ? (
                <div className="app-card">
                  <div className="app-card__header">
                    <h3 className="app-card__title">Workflow Position</h3>
                  </div>
                  <div className="app-card__body">
                    <WorkflowProgressStepper
                      currentStageKey={workflowRuntime.CurrentStageKey}
                      display={workflowRuntime.Display ?? null}
                    />
                    <p className="app-status-banner app-status-banner--info">
                      Current stage: {workflowRuntime.CurrentStageTitle}. Route: {actionSnapshot?.RouteDecision?.ApprovalRoute || selectedCase.ApprovalRoute || 'Not resolved'}.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Tender Summary</h3>
                </div>
                <div className="app-card__body">
                  <div className="portal-module-grid">
                    <article className="portal-module-card">
                      <h3>Category</h3>
                      <p>{selectedTender?.Category || 'Not stated'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Vendor</h3>
                      <p>{selectedCase.VendorName || 'Recommended bid not yet attached'}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Publish / Close</h3>
                      <p>{formatDate(selectedTender?.PublishedAt)} / {formatDate(selectedTender?.ClosingDate)}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Authority Route</h3>
                      <p>{actionSnapshot?.RouteDecision?.ApprovalAuthorityLabel || selectedCase.ApprovalAuthorityLabel || 'CGIS'}</p>
                    </article>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <p><strong>Description:</strong> {selectedTender?.Description || 'No tender description available.'}</p>
                    <p><strong>Specifications:</strong> {selectedTender?.Requirements || 'No technical specification uploaded.'}</p>
                    <p><strong>Eligibility:</strong> {selectedTender?.EligibilityCriteria || 'No eligibility criteria recorded.'}</p>
                    <p><strong>Evaluation:</strong> {selectedTender?.EvaluationCriteria || 'No evaluation criteria recorded.'}</p>
                  </div>
                </div>
              </div>

              <CgisDocumentsPanel entityType="tender" entityId={selectedCase.EntityId} token={token ?? null} />

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Decision History</h3>
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

              <div className="app-card app-card--highlight">
                <div className="app-card__header">
                  <h3 className="app-card__title">CGIS Decision</h3>
                  <p className="app-card__description">All executive decisions require a rationale and are written into workflow history.</p>
                </div>
                <div className="app-card__body">
                  <div className="app-form-group">
                    <label className="app-form-label" htmlFor="high-value-tender-rationale">
                      Rationale
                    </label>
                    <textarea
                      id="high-value-tender-rationale"
                      className="app-textarea"
                      rows={4}
                      value={rationale}
                      onChange={(event) => setRationale(event.target.value)}
                      placeholder="Record the commercial, legal, and governance basis for your decision."
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="app-action-group app-action-group--grid">
                    <button className="app-btn app-btn--success" disabled={!canApprove || !rationale.trim() || isSubmitting} onClick={() => setPendingAction('approve')}>
                      Approve Award
                    </button>
                    <button className="app-btn app-btn--danger" disabled={!canReject || !rationale.trim() || isSubmitting} onClick={() => setPendingAction('reject')}>
                      Reject Award
                    </button>
                    <button className="app-btn app-btn--secondary" disabled={!canReturn || !rationale.trim() || isSubmitting} onClick={() => setPendingAction('return')}>
                      Return for Clarification
                    </button>
                    <button className="app-btn app-btn--secondary" disabled={!canEscalate || !rationale.trim() || isSubmitting} onClick={() => setPendingAction('escalate')}>
                      Escalate to Board
                    </button>
                  </div>
                  {!canApprove && !canReject && !canReturn && !canEscalate ? (
                    <p className="app-muted" style={{ marginTop: 12 }}>
                      Decision controls are unavailable for your current granted actions on this tender.
                    </p>
                  ) : null}
                  {canCreateBpp ? (
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
                  ) : canOpenAwardWorkspace ? (
                    <div style={{ marginTop: 12 }}>
                      <button className="app-btn app-btn--secondary" onClick={() => onModuleChange?.('contract-award')}>
                        Open Contract Award Workspace
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="app-stats-grid app-stats-grid--4">
            <div className="app-stat-card app-stat-card--info">
              <span className="app-stat-card__label">Tender cases</span>
              <strong className="app-stat-card__value">{summary.total}</strong>
            </div>
            <div className="app-stat-card app-stat-card--success">
              <span className="app-stat-card__label">Pending review</span>
              <strong className="app-stat-card__value">{summary.pending}</strong>
            </div>
            <div className="app-stat-card app-stat-card--warning">
              <span className="app-stat-card__label">BPP-route cases</span>
              <strong className="app-stat-card__value">{summary.escalated}</strong>
            </div>
            <div className="app-stat-card">
              <span className="app-stat-card__label">Aged beyond 5 days</span>
              <strong className="app-stat-card__value">{summary.urgent}</strong>
            </div>
          </div>

          <div className="app-status-banner app-status-banner--info">
            Review threshold-routed tenders here before recording the CGIS decision. Use the queue to separate direct executive approvals from cases likely to progress into BPP handling.
          </div>

          <div className="app-card">
            <div className="app-card__body" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}>
              <input
                className="plan-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, department, vendor, route, or tender id"
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
                    setSearch('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          </div>

          <p className="app-muted">
            Showing {filteredQueue.length} of {queue.length} high-value tender cases{activeFilterCount > 0 ? ' with active filters applied' : ''}.
          </p>

          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Department</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Route</th>
                  <th>Pending</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingQueue ? (
                  <tr>
                    <td colSpan={7} className="app-table__empty">Loading high-value tenders...</td>
                  </tr>
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="app-table__empty">No high-value tender cases matched the current filters.</td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => (
                    <tr key={item.InstanceId}>
                      <td>
                        <div className="app-case-info">
                          <span className="app-case-info__id">{item.EntityId.slice(0, 8)}...</span>
                          <span className="app-case-info__title">{item.RecordTitle || 'Untitled Tender'}</span>
                        </div>
                      </td>
                      <td>{item.Department || 'Not stated'}</td>
                      <td>{item.VendorName || 'Pending recommendation'}</td>
                      <td className="app-table__cell--numeric">{formatCurrency(item.Amount)}</td>
                      <td>{toTitle(item.ApprovalRoute)}</td>
                      <td>{item.DaysPending}d</td>
                      <td>
                        <button className="app-btn app-btn--sm" onClick={() => setSelectedCase(item)}>
                          Review
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

      {pendingAction && selectedCase ? (
        <CgisDecisionModal
          action={pendingAction}
          recordTitle={selectedCase.RecordTitle || 'Untitled Tender'}
          rationale={rationale}
          error={detailError || null}
          isProcessing={isSubmitting}
          onConfirm={() => void submitAction()}
          onCancel={() => setPendingAction(null)}
        />
      ) : null}
    </section>
  );
};
