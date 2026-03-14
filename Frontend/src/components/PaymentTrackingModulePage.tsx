'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditCloseoutCreateRequest, InternalModule, PaymentTrackingItem } from '../types/internal';
import { createAuditCloseout } from '../services/auditService';
import { fetchPaymentTracking } from '../services/paymentTrackingService';

const PAYMENT_STAGES = [
  'Awaiting Inspection',
  'Inspection In Progress',
  'Blocked by Inspection',
  'Awaiting Contract Completion',
  'Ready for Final Payment',
  'Archived'
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2
  }).format(value);

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

type Props = {
  module: InternalModule;
  token?: string | null;
  userEmail?: string | null;
};

export const PaymentTrackingModulePage = ({ module, token, userEmail }: Props) => {
  const [records, setRecords] = useState<PaymentTrackingItem[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    query: '',
    closeoutEligibleOnly: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PaymentTrackingItem | null>(null);
  const [closeoutSummary, setCloseoutSummary] = useState('');
  const [archiveLocation, setArchiveLocation] = useState('');

  const grantedActions = useMemo(() => new Set(module.actions ?? []), [module.actions]);
  const canCreateCloseout = Boolean(token) && grantedActions.has('closeout.create');

  const load = async () => {
    if (!token) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const next = await fetchPaymentTracking(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined,
        closeoutEligible: filters.closeoutEligibleOnly ? true : undefined
      });
      setRecords(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load payment tracking.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, filters.status, filters.query, filters.closeoutEligibleOnly]);

  const summary = useMemo(
    () => ({
      ready: records.filter((item) => item.PaymentStage === 'Ready for Final Payment').length,
      archived: records.filter((item) => item.PaymentStage === 'Archived').length,
      blocked: records.filter((item) => item.PaymentStage === 'Blocked by Inspection').length
    }),
    [records]
  );

  const openCloseout = (record: PaymentTrackingItem) => {
    setSelectedRecord(record);
    setCloseoutSummary(`Close out ${record.ContractCode} after accepted inspection and final payment completion.`);
    setArchiveLocation('');
    setError('');
  };

  const handleCloseout = async () => {
    if (!token || !selectedRecord) {
      setError('Select a contract before creating a closeout.');
      return;
    }

    if (!canCreateCloseout) {
      setError('Your current workflow actions do not allow closeout creation.');
      return;
    }

    const payload: AuditCloseoutCreateRequest = {
      EntityType: 'contract',
      EntityId: selectedRecord.ContractId,
      Summary: closeoutSummary.trim(),
      ArchiveLocation: archiveLocation.trim() || undefined,
      FinalAcceptanceCompleted: true,
      FinalPaymentCompleted: true,
      ArchivedBy: userEmail || undefined
    };

    setIsSaving(true);
    setError('');
    try {
      await createAuditCloseout(token, payload);
      setSelectedRecord(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to archive closeout.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Ready for Payment</h3>
          <p>{summary.ready}</p>
        </article>
        <article className="portal-module-card">
          <h3>Archived Files</h3>
          <p>{summary.archived}</p>
        </article>
        <article className="portal-module-card">
          <h3>Blocked Items</h3>
          <p>{summary.blocked}</p>
        </article>
      </div>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Payment Stage</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}
            >
              <option value="">All stages</option>
              {PAYMENT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((previous) => ({ ...previous, query: event.target.value }))}
              placeholder="Contract, tender, vendor, inspection"
            />
          </label>
          <label className="plan-field" style={{ justifyContent: 'flex-end' }}>
            <span>Closeout Ready Only</span>
            <input
              type="checkbox"
              checked={filters.closeoutEligibleOnly}
              onChange={(event) => setFilters((previous) => ({ ...previous, closeoutEligibleOnly: event.target.checked }))}
            />
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" onClick={() => void load()} disabled={!token || isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Vendor</th>
            <th>Contract Status</th>
            <th>Inspection</th>
            <th>Workflow</th>
            <th>Payment Stage</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.ContractId}>
              <td>
                <div>{record.ContractCode}</div>
                <div className="plan-muted">{record.TenderTitle}</div>
                <div className="plan-muted">{formatCurrency(record.ContractValue)}</div>
              </td>
              <td>{record.VendorName}</td>
              <td>
                <div>{record.ContractStatus}</div>
                <div className="plan-muted">Progress {record.ContractProgress}%</div>
              </td>
              <td>
                <div>{record.InspectionCode || 'No inspection'}</div>
                <div className="plan-muted">
                  {record.InspectionStatus || 'Not started'}
                  {record.InspectionOutcome ? ` · ${record.InspectionOutcome}` : ''}
                </div>
              </td>
              <td>
                <div>{record.CurrentStageTitle || record.CurrentStageKey || 'No workflow stage'}</div>
                <div className="plan-muted">{record.WorkflowStatus || 'No live status'}</div>
              </td>
              <td>
                <div>{record.PaymentStage}</div>
                <div className="plan-muted">
                  {record.CloseoutReference ? `${record.CloseoutReference} · ${record.CloseoutStatus}` : 'No closeout record'}
                </div>
              </td>
              <td>
                {record.CloseoutEligible && canCreateCloseout ? (
                  <button type="button" className="plan-link" onClick={() => openCloseout(record)}>
                    Archive
                  </button>
                ) : (
                  <span className="plan-muted">{record.CloseoutReference ? 'Archived' : 'No action'}</span>
                )}
              </td>
            </tr>
          ))}
          {!records.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No payment records match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {selectedRecord ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setSelectedRecord(null)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>Create Closeout</h3>
                <p>{selectedRecord.ContractCode} · {selectedRecord.TenderTitle}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setSelectedRecord(null)}>
                Close
              </button>
            </div>

            <div className="plan-form-grid">
              <label className="plan-field plan-field--span">
                <span>Closeout Summary</span>
                <textarea
                  className="plan-textarea"
                  rows={4}
                  value={closeoutSummary}
                  onChange={(event) => setCloseoutSummary(event.target.value)}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Archive Location</span>
                <input
                  className="plan-input"
                  value={archiveLocation}
                  onChange={(event) => setArchiveLocation(event.target.value)}
                  placeholder="Optional archive path or reference"
                />
              </label>
            </div>

            <div className="requisition-detail-note">
              <h4>Readiness Check</h4>
              <p>Accepted inspection: {selectedRecord.FinalAcceptanceCompleted ? 'Yes' : 'No'}</p>
              <p>Final payment will be recorded by this closeout action.</p>
              <p>Latest inspection completed: {formatDateTimeShort(selectedRecord.InspectionCompletedDate)}</p>
            </div>

            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleCloseout} disabled={isSaving}>
                {isSaving ? 'Archiving...' : 'Archive Closeout'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
