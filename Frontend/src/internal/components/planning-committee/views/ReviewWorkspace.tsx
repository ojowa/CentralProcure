import React, { useState } from 'react';
import styles from '../styles/planning-committee.module.css';
import { CommitteeStatusPanel } from '../components/CommitteeStatusPanel';
import { MemberReviewForm } from '../components/MemberReviewForm';
import { FinalDecisionForm } from '../components/FinalDecisionForm';
import type { RequisitionSummary, ProcurementPlanDetail, ProcurementPlanItemDetail, PlanningCommitteeMemberStatus } from '../../../types/internal';
import type { MemberReview, PlanningCommitteeWorkspaceAuthority } from '../hooks/planningCommitteeTypes';
import type { CommitteeDecisionResponse } from '../../../services/planningCommitteeService';

interface ReviewWorkspaceProps {
  requisition: RequisitionSummary | null;
  plan: ProcurementPlanDetail | null;
  planItems: ProcurementPlanItemDetail[];
  memberReviews: MemberReview[];
  memberStatuses: PlanningCommitteeMemberStatus[];
  decision: CommitteeDecisionResponse | null;
  authority: PlanningCommitteeWorkspaceAuthority | null;
  loading: boolean;
  onSubmitReview: (decision: string, remarks: string) => Promise<boolean>;
  onSubmitFinalDecision: (decision: string, remarks: string) => Promise<boolean>;
  onLink: () => void;
  onUnlink: (reason: string) => Promise<boolean>;
  formatCurrency: (value: number) => string;
  downloadReviewsCsv: () => void;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({
  requisition,
  plan,
  planItems,
  memberReviews,
  memberStatuses,
  decision,
  authority,
  loading,
  onSubmitReview,
  onSubmitFinalDecision,
  onLink,
  onUnlink,
  formatCurrency,
  downloadReviewsCsv
}) => {
  const [unlinkReason, setUnlinkReason] = useState('');

  const canSubmitMemberReview = Boolean(authority?.CanSubmitMemberReview);
  const canSubmitFinalDecision = Boolean(authority?.CanSubmitFinalDecision);
  const canUnlink = Boolean(authority?.CanUnlink);
  const requiresUnlinkReason = Boolean(authority?.RequiresUnlinkReason);
  const hasFinalDecision = Boolean(decision);

  const handleReviewSubmit = async (decision: string, remarks: string) => {
    const success = await onSubmitReview(decision, remarks);
    if (success) {
      // Form will be cleared by parent
    }
  };

  const handleFinalSubmit = async (decision: string, remarks: string) => {
    const success = await onSubmitFinalDecision(decision, remarks);
    if (success) {
      // Parent handles state update
    }
  };

  const handleUnlink = async () => {
    const success = await onUnlink(unlinkReason);
    if (success) {
      setUnlinkReason('');
    }
  };

  const getStepStatus = () => {
    if (!requisition) return { link: 'pending', review: 'pending', decision: 'pending' };
    if (!requisition.AppItemId && !requisition.CommitteePlanId) {
      return { link: 'active', review: 'pending', decision: 'pending' };
    }
    const hasReviews = memberReviews.length > 0;

    return {
      link: 'completed',
      review: hasReviews ? 'completed' : 'active',
      decision: hasFinalDecision ? 'completed' : hasReviews ? 'active' : 'pending'
    };
  };

  const steps = getStepStatus();

  return (
    <div className={styles.workspace}>
      <div className={styles.workbench}>
        {/* Progress Stepper */}
        <div className={styles.stepper}>
          <div className={`${styles.step} ${styles[`step${steps.link.charAt(0).toUpperCase() + steps.link.slice(1)}`]}`}>
            <span className={styles.stepNumber}>{steps.link === 'completed' ? '✓' : '1'}</span>
            <span>Select Committee Plan</span>
          </div>
          <div className={`${styles.stepConnector} ${steps.link === 'completed' ? styles.stepCompleted : ''}`}></div>
          <div className={`${styles.step} ${styles[`step${steps.review.charAt(0).toUpperCase() + steps.review.slice(1)}`]}`}>
            <span className={styles.stepNumber}>{steps.review === 'completed' ? '✓' : '2'}</span>
            <span>Member Review</span>
          </div>
          <div className={`${styles.stepConnector} ${steps.review === 'completed' ? styles.stepCompleted : ''}`}></div>
          <div className={`${styles.step} ${styles[`step${steps.decision.charAt(0).toUpperCase() + steps.decision.slice(1)}`]}`}>
            <span className={styles.stepNumber}>{steps.decision === 'completed' ? '✓' : '3'}</span>
            <span>Final Decision</span>
          </div>
        </div>

        {/* Hero Card */}
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroKicker}>Requisition</div>
            <h3 className={styles.heroTitle}>{requisition?.Title ?? 'Select a requisition'}</h3>
            {requisition && (
              <div className={styles.heroMeta}>
                <span>📁 {requisition.Department}</span>
                <span>📊 {requisition.Status}</span>
                <span>💰 {formatCurrency(requisition.TotalEstimate)}</span>
                {requisition.RequiredBy && (
                  <span>📅 Due {new Date(requisition.RequiredBy).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
          <div className={styles.heroActions}>
            {!requisition?.AppItemId && !requisition?.CommitteePlanId ? (
              <button className="plan-button" onClick={onLink} disabled={loading}>
                Select Committee Plan
              </button>
            ) : (
              <span className="plan-badge plan-badge--approved">
                {requisition?.AppItemId ? 'APP Item Created' : 'Plan Selected'}
              </span>
            )}
          </div>
        </div>

        {/* Plan Summary */}
        {plan && (
          <div className={styles.summaryCard}>
            <h4>Selected Committee Plan</h4>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <small>Plan Title</small>
                <p>{plan.PlanTitle}</p>
              </div>
              <div className={styles.summaryItem}>
                <small>Department</small>
                <p>{plan.Department}</p>
              </div>
              <div className={styles.summaryItem}>
                <small>Fiscal Year</small>
                <p>{plan.FiscalYear}</p>
              </div>
              <div className={styles.summaryItem}>
                <small>Total Budget</small>
                <p>{formatCurrency(plan.TotalBudget)}</p>
              </div>
            </div>
          </div>
        )}

        {/* APP Line Items removed from workspace display */}
      </div>

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <h4>Requisition Committee Review</h4>
        <p className={styles.sidebarDescription}>Submit member remarks and then the final decision for this requisition.</p>

        {/* Committee Status */}
        <CommitteeStatusPanel
          reviews={memberReviews}
          statuses={memberStatuses}
        />

        {/* Export Reviews */}
        <button
          type="button"
          className="plan-button plan-button--secondary"
          onClick={downloadReviewsCsv}
          style={{ width: '100%', marginBottom: '16px' }}
          disabled={memberReviews.length === 0}
        >
          Export Reviews CSV
        </button>

        {/* Unlink Section (for authorized users) */}
        {canUnlink && (requisition?.AppItemId || requisition?.CommitteePlanId) && (
          <div className={styles.unlinkBlock} style={{ marginBottom: '16px' }}>
            <input
              className="plan-input"
              placeholder={requisition?.AppItemId ? 'Reason for unlinking' : 'Optional note'}
              value={unlinkReason}
              onChange={(e) => setUnlinkReason(e.target.value)}
            />
            <button
              className="plan-button plan-button--secondary"
              onClick={handleUnlink}
              disabled={loading || Boolean(requiresUnlinkReason && !unlinkReason.trim())}
              style={{ width: '100%' }}
            >
              {requisition?.AppItemId ? 'Unlink APP' : 'Unlink Plan'}
            </button>
          </div>
        )}

        {/* Member Review Form */}
        {canSubmitMemberReview && plan && !hasFinalDecision ? (
          <div style={{ marginTop: '16px' }}>
            <MemberReviewForm
              onSubmit={handleReviewSubmit}
              disabled={loading}
            />
          </div>
        ) : null}

        {/* Final Decision Form */}
        {hasFinalDecision ? (
          <div className={styles.summaryCard}>
            <h4>Final Decision Closed</h4>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <small>Decision</small>
                <p>{decision?.OverallDecision}</p>
              </div>
              <div className={styles.summaryItem}>
                <small>Meeting Date</small>
                <p>{decision?.MeetingDate ? new Date(decision.MeetingDate).toLocaleDateString() : 'Recorded'}</p>
              </div>
            </div>
            <p className={styles.sidebarDescription} style={{ marginTop: '12px' }}>
              {decision?.CommitteeRemarks || 'A final committee decision has already been recorded for this requisition.'}
            </p>
          </div>
        ) : null}

        {!hasFinalDecision && canSubmitFinalDecision && plan ? (
          <FinalDecisionForm
            onSubmit={handleFinalSubmit}
            disabled={loading}
          />
        ) : null}
      </aside>
    </div>
  );
};

