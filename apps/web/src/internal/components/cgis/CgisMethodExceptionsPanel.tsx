import React from 'react';

type ExceptionQueueItem = {
  ExceptionId: string;
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  CurrentStageKey: string;
  CurrentStageTitle: string;
  Amount: number | null;
  CurrentMethod: string;
  RequestedMethod: string;
  RequestReason: string;
  RequestedBy: string | null;
  RequestedAt: string;
  Status: string;
};

type Props = {
  queue: ExceptionQueueItem[];
  isLoading: boolean;
  selected: ExceptionQueueItem | null;
  note: string;
  isSaving: boolean;
  onSelect: (item: ExceptionQueueItem) => void;
  onNoteChange: (value: string) => void;
  onDecide: (action: 'approve' | 'reject' | 'return') => void;
};

const formatCurrency = (amount: number | null) =>
  amount == null ? 'N/A' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

export const CgisMethodExceptionsPanel = ({ queue, isLoading, selected, note, isSaving, onSelect, onNoteChange, onDecide }: Props) => (
  <div className="app-grid app-grid--2col" style={{ alignItems: 'start' }}>
    <div className="app-card">
      <div className="app-card__header">
        <h3 className="app-card__title">Late Method-Change Exceptions</h3>
      </div>
      <div className="app-card__body">
        {queue.length === 0 && !isLoading ? (
          <div className="app-empty-state app-empty-state--small">No pending CGIS exception reviews.</div>
        ) : (
          <div className="app-table-wrapper">
            <table className="app-table app-table--compact">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Current</th>
                  <th>Requested</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.ExceptionId}>
                    <td>
                      <button className="app-btn app-btn--sm" onClick={() => onSelect(item)}>
                        {item.RecordTitle || item.EntityId.slice(0, 8)}
                      </button>
                    </td>
                    <td>{item.CurrentMethod}</td>
                    <td>{item.RequestedMethod}</td>
                    <td>{item.Status}</td>
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
        <h3 className="app-card__title">CGIS Exception Review</h3>
      </div>
      <div className="app-card__body">
        {!selected ? (
          <div className="app-empty-state app-empty-state--small">Select an exception request to review.</div>
        ) : (
          <>
            <div className="app-info-rows">
              <div className="app-info-row"><span className="app-info-row__label">Title</span><span className="app-info-row__value">{selected.RecordTitle || 'Untitled'}</span></div>
              <div className="app-info-row"><span className="app-info-row__label">Stage</span><span className="app-info-row__value">{selected.CurrentStageTitle}</span></div>
              <div className="app-info-row"><span className="app-info-row__label">Amount</span><span className="app-info-row__value">{formatCurrency(selected.Amount)}</span></div>
              <div className="app-info-row"><span className="app-info-row__label">Current Method</span><span className="app-info-row__value">{selected.CurrentMethod}</span></div>
              <div className="app-info-row"><span className="app-info-row__label">Requested Method</span><span className="app-info-row__value">{selected.RequestedMethod}</span></div>
              <div className="app-info-row"><span className="app-info-row__label">Requested By</span><span className="app-info-row__value">{selected.RequestedBy || 'Unknown'}</span></div>
            </div>

            <div className="app-form-group" style={{ marginTop: 16 }}>
              <label className="app-form-label">Request Rationale</label>
              <blockquote className="app-blockquote">{selected.RequestReason}</blockquote>
            </div>

            <div className="app-form-group">
              <label className="app-form-label">CGIS Note</label>
              <textarea className="app-textarea" rows={4} value={note} onChange={(e) => onNoteChange(e.target.value)} />
            </div>

            <div className="app-action-group">
              <button className="app-btn app-btn--success" disabled={isSaving} onClick={() => onDecide('approve')}>Approve</button>
              <button className="app-btn app-btn--danger" disabled={isSaving} onClick={() => onDecide('reject')}>Reject</button>
              <button className="app-btn app-btn--secondary" disabled={isSaving} onClick={() => onDecide('return')}>Return for Clarification</button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
);
