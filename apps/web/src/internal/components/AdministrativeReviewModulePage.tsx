'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AdministrativeReviewCreateRequest,
  AdministrativeReviewDetail,
  AdministrativeReviewSummary,
  InternalModule,
  RoleKey
} from '../types/internal';
import {
  createAdministrativeReview,
  fetchAdministrativeReviewDetail,
  fetchAdministrativeReviews,
  updateAdministrativeReview
} from '../services/administrativeReviewService';

const REVIEW_STATUSES = ['Filed', 'In Review', 'Escalated', 'Resolved', 'Rejected', 'Closed'] as const;
const REVIEW_OUTCOMES = [
  'Resume Procurement',
  'Modify Decision',
  'Escalate To BPP',
  'Terminate Procurement',
  'Dismiss Complaint'
] as const;

const toTitle = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'accounting_officer_review') {
    return 'CGIS Approval';
  }

  return value
    ? value
        .replace(/_/g, ' ')
        .split(' ')
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Unspecified';
};

const formatDateTimeShort = (value?: string | null) => {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusTone = (status?: string | null) => {
  switch ((status ?? '').toLowerCase()) {
    case 'resolved':
    case 'closed':
      return 'admin-status--good';
    case 'in review':
    case 'escalated':
      return 'admin-status--warn';
    case 'rejected':
      return 'admin-status--alert';
    default:
      return '';
  }
};

type Props = {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
};

export const AdministrativeReviewModulePage = ({ module, token, role, userEmail }: Props) => {
  const [records, setRecords] = useState<AdministrativeReviewSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdministrativeReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    entityType: '',
    entityId: ''
  });
  const [createForm, setCreateForm] = useState<AdministrativeReviewCreateRequest>({
    EntityType: 'tender',
    EntityId: '',
    Subject: '',
    Summary: '',
    Details: '',
    ComplaintChannel: 'Portal',
    RequestedRemedy: '',
    FiledBy: userEmail ?? '',
    AssignedTo: ''
  });
  const [updateForm, setUpdateForm] = useState({
    status: 'In Review',
    assignedTo: '',
    reviewedBy: userEmail ?? '',
    resolutionOutcome: '',
    resolutionStageKey: '',
    resolutionNotes: ''
  });

  const grantedActions = useMemo(() => new Set(module.actions ?? []), [module.actions]);
  const canCreate = Boolean(token) && grantedActions.has('administrative_review.create');
  const canUpdate = Boolean(token) && grantedActions.has('administrative_review.update');
  const canResolve = Boolean(token) && grantedActions.has('administrative_review.resolve');
  const canMutate = canUpdate || canResolve;
  const canChooseResolutionStage = updateForm.resolutionOutcome === 'Modify Decision';

  const summary = useMemo(() => {
    const counts = records.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.Status] = (accumulator[record.Status] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      total: records.length,
      filed: counts.Filed ?? 0,
      inReview: (counts['In Review'] ?? 0) + (counts.Escalated ?? 0),
      closed: (counts.Resolved ?? 0) + (counts.Rejected ?? 0) + (counts.Closed ?? 0)
    };
  }, [records]);

  const loadRecords = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setActionError('');
    try {
      const next = await fetchAdministrativeReviews(token, {
        status: filters.status || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined
      });
      setRecords(next);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to load administrative reviews.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, [token, filters.status, filters.entityType, filters.entityId]);

  useEffect(() => {
    setCreateForm((previous) => ({
      ...previous,
      FiledBy: userEmail ?? previous.FiledBy
    }));
    setUpdateForm((previous) => ({
      ...previous,
      reviewedBy: userEmail ?? previous.reviewedBy
    }));
  }, [userEmail]);

  const openDetail = async (complaintId: string) => {
    if (!token) {
      return;
    }

    setSelectedId(complaintId);
    setIsDetailLoading(true);
    setActionError('');
    try {
      const next = await fetchAdministrativeReviewDetail(token, complaintId);
      setDetail(next);
      setUpdateForm({
        status: next.Status || 'In Review',
        assignedTo: next.AssignedTo ?? '',
        reviewedBy: next.ReviewedBy ?? userEmail ?? '',
        resolutionOutcome: next.ResolutionOutcome ?? '',
        resolutionStageKey: next.ResolutionOutcome === 'Modify Decision' ? next.ResolutionStageKey ?? '' : '',
        resolutionNotes: next.ResolutionNotes ?? ''
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to load administrative review detail.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setActionError('');
  };

  const handleCreate = async () => {
    if (!token) {
      setActionError('Authentication token missing. Please sign in again.');
      return;
    }

    if (!createForm.EntityId.trim()) {
      setActionError('Entity ID is required.');
      return;
    }

    setIsSaving(true);
    setActionError('');
    try {
      const created = await createAdministrativeReview(token, {
        ...createForm,
        EntityId: createForm.EntityId.trim(),
        FiledBy: createForm.FiledBy?.trim() || userEmail || undefined,
        AssignedTo: createForm.AssignedTo?.trim() || undefined,
        RequestedRemedy: createForm.RequestedRemedy?.trim() || undefined
      });
      await loadRecords();
      await openDetail(created.ComplaintId);
      setCreateForm((previous) => ({
        ...previous,
        EntityId: '',
        Subject: '',
        Summary: '',
        Details: '',
        RequestedRemedy: '',
        AssignedTo: ''
      }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create administrative review.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!token || !selectedId) {
      setActionError('Select a complaint before saving updates.');
      return;
    }

    if (!canMutate) {
      setActionError('You do not have a granted action to update this review branch.');
      return;
    }

    const isResolutionStatus = ['Resolved', 'Rejected', 'Closed'].includes(updateForm.status);
    const isResolutionEdit =
      Boolean(updateForm.resolutionOutcome) ||
      Boolean(updateForm.resolutionStageKey.trim()) ||
      Boolean(updateForm.resolutionNotes.trim()) ||
      isResolutionStatus;

    if (isResolutionEdit && !canResolve) {
      setActionError('Your current workflow actions do not allow complaint resolution.');
      return;
    }

    setIsSaving(true);
    setActionError('');
    try {
      const updated = await updateAdministrativeReview(token, selectedId, {
        Status: updateForm.status || undefined,
        AssignedTo: updateForm.assignedTo.trim() || undefined,
        ReviewedBy: updateForm.reviewedBy.trim() || undefined,
        ResolutionOutcome: canResolve ? updateForm.resolutionOutcome || undefined : undefined,
        ResolutionStageKey: canResolve && canChooseResolutionStage ? updateForm.resolutionStageKey.trim() || undefined : undefined,
        ResolutionNotes: canResolve ? updateForm.resolutionNotes.trim() || undefined : undefined
      });
      setDetail(updated);
      await loadRecords();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update administrative review.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Total Complaints</h3>
          <p>{summary.total}</p>
        </article>
        <article className="portal-module-card">
          <h3>Open Branches</h3>
          <p>{summary.filed + summary.inReview}</p>
        </article>
        <article className="portal-module-card">
          <h3>Closed Branches</h3>
          <p>{summary.closed}</p>
        </article>
      </div>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {REVIEW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Entity Type</span>
            <input
              className="plan-input"
              value={filters.entityType}
              onChange={(event) => setFilters((previous) => ({ ...previous, entityType: event.target.value }))}
              placeholder="tender, requisition, contract"
            />
          </label>
          <label className="plan-field">
            <span>Entity ID</span>
            <input
              className="plan-input"
              value={filters.entityId}
              onChange={(event) => setFilters((previous) => ({ ...previous, entityId: event.target.value }))}
              placeholder="Workflow entity UUID"
            />
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" onClick={() => void loadRecords()} disabled={!token || isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <article className="admin-card admin-card--wide">
          <h3>Administrative Review Queue</h3>
          {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
          <div style={{ overflowX: 'auto' }}>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Parent Record</th>
                <th>Filed Stage</th>
                <th>Current Parent Stage</th>
                <th>Status</th>
                <th>Filed</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.ComplaintId}>
                  <td>
                    <button type="button" className="plan-link" onClick={() => void openDetail(record.ComplaintId)}>
                      {record.ComplaintReference}
                    </button>
                    <div className="plan-muted">{record.Subject}</div>
                  </td>
                  <td>{record.ParentRecordTitle || record.EntityId}</td>
                  <td>{toTitle(record.StageKeyAtFiling)}</td>
                  <td>
                    <div>{record.ParentCurrentStageTitle || toTitle(record.ParentCurrentStageKey)}</div>
                    <div className="plan-muted">{record.ParentCurrentStatus || 'No live status'}</div>
                  </td>
                  <td>
                    <span className={`admin-status ${statusTone(record.Status)}`}>{record.Status}</span>
                  </td>
                  <td>{formatDateTimeShort(record.FiledAt)}</td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={6} className="plan-empty">
                    No administrative reviews match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </article>

        {canCreate ? (
          <article className="admin-card admin-card--mid">
            <h3>File Complaint</h3>
            <div className="plan-form-grid">
              <label className="plan-field">
                <span>Entity Type</span>
                <select
                  className="plan-select"
                  value={createForm.EntityType}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, EntityType: event.target.value }))}
                >
                  <option value="tender">Tender</option>
                  <option value="requisition">Requisition</option>
                  <option value="contract_award">Contract Award</option>
                </select>
              </label>
              <label className="plan-field">
                <span>Entity ID</span>
                <input
                  className="plan-input"
                  value={createForm.EntityId}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, EntityId: event.target.value }))}
                  placeholder="Parent workflow UUID"
                />
              </label>
              <label className="plan-field">
                <span>Complaint Channel</span>
                <input
                  className="plan-input"
                  value={createForm.ComplaintChannel ?? ''}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, ComplaintChannel: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Subject</span>
                <input
                  className="plan-input"
                  value={createForm.Subject}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, Subject: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Summary</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={createForm.Summary}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, Summary: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Details</span>
                <textarea
                  className="plan-textarea"
                  rows={5}
                  value={createForm.Details}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, Details: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Requested Remedy</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={createForm.RequestedRemedy ?? ''}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, RequestedRemedy: event.target.value }))}
                />
              </label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'File Complaint'}
              </button>
            </div>
          </article>
        ) : null}
      </div>

      {actionError ? <div className="portal-alert" style={{ marginTop: '16px' }}>{actionError}</div> : null}

      {selectedId ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail?.ComplaintReference || 'Administrative Review'}</h3>
                <p>{detail?.ParentRecordTitle || detail?.EntityId || 'Loading complaint detail.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDetail}>
                Close
              </button>
            </div>
            {isDetailLoading ? <div className="plan-loading">Loading administrative review...</div> : null}
            {detail ? (
              <>
                <div className="requisition-detail-grid">
                  <div className="requisition-card">
                    <h4>Complaint State</h4>
                    <p><span className={`admin-status ${statusTone(detail.Status)}`}>{detail.Status}</span></p>
                    <p className="plan-muted">Filed {formatDateTimeShort(detail.FiledAt)}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Parent Workflow</h4>
                    <p>{detail.ParentCurrentStageTitle || toTitle(detail.ParentCurrentStageKey)}</p>
                    <p className="plan-muted">{detail.ParentCurrentStatus || 'No live parent status'}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Filed From</h4>
                    <p>{toTitle(detail.StageKeyAtFiling)}</p>
                    <p className="plan-muted">{detail.EntityType} · {detail.EntityId}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Current Review Owner</h4>
                    <p>{detail.AssignedTo || 'Unassigned'}</p>
                    <p className="plan-muted">{detail.ReviewedBy || 'No reviewer recorded'}</p>
                  </div>
                </div>

                <div className="requisition-detail-note">
                  <h4>Complaint Summary</h4>
                  <p>{detail.Summary}</p>
                </div>
                <div className="requisition-detail-note">
                  <h4>Detailed Complaint Record</h4>
                  <p>{detail.Details}</p>
                </div>

                <div className="plan-form plan-form--edit">
                  <div className="plan-form__header">
                    <div>
                      <h3>Update Review Branch</h3>
                      <p>Record review progression, escalation, or complaint resolution against the parent workflow.</p>
                    </div>
                  </div>
                  <div className="plan-form-grid">
                    <label className="plan-field">
                      <span>Status</span>
                      <select
                        className="plan-select"
                        value={updateForm.status}
                        disabled={!canMutate}
                        onChange={(event) => setUpdateForm((previous) => ({ ...previous, status: event.target.value }))}
                      >
                        {REVIEW_STATUSES.map((status) => (
                          <option
                            key={status}
                            value={status}
                            disabled={!canResolve && ['Resolved', 'Rejected', 'Closed'].includes(status)}
                          >
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="plan-field">
                      <span>Assigned To</span>
                      <input
                        className="plan-input"
                        value={updateForm.assignedTo}
                        disabled={!canMutate}
                        onChange={(event) => setUpdateForm((previous) => ({ ...previous, assignedTo: event.target.value }))}
                      />
                    </label>
                    <label className="plan-field">
                      <span>Reviewed By</span>
                      <input
                        className="plan-input"
                        value={updateForm.reviewedBy}
                        disabled={!canMutate}
                        onChange={(event) => setUpdateForm((previous) => ({ ...previous, reviewedBy: event.target.value }))}
                      />
                    </label>
                    <label className="plan-field">
                      <span>Resolution Outcome</span>
                      <select
                        className="plan-select"
                        value={updateForm.resolutionOutcome}
                        disabled={!canResolve}
                        onChange={(event) => setUpdateForm((previous) => ({
                          ...previous,
                          resolutionOutcome: event.target.value,
                          resolutionStageKey: event.target.value === 'Modify Decision' ? previous.resolutionStageKey : ''
                        }))}
                      >
                        <option value="">No outcome selected</option>
                        {REVIEW_OUTCOMES.map((outcome) => (
                          <option key={outcome} value={outcome}>
                            {outcome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="plan-field">
                      <span>Resolution Stage Key</span>
                      <input
                        className="plan-input"
                        value={updateForm.resolutionStageKey}
                        disabled={!canResolve || !canChooseResolutionStage}
                        onChange={(event) => setUpdateForm((previous) => ({ ...previous, resolutionStageKey: event.target.value }))}
                        placeholder={canChooseResolutionStage ? 'Only needed when modifying the workflow decision' : 'Server will infer the workflow transition'}
                      />
                    </label>
                    <label className="plan-field plan-field--span">
                      <span>Resolution Notes</span>
                      <textarea
                        className="plan-textarea"
                        rows={4}
                        value={updateForm.resolutionNotes}
                        disabled={!canResolve}
                        onChange={(event) => setUpdateForm((previous) => ({ ...previous, resolutionNotes: event.target.value }))}
                        placeholder="Record findings, AO or BPP review direction, and exit rationale."
                      />
                    </label>
                  </div>
                  <p className="plan-muted" style={{ marginTop: '12px' }}>
                    Server workflow rules remain authoritative. Resolution stage is only supplied here for the `Modify Decision` outcome; other outcomes are resolved server-side.
                  </p>
                  <div className="plan-actions">
                    <button type="button" className="plan-button" onClick={handleUpdate} disabled={!canMutate || isSaving}>
                      {isSaving ? 'Saving...' : 'Save Review Update'}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
