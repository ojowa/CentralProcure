import type { ApprovalDetail, WorkflowActionSnapshotResponse } from '../../types/internal';

interface ApprovalDetailContentProps {
  detail: ApprovalDetail;
  isSelectedEditable: boolean;
  workflowSnapshot?: WorkflowActionSnapshotResponse | null;
  isWorkflowLoading: boolean;
  workflowError: string;
}

export const ApprovalDetailContent = ({
  detail,
  isSelectedEditable,
  workflowSnapshot,
  isWorkflowLoading,
  workflowError
}: ApprovalDetailContentProps) => {
  return (
    <div className="approval-detail-content">
      <div className="approval-detail-section">
        <h3>Approval Information</h3>
        <div className="approval-detail-grid">
          <div><span>Approval ID:</span><span>{detail.ApprovalId}</span></div>
          <div><span>Title:</span><span>{detail.Title}</span></div>
          <div><span>Category:</span><span>{detail.Category}</span></div>
          <div><span>Status:</span><span>{detail.Status}</span></div>
          <div><span>Amount:</span><span>{detail.Amount != null ? `$${detail.Amount.toLocaleString()}` : 'Not specified'}</span></div>
          <div><span>Priority:</span><span>{detail.Priority}</span></div>
          <div><span>Submitted By:</span><span>{detail.SubmittedBy}</span></div>
          <div><span>Submitted On:</span><span>{new Date(detail.SubmittedOn).toLocaleDateString()}</span></div>
        </div>
      </div>

      {detail.Requirements && (
        <div className="approval-detail-section">
          <h3>Requirements</h3>
          <p>{detail.Requirements}</p>
        </div>
      )}

      {detail.Conditions && (
        <div className="approval-detail-section">
          <h3>Conditions</h3>
          <p>{detail.Conditions}</p>
        </div>
      )}

      <div className="approval-detail-section">
        <h3>Workflow Context</h3>
        {isWorkflowLoading ? (
          <div className="plan-loading">Loading workflow context...</div>
        ) : (
          workflowError ? (
            <div className="portal-alert">{workflowError}</div>
          ) : (
            workflowSnapshot && (
              <div className="approval-workflow-info">
                <div><span>Current Stage:</span><span>{workflowSnapshot.CurrentStageTitle}</span></div>
                <div><span>Entity Type:</span><span>{workflowSnapshot.EntityType}</span></div>
                <div><span>Assigned Role:</span><span>{workflowSnapshot.RoleKey}</span></div>
                <div><span>Available Actions:</span><span>{workflowSnapshot.Actions?.length ? workflowSnapshot.Actions.map(action => action.ActionKey).join(', ') : 'None'}</span></div>
              </div>
            )
          )
        )}
      </div>

      <div className="approval-detail-section">
        <h3>Review History</h3>
        {detail.ReviewHistory && detail.ReviewHistory.length > 0 ? (
          <div className="review-history-list">
            {detail.ReviewHistory.map((review, index) => (
              <div key={index} className="review-history-item">
                <div><span>Reviewer:</span><span>{review.Reviewer}</span></div>
                <div><span>Action:</span><span>{review.Action}</span></div>
                <div><span>Timestamp:</span><span>{new Date(review.Timestamp).toLocaleString()}</span></div>
                {review.Comments && (
                  <div><span>Comments:</span><span>{review.Comments}</span></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No review history available.</p>
        )}
      </div>

      <div className="approval-detail-section">
        <h3>Notes</h3>
        <p>{detail.Description || 'No description provided.'}</p>
      </div>
    </div>
  );
};
