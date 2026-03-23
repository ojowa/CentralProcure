import type { ProcurementPlanDetail } from '../types/internal';
import type { ProcurementPlanRecommendationReadinessResponse } from '../services/procurementPlanService';

type Props = {
  selectedPlan: ProcurementPlanDetail;
  loading: boolean;
  approvalNote: string;
  thresholdSummary: string | null;
  canRecommendApp: boolean;
  canTakeApprovalDecision: boolean;
  recommendationReadiness: ProcurementPlanRecommendationReadinessResponse | null;
  isAwaitingAppApproval: boolean;
  isAtProcurementInitiation: boolean;
  onApprovalNoteChange: (value: string) => void;
  onRecommendForApproval: () => void;
  onApprovalDecision: (decision: 'approve' | 'return' | 'reject') => void;
  onInitiateProcurement: () => void;
};

export const ProcurementPlanActionsPanel = ({
  selectedPlan,
  loading,
  approvalNote,
  thresholdSummary,
  canRecommendApp,
  canTakeApprovalDecision,
  recommendationReadiness,
  isAwaitingAppApproval,
  isAtProcurementInitiation,
  onApprovalNoteChange,
  onRecommendForApproval,
  onApprovalDecision,
  onInitiateProcurement
}: Props) => (
  <>
    {canRecommendApp ? (
      <div className="portal-module-card" style={{ marginTop: '16px' }}>
        <h3>Secretary Recommendation</h3>
        <p className="plan-muted">
          {recommendationReadiness?.Message || 'Recommendation readiness is loading.'}
        </p>
        {recommendationReadiness ? (
          <>
            <div className="plan-summary-card__grid" style={{ marginTop: '12px' }}>
              <div>
                <small>Tracked Requisitions</small>
                <p>{recommendationReadiness.TotalTrackedRequisitions}</p>
              </div>
              <div>
                <small>Recommended</small>
                <p>{recommendationReadiness.RecommendedRequisitions}</p>
              </div>
              <div>
                <small>Pending Final Decision</small>
                <p>{recommendationReadiness.PendingFinalDecisionRequisitions}</p>
              </div>
              <div>
                <small>Returned / Rejected</small>
                <p>{recommendationReadiness.NonRecommendedRequisitions}</p>
              </div>
            </div>
            {recommendationReadiness.Requisitions.length > 0 ? (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>Tied Requisitions</h4>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {recommendationReadiness.Requisitions.map((item) => (
                    <div key={item.RequisitionId} className="plan-summary-card">
                      <div className="plan-summary-card__grid">
                        <div>
                          <small>Requisition</small>
                          <p>{item.Title}</p>
                        </div>
                        <div>
                          <small>Department</small>
                          <p>{item.Department}</p>
                        </div>
                        <div>
                          <small>Committee Decision</small>
                          <p>{item.FinalCommitteeDecision || 'Pending'}</p>
                        </div>
                        <div>
                          <small>APP Item</small>
                          <p>{item.AppItemId ? 'Created' : 'Not Created'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="portal-form-actions">
          <button type="button" className="plan-button" disabled={loading || !recommendationReadiness?.CanRecommend} onClick={onRecommendForApproval}>
            Recommend APP to Comptroller
          </button>
        </div>
      </div>
    ) : null}

    {canTakeApprovalDecision ? (
      <div className="portal-module-card" style={{ marginTop: '16px' }}>
        <h3>APP Approval Decision</h3>
        <p className="plan-muted">
          {isAwaitingAppApproval
            ? 'This plan is awaiting APP approval. Record your decision below.'
            : 'This plan is not currently in APP Approval stage.'}
        </p>
        <label className="plan-field" style={{ marginTop: '12px' }}>
          <span>Approval Note</span>
          <textarea
            className="plan-input"
            rows={3}
            value={approvalNote}
            onChange={(event) => onApprovalNoteChange(event.target.value)}
            placeholder="Record approval rationale, return instruction, or rejection reason."
            disabled={loading || !isAwaitingAppApproval}
          />
        </label>
        <div className="portal-form-actions">
          <button type="button" className="plan-button" disabled={loading || !isAwaitingAppApproval} onClick={() => onApprovalDecision('approve')}>
            Approve APP
          </button>
          <button type="button" className="plan-button plan-button--secondary" disabled={loading || !isAwaitingAppApproval} onClick={() => onApprovalDecision('return')}>
            Return APP
          </button>
          <button type="button" className="plan-button plan-button--ghost" disabled={loading || !isAwaitingAppApproval} onClick={() => onApprovalDecision('reject')}>
            Reject APP
          </button>
        </div>
      </div>
    ) : null}

    {canTakeApprovalDecision ? (
      <div className="portal-module-card" style={{ marginTop: '16px' }}>
        <h3>Procurement Initiation</h3>
        <p className="plan-muted">
          {isAtProcurementInitiation
            ? 'This APP has been approved. Move it into Threshold Resolution to determine the live approval route.'
            : 'This step becomes available after APP approval moves the plan into Procurement Initiation.'}
        </p>
        {thresholdSummary ? <p className="plan-muted" style={{ marginTop: '8px' }}>{thresholdSummary}</p> : null}
        <div className="portal-form-actions">
          <button type="button" className="plan-button" disabled={loading || !isAtProcurementInitiation} onClick={onInitiateProcurement}>
            Resolve Threshold Route
          </button>
        </div>
      </div>
    ) : null}
  </>
);
