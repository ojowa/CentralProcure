import React from 'react';
import styles from '../styles/planning-committee.module.css';
import type { MemberReview } from '../hooks/planningCommitteeTypes';
import type { PlanningCommitteeMemberStatus } from '../../../types/internal';

interface CommitteeStatusPanelProps {
  reviews: MemberReview[];
  statuses: PlanningCommitteeMemberStatus[];
  isReviewReopened?: boolean;
}

const committeeRoleLabels: Record<string, string> = {
  planning_statistics_officer: 'PSO Reviewed',
  financial_unit_officer: 'Finance Reviewed',
  department_head: 'Technical Reviewed',
  legal_reviewer: 'Legal Reviewed',
  procurement_secretary: 'Secretary Recorded'
};

const excludedCommitteeRoles = new Set(['requisitioning_officer', 'department_user']);

const normalizeRole = (value?: string | null) =>
  value ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';

export const CommitteeStatusPanel: React.FC<CommitteeStatusPanelProps> = ({
  reviews,
  statuses,
  isReviewReopened = false
}) => {
  const reviewStatusMap = reviews.reduce<Record<string, MemberReview>>((acc, review) => {
    const key = normalizeRole(review.ReviewerRole);
    if (!key || excludedCommitteeRoles.has(key)) return acc;
    acc[key] = review;
    return acc;
  }, {});

  const statusMap = statuses.reduce<Record<string, PlanningCommitteeMemberStatus>>((acc, status) => {
    const key = normalizeRole(status.RoleKey);
    if (!key || excludedCommitteeRoles.has(key)) return acc;
    acc[key] = status;
    return acc;
  }, {});

  const getDecisionClass = (decision?: string | null) => {
    if (!decision) return styles.statusPending;
    switch (decision.toLowerCase()) {
      case 'cleared':
      case 'approved':
        return styles.statusDone;
      case 'rejected':
        return styles.statusRejected;
      case 'queried':
        return styles.statusQueried;
      default:
        return styles.statusDone;
    }
  };

  return (
    <div className={styles.statusPanel}>
      {Object.entries(committeeRoleLabels).map(([roleKey, label]) => {
        const status = statusMap[roleKey];
        const review = reviewStatusMap[roleKey];
        const decision = isReviewReopened
          ? (status?.Decision ?? null)
          : (status?.Decision ?? review?.Decision);

        return (
          <div key={roleKey} className={styles.statusRow}>
            <span className={styles.statusLabel}>{label}</span>
            <span className={`${styles.statusBadge} ${getDecisionClass(decision)}`}>
              {decision ?? 'Pending'}
            </span>
          </div>
        );
      })}
    </div>
  );
};
