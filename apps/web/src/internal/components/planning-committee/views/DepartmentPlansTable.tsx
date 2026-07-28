import React, { useMemo, useState } from 'react';
import styles from '../styles/planning-committee.module.css';
import type { ProcurementPlanSummary } from '../../../types/internal';
import { usePermission } from '../../../hooks/usePermission';
import {
  fetchProcurementPlanRecommendationReadiness,
  recommendProcurementPlanForApproval
} from '../../../services/procurementPlanService';
import { PlanRequisitionsModal } from './PlanRequisitionsModal';
import type { ProcurementPlanRecommendationReadinessResponse } from '../../../services/procurementPlanService.shared';

interface DepartmentPlansTableProps {
  token: string | null;
  role?: string | null;
  plans: ProcurementPlanSummary[];
  onPlanSelect?: (planId: string) => void;
  onPlanRecommended?: () => Promise<void> | void;
  onExportCsv?: () => void;
  formatCurrency: (value: number) => string;
  isLoading?: boolean;
}

export const DepartmentPlansTable: React.FC<DepartmentPlansTableProps> = ({
  token,
  role,
  plans,
  onPlanSelect,
  onPlanRecommended,
  onExportCsv,
  formatCurrency,
  isLoading
}) => {
  const { hasPermission } = usePermission(token);
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; title: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recommendPlan, setRecommendPlan] = useState<ProcurementPlanSummary | null>(null);
  const [readinessByPlanId, setReadinessByPlanId] = useState<Record<string, ProcurementPlanRecommendationReadinessResponse>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendNote, setRecommendNote] = useState('');
  const canRequestApproval = hasPermission('procurement_plan.approve');
  React.useEffect(() => {
    if (!token || !canRequestApproval || plans.length === 0) return;
    let disposed = false;
    void Promise.all(
      plans.map(async (plan) => {
        try {
          const readiness = await fetchProcurementPlanRecommendationReadiness(token, plan.PlanId);
          return [plan.PlanId, readiness] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (disposed) return;
      setReadinessByPlanId((prev) => {
        const next = { ...prev };
        results.forEach((entry) => {
          if (!entry) return;
          next[entry[0]] = entry[1];
        });
        return next;
      });
    });
    return () => {
      disposed = true;
    };
  }, [token, canRequestApproval, plans]);

  const canRecommendPlan = (plan: ProcurementPlanSummary) =>
    canRequestApproval &&
    plan.Status !== 'Approved' &&
    String(plan.CurrentStageKey || '').toLowerCase() === 'planning_committee_review' &&
    readinessByPlanId[plan.PlanId]?.CanRecommend === true;

  // Group plans by department
  const groupedByDepartment = useMemo(() => {
    const groups: Record<string, ProcurementPlanSummary[]> = {};
    plans.forEach((plan) => {
      const dept = plan.Department || 'Unassigned';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(plan);
    });
    return groups;
  }, [plans]);

  const departments = Object.keys(groupedByDepartment).sort();

  const totalBudget = useMemo(
    () => plans.reduce((sum, plan) => sum + plan.TotalBudget, 0),
    [plans]
  );

  const handlePlanClick = (plan: ProcurementPlanSummary) => {
    setSelectedPlan({ id: plan.PlanId, title: plan.PlanTitle });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedPlan(null);
    setIsModalOpen(false);
  };

  const openRecommendModal = (plan: ProcurementPlanSummary) => {
    setRecommendPlan(plan);
    setFeedback(null);
    setError(null);
    setRecommendError(null);
    setRecommendNote('');
  };

  const closeRecommendModal = () => {
    setRecommendPlan(null);
    setSubmitting(false);
    setRecommendError(null);
    setRecommendNote('');
  };

  const handleRequestApproval = async () => {
    if (!token || !recommendPlan) return;
    setSubmitting(true);
    setError(null);
    setRecommendError(null);
    setFeedback(null);
    try {
      const result = await recommendProcurementPlanForApproval(token, recommendPlan.PlanId, {
        Note: recommendNote.trim() || null
      });
      setFeedback(result.Message);
      await onPlanRecommended?.();
      closeRecommendModal();
    } catch (err: any) {
      setRecommendError(err.message || 'Failed to recommend plan to Comptroller Procurement.');
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.empty}>
        <span style={{ fontSize: '1.5rem' }}>⏳</span>
        <p>Loading department plans...</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className={styles.empty}>
        <span style={{ fontSize: '1.5rem' }}>📋</span>
        <p>No departmental plans available.</p>
        <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
          Plans will appear when procurement plans are created and submitted.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.panel}>
        {error ? <div className="portal-alert" style={{ marginBottom: '16px' }}>{error}</div> : null}
        {feedback ? (
          <div className="portal-alert portal-alert--success" style={{ marginBottom: '16px', background: '#dcfce7', borderColor: '#86efac', color: '#166534' }}>
            {feedback}
          </div>
        ) : null}
        {/* Summary Cards */}
        <div className={styles.metrics} style={{ marginBottom: '20px' }}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Total Departments</span>
            <strong className={styles.metricValue}>{departments.length}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Total Plans</span>
            <strong className={styles.metricValue}>{plans.length}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Combined Budget</span>
            <strong className={styles.metricValue}>{formatCurrency(totalBudget)}</strong>
          </div>
        </div>

        {/* Department Tables */}
        <div className={styles.departmentPlansContainer}>
          {departments.map((department) => {
            const deptPlans = groupedByDepartment[department];
            const deptBudget = deptPlans.reduce((sum, p) => sum + p.TotalBudget, 0);

            return (
              <div key={department} className={styles.departmentSection}>
                <div className={styles.departmentHeader}>
                  <div className={styles.departmentTitleGroup}>
                    <h4 className={styles.departmentTitle}>{department}</h4>
                    <span className={styles.departmentMeta}>
                      {deptPlans.length} plans · {formatCurrency(deptBudget)}
                    </span>
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Plan Title</th>
                        <th>Fiscal Year</th>
                        <th>Status</th>
                        <th className={styles.numericCell}>Total Budget</th>
                        <th>Created</th>
                        <th className={styles.actionCell}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptPlans.map((plan) => (
                        <tr
                          key={plan.PlanId}
                          className={styles.tableRow}
                          onClick={() => handlePlanClick(plan)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className={styles.cellStrong}>{plan.PlanTitle}</td>
                          <td>{plan.FiscalYear}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${
                              plan.Status === 'Approved' ? styles.statusSuccess :
                              plan.Status === 'Under Review' ? styles.statusWarning :
                              plan.Status === 'Rejected' ? styles.statusDanger :
                              styles.statusNeutral
                            }`}>
                              {plan.Status}
                            </span>
                          </td>
                          <td className={styles.numericCell}>{formatCurrency(plan.TotalBudget)}</td>
                          <td>{new Date(plan.CreatedAt).toLocaleDateString()}</td>
                          <td className={styles.actionCell}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button
                                className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlanClick(plan);
                                }}
                              >
                                View Requisitions
                              </button>
                              {canRecommendPlan(plan) ? (
                                <button
                                  className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRecommendModal(plan);
                                  }}
                                >
                                  Recommend to Comptroller
                                </button>
                              ) : canRequestApproval && String(plan.CurrentStageKey || '').toLowerCase() === 'planning_committee_review' ? (
                                <button
                                  className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                                  disabled
                                  title={readinessByPlanId[plan.PlanId]?.Message || 'This departmental plan is not ready for recommendation yet.'}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                >
                                  Recommend to Comptroller
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Export Button */}
        {onExportCsv && (
          <div style={{ marginTop: '20px', textAlign: 'right' }}>
            <button
              className="plan-button plan-button--secondary"
              onClick={onExportCsv}
            >
              Export Department Plans CSV
            </button>
          </div>
        )}
      </div>

      {/* Plan Requisitions Modal */}
      <PlanRequisitionsModal
        token={token}
        planId={selectedPlan?.id || null}
        planTitle={selectedPlan?.title || ''}
        isOpen={isModalOpen}
        onClose={closeModal}
        formatCurrency={formatCurrency}
      />

      {recommendPlan ? (
        <div className={styles.modalOverlay} onClick={closeRecommendModal}>
          <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Recommend to Comptroller Procurement</h3>
                <p className="plan-muted">This action sends the departmental plan forward for approval.</p>
              </div>
              <button className={styles.closeButton} onClick={closeRecommendModal}>×</button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div><strong>Plan Title:</strong> {recommendPlan.PlanTitle}</div>
              <div><strong>Department:</strong> {recommendPlan.Department}</div>
              <div><strong>Status:</strong> {recommendPlan.Status}</div>
              <div><strong>Workflow Stage:</strong> {recommendPlan.CurrentStageTitle || recommendPlan.CurrentStageKey || 'Unknown'}</div>
              <div><strong>Total Budget:</strong> {formatCurrency(recommendPlan.TotalBudget)}</div>
              <p className="plan-muted" style={{ margin: 0 }}>
                Procurement Secretary will recommend this departmental plan to Comptroller Procurement for approval.
              </p>
              <label style={{ display: 'grid', gap: '6px' }}>
                <strong>Recommendation Note</strong>
                <textarea
                  value={recommendNote}
                  onChange={(event) => setRecommendNote(event.target.value)}
                  rows={4}
                  placeholder="Enter notes for Comptroller Procurement."
                  style={{ width: '100%', minHeight: '96px', resize: 'vertical' }}
                />
              </label>
              {recommendError ? (
                <div className="portal-alert" style={{ marginTop: '4px' }}>
                  {recommendError}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="plan-button plan-button--secondary" onClick={closeRecommendModal} disabled={submitting}>
                Cancel
              </button>
              <button className="plan-button" onClick={() => void handleRequestApproval()} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Recommend to Comptroller'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default DepartmentPlansTable;
