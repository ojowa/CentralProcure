'use client';

import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import type { WorkflowRuntimeDisplay } from './workflowDisplayTypes';
import type { PaymentTrackingItem } from '../types/internal';

type PaymentTrackingItemWithDisplay = PaymentTrackingItem & {
  WorkflowDisplay?: WorkflowRuntimeDisplay | null;
};

type Props = {
  selectedRecord: PaymentTrackingItemWithDisplay | null;
  isPaymentModalOpen: boolean;
  isSaving: boolean;
  paymentAmount: number;
  paymentNotes: string;
  closeoutSummary: string;
  archiveLocation: string;
  formatCurrency: (value: number) => string;
  formatDateTimeShort: (value?: string | null) => string;
  onClosePayment: () => void;
  onCloseCloseout: () => void;
  onPaymentAmountChange: (value: number) => void;
  onPaymentNotesChange: (value: string) => void;
  onCloseoutSummaryChange: (value: string) => void;
  onArchiveLocationChange: (value: string) => void;
  onRecordPayment: () => void;
  onCreateCloseout: () => void;
};

export const PaymentTrackingModals = (props: Props) => {
  const { selectedRecord } = props;
  if (!selectedRecord) {
    return null;
  }

  const display = selectedRecord.WorkflowDisplay;

  return props.isPaymentModalOpen ? (
    <div className="plan-modal" role="dialog" aria-modal="true">
      <div className="plan-modal__backdrop" onClick={props.onClosePayment} />
      <div className="plan-modal__content requisition-detail-modal">
        <div className="requisition-card__header">
          <div>
            <h3>Record Final Payment</h3>
            <p>{selectedRecord.ContractCode} · {selectedRecord.TenderTitle}</p>
          </div>
          <button type="button" className="plan-link" onClick={props.onClosePayment}>
            Close
          </button>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <WorkflowProgressStepper currentStageKey={selectedRecord.CurrentStageKey || ''} display={display} />
        </div>
        <div className="plan-form-grid">
          <label className="plan-field plan-field--span">
            <span>Payment Amount (NGN)</span>
            <input type="number" className="plan-input" value={props.paymentAmount} onChange={(event) => props.onPaymentAmountChange(Number(event.target.value))} />
          </label>
          <label className="plan-field plan-field--span">
            <span>Payment Notes</span>
            <textarea className="plan-textarea" rows={3} value={props.paymentNotes} onChange={(event) => props.onPaymentNotesChange(event.target.value)} />
          </label>
        </div>
        <div className="requisition-detail-note">
          <h4>Readiness Check</h4>
          <p>Contract Status: {selectedRecord.ContractStatus}</p>
          <p>Accepted inspection: {selectedRecord.FinalAcceptanceCompleted ? 'Yes' : 'No'}</p>
          <p>Contract Value: {props.formatCurrency(selectedRecord.ContractValue)}</p>
        </div>
        <div className="plan-actions">
          <button type="button" className="plan-button" onClick={props.onRecordPayment} disabled={props.isSaving}>
            {props.isSaving ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="plan-modal" role="dialog" aria-modal="true">
      <div className="plan-modal__backdrop" onClick={props.onCloseCloseout} />
      <div className="plan-modal__content requisition-detail-modal">
        <div className="requisition-card__header">
          <div>
            <h3>Create Closeout</h3>
            <p>{selectedRecord.ContractCode} · {selectedRecord.TenderTitle}</p>
          </div>
          <button type="button" className="plan-link" onClick={props.onCloseCloseout}>
            Close
          </button>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <WorkflowProgressStepper currentStageKey={selectedRecord.CurrentStageKey || ''} display={display} />
        </div>
        <div className="plan-form-grid">
          <label className="plan-field plan-field--span">
            <span>Closeout Summary</span>
            <textarea className="plan-textarea" rows={4} value={props.closeoutSummary} onChange={(event) => props.onCloseoutSummaryChange(event.target.value)} />
          </label>
          <label className="plan-field plan-field--span">
            <span>Archive Location</span>
            <input className="plan-input" value={props.archiveLocation} onChange={(event) => props.onArchiveLocationChange(event.target.value)} placeholder="Optional archive path or reference" />
          </label>
        </div>
        <div className="requisition-detail-note">
          <h4>Readiness Check</h4>
          <p>Accepted inspection: {selectedRecord.FinalAcceptanceCompleted ? 'Yes' : 'No'}</p>
          <p>Final payment will be recorded by this closeout action.</p>
          <p>Latest inspection completed: {props.formatDateTimeShort(selectedRecord.InspectionCompletedDate)}</p>
        </div>
        <div className="plan-actions">
          <button type="button" className="plan-button" onClick={props.onCreateCloseout} disabled={props.isSaving}>
            {props.isSaving ? 'Archiving...' : 'Archive Closeout'}
          </button>
        </div>
      </div>
    </div>
  );
};
