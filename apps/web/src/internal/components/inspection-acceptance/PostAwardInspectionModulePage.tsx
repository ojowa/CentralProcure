'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InspectionItem, InspectionUpdateRequest, InternalModule } from '../../types/internal';
import { fetchInspectionDetail, fetchInspections, updateInspection } from '../../services/inspectionService';

const INSPECTION_STATUSES = ['Scheduled', 'In Progress', 'Accepted', 'Rejected'] as const;
const INSPECTION_OUTCOMES = ['Pending', 'Accepted', 'Rejected'] as const;

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const toInputDateTime = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const statusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case 'accepted':
      return 'admin-status--good';
    case 'rejected':
      return 'admin-status--bad';
    case 'in progress':
      return 'admin-status--warn';
    default:
      return '';
  }
};

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const PostAwardInspectionModulePage = ({ module, token }: Props) => {
  const [filters, setFilters] = useState({ status: '', query: '' });
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<InspectionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: 'Scheduled',
    outcome: 'Pending',
    completedDate: '',
    inspectorName: '',
    notes: ''
  });

  const grantedActions = useMemo(() => new Set(module.actions ?? []), [module.actions]);
  const canUpdate = Boolean(token) && grantedActions.has('inspection.update');

  const refreshInspections = async () => {
    if (!token) {
      setInspections([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await fetchInspections(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined
      });
      setInspections(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load inspections.');
      setInspections([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshInspections();
  }, [token, filters.status, filters.query]);

  const viewDetail = async (inspectionId: string) => {
    if (!token) {
      return;
    }

    setDetailOpen(true);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await fetchInspectionDetail(token, inspectionId);
      setDetail(data);
      setUpdateForm({
        status: data.Status || 'Scheduled',
        outcome: data.Outcome || 'Pending',
        completedDate: toInputDateTime(data.CompletedDate),
        inspectorName: data.InspectorName || '',
        notes: data.Notes || ''
      });
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Unable to load inspection detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!token || !detail) {
      setDetailError('Select an inspection before saving.');
      return;
    }

    if (!canUpdate) {
      setDetailError('Your current workflow actions do not allow inspection updates.');
      return;
    }

    const payload: InspectionUpdateRequest = {
      Status: updateForm.status,
      Outcome: updateForm.outcome,
      CompletedDate: updateForm.completedDate ? new Date(updateForm.completedDate).toISOString() : undefined,
      InspectorName: updateForm.inspectorName.trim() || undefined,
      Notes: updateForm.notes.trim() || undefined
    };

    setIsSaving(true);
    setDetailError('');
    try {
      const updated = await updateInspection(token, detail.InspectionId, payload);
      setDetail(updated);
      await refreshInspections();
    } catch (saveError) {
      setDetailError(saveError instanceof Error ? saveError.message : 'Unable to update inspection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module inspection-acceptance">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Inspection ID, contract, or vendor"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {INSPECTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th>Inspection ID</th>
            <th>Contract</th>
            <th>Vendor</th>
            <th>Status</th>
            <th>Scheduled</th>
            <th>Outcome</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {inspections.map((inspection) => (
            <tr key={inspection.InspectionId}>
              <td>{inspection.InspectionId}</td>
              <td>{inspection.ContractCode}</td>
              <td>{inspection.VendorName}</td>
              <td>
                <span className={`admin-status ${statusTone(inspection.Status)}`}>{inspection.Status}</span>
              </td>
              <td>{formatDate(inspection.ScheduledDate)}</td>
              <td>{inspection.Outcome ?? '—'}</td>
              <td>
                <button type="button" className="plan-link" onClick={() => void viewDetail(inspection.InspectionId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!inspections.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No inspections match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isLoading ? <p>Loading inspections...</p> : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setDetailOpen(false)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.TenderTitle : 'Inspection Detail'}</h3>
                <p>{detail ? `Inspection ${detail.InspectionId}` : 'Loading inspection data.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading inspection details...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {detail ? (
              <>
                <div className="requisition-detail requisition-detail--modal">
                  <div className="requisition-detail-grid">
                    <div>
                      <span>Contract Code</span>
                      <strong>{detail.ContractCode}</strong>
                    </div>
                    <div>
                      <span>Vendor</span>
                      <strong>{detail.VendorName}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{detail.Status}</strong>
                    </div>
                    <div>
                      <span>Scheduled Date</span>
                      <strong>{formatDate(detail.ScheduledDate)}</strong>
                    </div>
                    <div>
                      <span>Completed Date</span>
                      <strong>{formatDate(detail.CompletedDate ?? null)}</strong>
                    </div>
                    <div>
                      <span>Inspector</span>
                      <strong>{detail.InspectorName}</strong>
                    </div>
                    <div>
                      <span>Location</span>
                      <strong>{detail.Location}</strong>
                    </div>
                    <div>
                      <span>Outcome</span>
                      <strong>{detail.Outcome ?? '—'}</strong>
                    </div>
                  </div>
                </div>

                {canUpdate ? (
                  <div className="plan-form plan-form--edit">
                    <div className="plan-form__header">
                      <div>
                        <h3>Update Inspection</h3>
                        <p>Record inspection progress, acceptance, or rejection to keep post-award workflow state current.</p>
                      </div>
                    </div>
                    <div className="plan-form-grid">
                      <label className="plan-field">
                        <span>Status</span>
                        <select
                          className="plan-select"
                          value={updateForm.status}
                          onChange={(event) => setUpdateForm((previous) => ({ ...previous, status: event.target.value }))}
                        >
                          {INSPECTION_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="plan-field">
                        <span>Outcome</span>
                        <select
                          className="plan-select"
                          value={updateForm.outcome}
                          onChange={(event) => setUpdateForm((previous) => ({ ...previous, outcome: event.target.value }))}
                        >
                          {INSPECTION_OUTCOMES.map((outcome) => (
                            <option key={outcome} value={outcome}>
                              {outcome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="plan-field">
                        <span>Completed Date</span>
                        <input
                          className="plan-input"
                          type="datetime-local"
                          value={updateForm.completedDate}
                          onChange={(event) => setUpdateForm((previous) => ({ ...previous, completedDate: event.target.value }))}
                        />
                      </label>
                      <label className="plan-field">
                        <span>Inspector ID</span>
                        <input
                          className="plan-input"
                          value={updateForm.inspectorName}
                          onChange={(event) => setUpdateForm((previous) => ({ ...previous, inspectorName: event.target.value }))}
                          placeholder="UUID of inspector"
                        />
                      </label>
                      <label className="plan-field plan-field--span">
                        <span>Notes</span>
                        <textarea
                          className="plan-textarea"
                          rows={4}
                          value={updateForm.notes}
                          onChange={(event) => setUpdateForm((previous) => ({ ...previous, notes: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="plan-actions">
                      <button type="button" className="plan-button" onClick={handleUpdate} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Inspection Update'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="requisition-detail-note">
                    <h4>Update Access</h4>
                    <p>Your current workflow actions only allow inspection visibility from this workspace.</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
