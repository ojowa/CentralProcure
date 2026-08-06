import type { ProcurementPlanDetail } from '../../types/internal';

type Props = {
  selectedPlan: ProcurementPlanDetail;
  loading: boolean;
  actionError: string | null;
  approvalNote: string;
  thresholdSummary: string | null;
  canTakeApprovalDecision: boolean;
  isAwaitingAppApproval: boolean;
  isAwaitingCgisApproval: boolean;
  isAtProcurementInitiation: boolean;
  onApprovalNoteChange: (value: string) => void;
  onApprovalDecision: (decision: 'approve' | 'return' | 'reject') => void;
  onInitiateProcurement: () => void;
};

export const ProcurementPlanActionsPanel = ({
  selectedPlan,
  loading,
  actionError,
  approvalNote,
  thresholdSummary,
  canTakeApprovalDecision,
  isAwaitingAppApproval,
  isAwaitingCgisApproval,
  isAtProcurementInitiation,
  onApprovalNoteChange,
  onApprovalDecision,
  onInitiateProcurement
}: Props) => (
  <>
    {canTakeApprovalDecision && isAwaitingAppApproval ? (
      <section className="app-card app-card--action">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">✓</span>
            <h3 className="app-section-title__text">APP Approval Decision</h3>
          </div>
        </div>

        <div className="app-status-banner app-status-banner--info">
          <span className="app-status-banner__icon">ℹ</span>
          <p className="app-status-banner__text">This APP is awaiting approval. Record your decision below with supporting notes.</p>
        </div>

        <div className="app-form-group">
          <label className="app-form-label" htmlFor="approval-note">
            Approval Note
          </label>
          <textarea
            id="approval-note"
            className="app-textarea"
            rows={4}
            value={approvalNote}
            onChange={(event) => onApprovalNoteChange(event.target.value)}
            placeholder="Record approval rationale, return instruction, or rejection reason..."
            disabled={loading}
          />
        </div>

        {actionError ? (
          <div className="app-alert app-alert--error" style={{ marginBottom: '16px' }}>
            <span className="app-alert__icon">⚠</span>
            {actionError}
          </div>
        ) : null}

        <div className="app-action-group">
          <button
            type="button"
            className="app-btn app-btn--success app-btn--lg"
            disabled={loading}
            onClick={() => onApprovalDecision('approve')}
          >
            <span className="app-btn__icon">✓</span>
            Approve APP
          </button>
          <button
            type="button"
            className="app-btn app-btn--warning app-btn--lg"
            disabled={loading}
            onClick={() => onApprovalDecision('return')}
          >
            <span className="app-btn__icon">↩</span>
            Return APP
          </button>
          <button
            type="button"
            className="app-btn app-btn--danger app-btn--lg"
            disabled={loading}
            onClick={() => onApprovalDecision('reject')}
          >
            <span className="app-btn__icon">✕</span>
            Reject APP
          </button>
        </div>
      </section>
    ) : null}

    {isAwaitingCgisApproval ? (
      <section className="app-card app-card--action">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">🛡</span>
            <h3 className="app-section-title__text">Awaiting CGIS Approval</h3>
          </div>
        </div>

        <div className="app-status-banner app-status-banner--info">
          <span className="app-status-banner__icon">ℹ</span>
          <p className="app-status-banner__text">Comptroller Procurement has approved this departmental plan. It has now been forwarded to CGIS for approval before procurement process begins.</p>
        </div>
      </section>
    ) : null}

    {canTakeApprovalDecision && isAtProcurementInitiation ? (
      <section className="app-card app-card--action">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">🚀</span>
            <h3 className="app-section-title__text">Procurement Initiation</h3>
          </div>
        </div>

        <div className="app-status-banner app-status-banner--success">
          <span className="app-status-banner__icon">✓</span>
          <p className="app-status-banner__text">This APP has been approved. Proceed to Threshold Resolution to determine the approval route.</p>
        </div>

        {thresholdSummary ? (
          <div className="app-threshold-info">
            <span className="app-threshold-info__label">Resolved Route:</span>
            <span className="app-threshold-info__value">{thresholdSummary}</span>
          </div>
        ) : null}

        <div className="app-card__footer">
          <button
            type="button"
            className="app-btn app-btn--primary app-btn--lg"
            disabled={loading}
            onClick={onInitiateProcurement}
          >
            <span className="app-btn__icon">🚀</span>
            Resolve Threshold Route
          </button>
        </div>
      </section>
    ) : null}
  </>
);
