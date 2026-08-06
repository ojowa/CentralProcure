'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditCloseoutCreateRequest, InternalModule, PaymentTrackingItem, PaymentRecordRequest } from '../../types/internal';
import { createAuditCloseout } from '../../services/auditService';
import { fetchPaymentTracking, recordPayment } from '../../services/paymentTrackingService';
import { PaymentTrackingModals } from './PaymentTrackingModals';
import type { WorkflowRuntimeDisplay } from '../shared/workflowDisplayTypes';

const PAYMENT_STAGES = [
  'Awaiting Inspection',
  'Inspection In Progress',
  'Blocked by Inspection',
  'Awaiting Contract Completion',
  'Ready for Final Payment',
  'Ready for Closeout',
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

type PaymentTrackingItemWithDisplay = PaymentTrackingItem & {
  WorkflowDisplay?: WorkflowRuntimeDisplay | null;
};

export const PaymentTrackingModulePage = ({ module, token, userEmail }: Props) => {
  const [records, setRecords] = useState<PaymentTrackingItemWithDisplay[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    query: '',
    closeoutEligibleOnly: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PaymentTrackingItemWithDisplay | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [closeoutSummary, setCloseoutSummary] = useState('');
  const [archiveLocation, setArchiveLocation] = useState('');

  const grantedActions = useMemo(() => new Set(module.actions ?? []), [module.actions]);
  const canCreateCloseout = Boolean(token) && grantedActions.has('closeout.create');
  const canRecordPayment = Boolean(token) && grantedActions.has('payment.record');

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
      }) as PaymentTrackingItemWithDisplay[];
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
      closeout: records.filter((item) => item.PaymentStage === 'Ready for Closeout').length,
      archived: records.filter((item) => item.PaymentStage === 'Archived').length,
      blocked: records.filter((item) => item.PaymentStage === 'Blocked by Inspection').length
    }),
    [records]
  );

  const openPayment = (record: PaymentTrackingItemWithDisplay) => {
    setSelectedRecord(record);
    setPaymentAmount(record.ContractValue);
    setPaymentNotes(`Final payment for ${record.ContractCode} - ${record.TenderTitle}`);
    setPaymentReference(`PAY-${Date.now()}`);
    setPayeeName(record.VendorName);
    setIsPaymentModalOpen(true);
    setError('');
  };

  const openCloseout = (record: PaymentTrackingItemWithDisplay) => {
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
      ContractCode: selectedRecord.ContractCode || selectedRecord.ContractId,
      CloseoutCode: `CL-${Date.now()}`,
      Description: closeoutSummary.trim(),
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

  const handleRecordPayment = async () => {
    if (!token || !selectedRecord) {
      setError('Select a contract before recording a payment.');
      return;
    }

    if (!canRecordPayment) {
      setError('Your current workflow actions do not allow recording payments.');
      return;
    }

    const payload: PaymentRecordRequest = {
      ContractId: selectedRecord.ContractId,
      PaymentReference: paymentReference.trim() || `PAY-${Date.now()}`,
      PayeeName: payeeName.trim() || selectedRecord.VendorName,
      Amount: paymentAmount,
      Notes: paymentNotes.trim() || undefined
    };

    setIsSaving(true);
    setError('');
    try {
      await recordPayment(token, payload);
      setIsPaymentModalOpen(false);
      setSelectedRecord(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record payment.');
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
          <h3>Ready for Closeout</h3>
          <p>{summary.closeout}</p>
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
                <div>{record.CurrentStageTitle || record.CurrentStageKey || 'Unknown'}</div>
                <div className="plan-muted">{record.WorkflowStatus || 'No live status'}</div>
              </td>
              <td>
                <div>{record.PaymentStage}</div>
                <div className="plan-muted">
                  {record.CloseoutReference ? `${record.CloseoutReference} · ${record.CloseoutStatus}` : (record.FinalPaymentRecorded ? 'Payment recorded' : 'No payment record')}
                </div>
              </td>
              <td>
                {record.PaymentStage === 'Ready for Final Payment' && canRecordPayment ? (
                  <button type="button" className="plan-link" onClick={() => openPayment(record)}>
                    Record Payment
                  </button>
                ) : record.CloseoutEligible && canCreateCloseout ? (
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

      <PaymentTrackingModals
        selectedRecord={selectedRecord}
        isPaymentModalOpen={isPaymentModalOpen}
        isSaving={isSaving}
        paymentAmount={paymentAmount}
        paymentNotes={paymentNotes}
        paymentReference={paymentReference}
        payeeName={payeeName}
        closeoutSummary={closeoutSummary}
        archiveLocation={archiveLocation}
        formatCurrency={formatCurrency}
        formatDateTimeShort={formatDateTimeShort}
        onClosePayment={() => {
          setSelectedRecord(null);
          setIsPaymentModalOpen(false);
        }}
        onCloseCloseout={() => setSelectedRecord(null)}
        onPaymentAmountChange={setPaymentAmount}
        onPaymentNotesChange={setPaymentNotes}
        onPaymentReferenceChange={setPaymentReference}
        onPayeeNameChange={setPayeeName}
        onCloseoutSummaryChange={setCloseoutSummary}
        onArchiveLocationChange={setArchiveLocation}
        onRecordPayment={handleRecordPayment}
        onCreateCloseout={handleCloseout}
      />
    </section>
  );
};
