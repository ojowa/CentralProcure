import React, { useEffect, useState } from 'react';
import type { InternalModule } from '../../types/internal';
import { fetchModuleData } from '../../services/moduleService';
import {
  fetchProcurementMethodDetail,
  recordProcurementMethodDecision,
  requestProcurementMethodException
} from '../../services/moduleService.tenders';

type QueueItem = {
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  CurrentStageKey: string;
  CurrentStageTitle: string;
  Amount: number | null;
  ProcurementType: string | null;
  ApprovalRoute: string | null;
  ApprovalAuthorityLabel: string | null;
  SelectedMethod: string | null;
  LastDeterminedAt: string | null;
  ActiveExceptionStatus: string | null;
};

type Detail = {
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  CurrentStageKey: string;
  CurrentStageTitle: string;
  Amount: number | null;
  ProcurementType: string | null;
  ApprovalRoute: string | null;
  ApprovalAuthorityLabel: string | null;
  RequiresCgisApproval: boolean;
  RequiresBoard: boolean;
  RequiresBpp: boolean;
  CurrentDecision?: {
    SelectedMethod: string;
    DecisionReason: string;
    DeterminedBy?: string | null;
    DeterminedAt: string;
    IsExceptionDecision: boolean;
  } | null;
  ActiveException?: {
    ExceptionId: string;
    CurrentMethod: string;
    RequestedMethod: string;
    RequestReason: string;
    Status: string;
  } | null;
};

const formatCurrency = (amount: number | null) =>
  amount == null ? 'N/A' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

export const ProcurementMethodDeterminationModule = ({ module, token }: { module: InternalModule; token: string | null }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [method, setMethod] = useState<'CompetitiveTender' | 'SimplifiedQuotation'>('CompetitiveTender');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadQueue = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModuleData('procurement-method-determination', token) as QueueItem[];
      setQueue(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load low-value method queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [token]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!token || !selected) {
        setDetail(null);
        return;
      }
      try {
        const nextDetail = await fetchProcurementMethodDetail(selected.EntityType, selected.EntityId, token);
        setDetail(nextDetail);
        if (nextDetail.CurrentDecision?.SelectedMethod === 'SimplifiedQuotation') {
          setMethod('SimplifiedQuotation');
        } else {
          setMethod('CompetitiveTender');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load method detail.');
      }
    };
    void loadDetail();
  }, [selected, token]);

  const submit = async (useException: boolean) => {
    if (!token || !selected || !note.trim()) {
      setError('A rationale is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      if (useException) {
        await requestProcurementMethodException({
          EntityType: selected.EntityType,
          EntityId: selected.EntityId,
          RequestedMethod: method,
          Rationale: note.trim()
        }, token);
        setFeedback('Late method-change exception submitted to CGIS.');
      } else {
        await recordProcurementMethodDecision({
          EntityType: selected.EntityType,
          EntityId: selected.EntityId,
          SelectedMethod: method,
          Rationale: note.trim()
        }, token);
        setFeedback('Procurement method recorded.');
      }

      setNote('');
      await loadQueue();
      const refreshed = await fetchProcurementMethodDetail(selected.EntityType, selected.EntityId, token);
      setDetail(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save procurement method decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        <button className="app-btn app-btn--secondary" onClick={() => void loadQueue()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </header>

      {error ? <div className="app-alert app-alert--error">{error}</div> : null}
      {feedback ? <div className="app-alert">{feedback}</div> : null}

      <div className="app-grid app-grid--2col" style={{ alignItems: 'start' }}>
        <div className="app-card">
          <div className="app-card__header">
            <h3 className="app-card__title">Low-Value Queue</h3>
          </div>
          <div className="app-card__body">
            {queue.length === 0 && !loading ? (
              <div className="app-empty-state app-empty-state--small">No low-value cases require method action.</div>
            ) : (
              <div className="app-table-wrapper">
                <table className="app-table app-table--compact">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Stage</th>
                      <th>Method</th>
                      <th>Exception</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={`${item.EntityType}-${item.EntityId}`}>
                        <td>
                          <button className="app-btn app-btn--sm" onClick={() => setSelected(item)}>
                            {item.RecordTitle || item.EntityId.slice(0, 8)}
                          </button>
                        </td>
                        <td>{item.CurrentStageTitle}</td>
                        <td>{item.SelectedMethod || 'Pending'}</td>
                        <td>{item.ActiveExceptionStatus || 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="app-card">
          <div className="app-card__header">
            <h3 className="app-card__title">Method Workspace</h3>
          </div>
          <div className="app-card__body">
            {!selected || !detail ? (
              <div className="app-empty-state app-empty-state--small">Select a case to determine or change the procurement method.</div>
            ) : (
              <>
                <div className="app-info-rows">
                  <div className="app-info-row"><span className="app-info-row__label">Title</span><span className="app-info-row__value">{detail.RecordTitle || 'Untitled'}</span></div>
                  <div className="app-info-row"><span className="app-info-row__label">Stage</span><span className="app-info-row__value">{detail.CurrentStageTitle}</span></div>
                  <div className="app-info-row"><span className="app-info-row__label">Amount</span><span className="app-info-row__value">{formatCurrency(detail.Amount)}</span></div>
                  <div className="app-info-row"><span className="app-info-row__label">Route</span><span className="app-info-row__value">{detail.ApprovalAuthorityLabel || detail.ApprovalRoute || 'N/A'}</span></div>
                  <div className="app-info-row"><span className="app-info-row__label">Current Method</span><span className="app-info-row__value">{detail.CurrentDecision?.SelectedMethod || 'Not yet recorded'}</span></div>
                  <div className="app-info-row"><span className="app-info-row__label">Active Exception</span><span className="app-info-row__value">{detail.ActiveException?.Status || 'None'}</span></div>
                </div>

                <div className="app-form-group" style={{ marginTop: 16 }}>
                  <label className="app-form-label">Selected Method</label>
                  <select className="app-input" value={method} onChange={(e) => setMethod(e.target.value as 'CompetitiveTender' | 'SimplifiedQuotation')}>
                    <option value="CompetitiveTender">Competitive Tender</option>
                    <option value="SimplifiedQuotation">Simplified Quotation</option>
                  </select>
                </div>

                <div className="app-form-group">
                  <label className="app-form-label">Rationale</label>
                  <textarea className="app-textarea" rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                <div className="app-action-group">
                  <button className="app-btn app-btn--success" disabled={saving} onClick={() => void submit(false)}>
                    {saving ? 'Saving...' : 'Record Method'}
                  </button>
                  <button className="app-btn app-btn--secondary" disabled={saving} onClick={() => void submit(true)}>
                    {saving ? 'Submitting...' : 'Request Late Change Exception'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
