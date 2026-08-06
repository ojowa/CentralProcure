'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ContractAwardItem,
  InternalModule,
  RoleKey,
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../../types/internal';
import {
  fetchContractAwardDetail,
  fetchContractAwards,
  publishContractAward
} from '../../services/contractAwardService';
import {
  fetchWorkflowActionSnapshot,
  fetchWorkflowRuntime,
  fetchWorkflowRuntimeHistory
} from '../../services/workflowContextService';
import { WorkflowProgressStepper } from '../shared/WorkflowProgressStepper';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: RoleKey | null;
  initialData?: unknown;
  onModuleChange?: (moduleId: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : 'Not scheduled');

const toTitle = (value: string | null | undefined) =>
  value
    ? value
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Not stated';

export const ContractAwardModule = ({ module, token, role, initialData, onModuleChange }: Props) => {
  const [awards, setAwards] = useState<ContractAwardItem[]>([]);
  const [selectedAward, setSelectedAward] = useState<ContractAwardItem | null>(null);
  const [detail, setDetail] = useState<ContractAwardItem | null>(null);
  const [runtime, setRuntime] = useState<WorkflowRuntimeSnapshot | null>(null);
  const [actions, setActions] = useState<WorkflowActionSnapshotResponse | null>(null);
  const [history, setHistory] = useState<WorkflowRuntimeHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeSeedData = (payload: unknown): ContractAwardItem[] =>
    Array.isArray(payload)
      ? payload as ContractAwardItem[]
      : Array.isArray((payload as { Items?: unknown[] } | null)?.Items)
        ? ((payload as { Items: ContractAwardItem[] }).Items ?? [])
        : [];

  const loadAwards = async (seedData?: unknown) => {
    if (!token) {
      setAwards([]);
      return;
    }

    setIsLoadingList(true);
    setError(null);
    try {
      if (seedData !== undefined) {
        setAwards(normalizeSeedData(seedData));
      } else {
        const result = await fetchContractAwards(token);
        setAwards(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load contract awards.');
      setAwards([]);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    void loadAwards(initialData);
  }, [token, initialData]);

  useEffect(() => {
    if (!token || !selectedAward) {
      setDetail(null);
      setRuntime(null);
      setActions(null);
      setHistory([]);
      return;
    }

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      setError(null);
      try {
        const [awardDetail, workflowRuntime, workflowActions, workflowHistory] = await Promise.all([
          fetchContractAwardDetail(token, selectedAward.AwardId),
          fetchWorkflowRuntime(token, 'contract_award', selectedAward.AwardEntityId),
          fetchWorkflowActionSnapshot(token, 'contract_award', selectedAward.AwardEntityId),
          fetchWorkflowRuntimeHistory(token, 'contract_award', selectedAward.AwardEntityId)
        ]);

        setDetail(awardDetail);
        setRuntime(workflowRuntime);
        setActions(workflowActions);
        setHistory(workflowHistory);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load contract award detail.');
      } finally {
        setIsLoadingDetail(false);
      }
    };

    void loadDetail();
  }, [selectedAward, token]);

  const filteredAwards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return awards.filter((award) => {
      const matchesStatus = statusFilter === 'all' || award.Status.toLowerCase() === statusFilter.toLowerCase();
      const haystack = `${award.AwardId} ${award.TenderTitle} ${award.VendorName} ${award.FundingSource}`.toLowerCase();
      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [awards, query, statusFilter]);

  const summary = useMemo(() => ({
    total: awards.length,
    ready: awards.filter((award) => award.Status.toLowerCase() !== 'published').length,
    published: awards.filter((award) => award.Status.toLowerCase() === 'published').length,
    thisMonth: awards.filter((award) => {
      const awardDate = new Date(award.AwardDate);
      const now = new Date();
      return awardDate.getMonth() === now.getMonth() && awardDate.getFullYear() === now.getFullYear();
    }).length
  }), [awards]);

  const canPublish = actions?.Actions?.some((action) => action.ActionKey.toLowerCase() === 'contract_award.publish') ?? false;
  const canViewContracts = true;
  const activeFilterCount = (query.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const handlePublish = async () => {
    if (!token || !selectedAward) {
      return;
    }

    setIsPublishing(true);
    setError(null);
    try {
      const updated = await publishContractAward(token, selectedAward.AwardId);
      setDetail(updated);
      setSelectedAward(updated);
      await loadAwards();

      const [workflowRuntime, workflowActions, workflowHistory] = await Promise.all([
        fetchWorkflowRuntime(token, 'contract_award', updated.AwardEntityId),
        fetchWorkflowActionSnapshot(token, 'contract_award', updated.AwardEntityId),
        fetchWorkflowRuntimeHistory(token, 'contract_award', updated.AwardEntityId)
      ]);
      setRuntime(workflowRuntime);
      setActions(workflowActions);
      setHistory(workflowHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish contract award.');
    } finally {
      setIsPublishing(false);
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
        <button className="app-btn app-btn--secondary" onClick={() => void loadAwards()} disabled={!token || isLoadingList}>
          {isLoadingList ? 'Refreshing...' : 'Refresh Awards'}
        </button>
      </header>

      {error ? <div className="app-alert app-alert--error">{error}</div> : null}

      {selectedAward ? (
        <div className="app-detail-view">
          <div className="app-entity-header">
            <button className="app-entity-header__back" onClick={() => setSelectedAward(null)}>
              Back to Award Register
            </button>
            <div className="app-entity-header__info">
              <h2 className="app-entity-header__title">{selectedAward.TenderTitle}</h2>
              <div className="app-entity-header__meta">
                <span className="app-entity-header__badge">{selectedAward.AwardId}</span>
                <span className="app-entity-header__badge app-entity-header__badge--secondary">{selectedAward.Status}</span>
              </div>
            </div>
          </div>

          {isLoadingDetail ? (
            <div className="app-loading-spinner">Loading award publication context...</div>
          ) : detail ? (
            <>
              <div className={`app-status-banner ${detail.Status.toLowerCase() === 'published' ? 'app-status-banner--success' : canPublish ? 'app-status-banner--info' : 'app-status-banner--warning'}`}>
                {detail.Status.toLowerCase() === 'published'
                  ? 'This award notice has already been published and is ready for downstream contract management.'
                  : canPublish
                    ? 'This award is ready for publication, subject to the workflow controls shown below.'
                    : 'Publication is currently unavailable for your granted actions or the award is not yet in a publishable state.'}
              </div>

              <div className="app-stats-grid app-stats-grid--4">
                <div className="app-stat-card app-stat-card--info">
                  <span className="app-stat-card__label">Award value</span>
                  <strong className="app-stat-card__value">{formatCurrency(detail.AwardValue)}</strong>
                </div>
                <div className="app-stat-card app-stat-card--success">
                  <span className="app-stat-card__label">Vendor</span>
                  <strong className="app-stat-card__value">{detail.VendorName}</strong>
                </div>
                <div className="app-stat-card">
                  <span className="app-stat-card__label">Award date</span>
                  <strong className="app-stat-card__value">{formatDate(detail.AwardDate)}</strong>
                </div>
                <div className="app-stat-card">
                  <span className="app-stat-card__label">Contract start</span>
                  <strong className="app-stat-card__value">{formatDate(detail.ContractStart)}</strong>
                </div>
              </div>

              {runtime ? (
                <div className="app-card">
                  <div className="app-card__header">
                    <h3 className="app-card__title">Workflow Position</h3>
                  </div>
                  <div className="app-card__body">
                    <WorkflowProgressStepper currentStageKey={runtime.CurrentStageKey} display={runtime.Display ?? null} />
                    <p className="app-status-banner app-status-banner--info">
                      Current stage: {runtime.CurrentStageTitle}. Status: {runtime.CurrentStatus || detail.Status}.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Award Notice Summary</h3>
                </div>
                <div className="app-card__body">
                  <div className="portal-module-grid">
                    <article className="portal-module-card">
                      <h3>Award Code</h3>
                      <p>{detail.AwardId}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Funding Source</h3>
                      <p>{detail.FundingSource}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Contract End</h3>
                      <p>{formatDate(detail.ContractEnd)}</p>
                    </article>
                    <article className="portal-module-card">
                      <h3>Granted Actions</h3>
                      <p>{actions?.Actions?.map((action) => action.ActionKey).join(', ') || 'None'}</p>
                    </article>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <p><strong>Notes:</strong> {detail.Notes || 'No publication note recorded.'}</p>
                  </div>
                </div>
              </div>

              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Workflow History</h3>
                </div>
                <div className="app-card__body">
                  {history.length === 0 ? (
                    <div className="app-empty-state app-empty-state--small">
                      <p>No workflow history has been recorded for this award.</p>
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
                  <h3 className="app-card__title">Publication Control</h3>
                  <p className="app-card__description">Award publication should only happen after all upstream approvals and no-objection gates are complete.</p>
                </div>
                <div className="app-card__body">
                  <div className="app-action-group">
                    <button
                      className="app-btn app-btn--success"
                      disabled={!canPublish || isPublishing || detail.Status.toLowerCase() === 'published'}
                      onClick={() => void handlePublish()}
                    >
                      {isPublishing ? 'Publishing...' : detail.Status.toLowerCase() === 'published' ? 'Award Published' : 'Publish Award Notice'}
                    </button>
                    {canViewContracts ? (
                      <button className="app-btn app-btn--secondary" onClick={() => onModuleChange?.('contract-management')}>
                        Open Contract Management
                      </button>
                    ) : null}
                  </div>
                  {!canPublish && detail.Status.toLowerCase() !== 'published' ? (
                    <p className="app-muted" style={{ marginTop: 12 }}>
                      Publication is blocked until the workflow grants the `contract_award.publish` action for this award.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="app-stats-grid app-stats-grid--4">
            <div className="app-stat-card app-stat-card--info">
              <span className="app-stat-card__label">Awards</span>
              <strong className="app-stat-card__value">{summary.total}</strong>
            </div>
            <div className="app-stat-card app-stat-card--warning">
              <span className="app-stat-card__label">Ready to publish</span>
              <strong className="app-stat-card__value">{summary.ready}</strong>
            </div>
            <div className="app-stat-card app-stat-card--success">
              <span className="app-stat-card__label">Published</span>
              <strong className="app-stat-card__value">{summary.published}</strong>
            </div>
            <div className="app-stat-card">
              <span className="app-stat-card__label">Awarded this month</span>
              <strong className="app-stat-card__value">{summary.thisMonth}</strong>
            </div>
          </div>

          <div className="app-status-banner app-status-banner--info">
            Use this register to confirm which awards are still awaiting publication and which ones have already progressed into the post-award phase.
          </div>

          <div className="app-card">
            <div className="app-card__body grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
              <input
                className="plan-input"
                placeholder="Search award code, tender title, vendor, or funding source"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select className="plan-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
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
            Showing {filteredAwards.length} of {awards.length} contract awards{activeFilterCount > 0 ? ' with active filters applied' : ''}.
          </p>

          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Award</th>
                  <th>Vendor</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Award Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingList ? (
                  <tr>
                    <td colSpan={6} className="app-table__empty">Loading contract awards...</td>
                  </tr>
                ) : filteredAwards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="app-table__empty">No contract awards matched the current filters.</td>
                  </tr>
                ) : (
                  filteredAwards.map((award) => (
                    <tr key={award.AwardEntityId}>
                      <td>
                        <div className="app-case-info">
                          <span className="app-case-info__id">{award.AwardId}</span>
                          <span className="app-case-info__title">{award.TenderTitle}</span>
                        </div>
                      </td>
                      <td>{award.VendorName}</td>
                      <td className="app-table__cell--numeric">{formatCurrency(award.AwardValue)}</td>
                      <td>{award.Status}</td>
                      <td>{formatDate(award.AwardDate)}</td>
                      <td>
                        <button className="app-btn app-btn--sm" onClick={() => setSelectedAward(award)}>
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
    </section>
  );
};
