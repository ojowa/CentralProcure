import type { TenderDetail, WorkflowActionSnapshotResponse } from '../types/internal';

interface TenderDetailContentProps {
  detail: TenderDetail;
  isSelectedEditable: boolean;
  workflowSnapshot?: WorkflowActionSnapshotResponse | null;
  isWorkflowLoading: boolean;
  workflowError: string;
}

export const TenderDetailContent = ({
  detail,
  isSelectedEditable,
  workflowSnapshot,
  isWorkflowLoading,
  workflowError
}: TenderDetailContentProps) => {
  return (
    <div className="tender-detail-content">
      <div className="tender-detail-section">
        <h3>Tender Information</h3>
        <div className="tender-detail-grid">
          <div><span>Tender ID:</span><span>{detail.TenderId}</span></div>
          <div><span>Title:</span><span>{detail.Title}</span></div>
          <div><span>Category:</span><span>{detail.Category}</span></div>
          <div><span>Status:</span><span>{detail.Status}</span></div>
          <div><span>Budget:</span><span>{detail.Budget !== null ? `$${detail.Budget.toLocaleString()}` : 'Not specified'}</span></div>
          <div><span>Department:</span><span>{detail.Department ?? 'Not specified'}</span></div>
          <div><span>Published:</span><span>{new detail.PublishDate ? new Date(detail.PublishDate).toLocaleDateString() : 'Not scheduled'}</span></div>
          <div><span>Opening Date:</span><span>{detail.OpeningDate ? new Date(detail.OpeningDate).toLocaleDateString() : 'Not scheduled'}</span></div>
          <div><span>Closing Date:</span><span>{detail.ClosingDate ? new Date(detail.ClosingDate).toLocaleDateString() : 'Not scheduled'}</span></div>
        </div>
      </div>

      {detail.Specifications && (
        <div className="tender-detail-section">
          <h3>Specifications</h3>
          <p>{detail.Specifications}</p>
        </div>
      )}

      {detail.EligibilityCriteria && (
        <div className="tender-detail-section">
          <h3>Eligibility Criteria</h3>
          <p>{detail.EligibilityCriteria}</p>
        </div>
      )}

      {detail.EvaluationCriteria && (
        <div className="tender-detail-section">
          <h3>Evaluation Criteria</h3>
          <p>{detail.EvaluationCriteria}</p>
        </div>
      )}

      <div className="tender-detail-section">
        <h3>Workflow Context</h3>
        {isWorkflowLoading ? (
          <div className="plan-loading">Loading workflow context...</div>
        ) : (
          workflowError ? (
            <div className="portal-alert">{workflowError}</div>
          ) : (
            workflowSnapshot && (
              <div className="tender-workflow-info">
                <div><span>Current Stage:</span><span>{workflowSnapshot.CurrentStageTitle}</span></div>
                <div><span>Entity Type:</span><span>{workflowSnapshot.EntityType}</span></div>
                <div><span>Assigned Role:</span><span>{workflowSnapshot.RoleKey}</span></div>
                <div><span>Available Actions:</span><span>{workflowSnapshot.Actions?.length ? workflowSnapshot.Actions.join(', ') : 'None'}</span></div>
              </div>
            )
          )
        )}
      </div>

      <div className="tender-detail-section">
        <h3>Notes</h3>
        <p>{detail.Description || 'No description provided.'}</p>
      </div>
    </div>
  );
};