'use client';

import { requisitionStatusTone } from '../../utils/procureUtils';
import type { RequisitionSummary } from '../../types/internal';
import type { WorkspaceMode } from './helpers';
import { formatCurrency, formatDate } from '../../utils/procureUtils';

interface QuickLinksProps {
  mode: WorkspaceMode;
  onModuleChange?: (moduleId: string) => void;
  availableModuleIds?: string[];
}

export const RequisitionQuickLinks = ({ mode, onModuleChange, availableModuleIds = [] }: QuickLinksProps) => {
  const canViewCreate = availableModuleIds.includes('create-requisition');
  const canViewHistory = availableModuleIds.includes('requisition-history');
  const canViewTracking = availableModuleIds.includes('requisition-tracking');

  return (
    <div className="requisition-actions">
      {canViewCreate ? (
        <button type="button" className={`plan-button ${mode === 'create' ? '' : 'plan-button--secondary'}`} onClick={() => onModuleChange?.('create-requisition')}>
          Create Requisition
        </button>
      ) : null}
      {canViewHistory ? (
        <button type="button" className={`plan-button ${mode === 'history' ? '' : 'plan-button--secondary'}`} onClick={() => onModuleChange?.('requisition-history')}>
          Requisition History
        </button>
      ) : null}
      {canViewTracking ? (
        <button type="button" className={`plan-button ${mode === 'tracking' ? '' : 'plan-button--secondary'}`} onClick={() => onModuleChange?.('requisition-tracking')}>
          Requisition Tracking
        </button>
      ) : null}
    </div>
  );
};

interface DepartmentHeadQueueCardProps {
  queue: RequisitionSummary[];
  selectedId: string | null;
  onOpenDetail: (requisitionId: string, modal?: boolean) => void;
}

export const DepartmentHeadQueueCard = ({ queue, selectedId, onOpenDetail }: DepartmentHeadQueueCardProps) => {
  const submittedCount = queue.filter((record) => record.Status === 'Submitted').length;
  const draftCount = queue.filter((record) => record.Status === 'Draft' || record.Status === 'Rejected').length;
  const underReviewCount = queue.filter((record) => record.Status === 'Under Review').length;

  return (
    <article className="requisition-card">
      <div className="requisition-card__header">
        <div>
          <h3>Department Review Queue</h3>
          <p>Open departmental requests that still need head validation, endorsement, or follow-up.</p>
        </div>
        <span className="requisition-tag requisition-tag--accent">{queue.length} in queue</span>
      </div>
      <div className="requisition-summary">
        <div><span>Needs submission</span><strong>{draftCount}</strong></div>
        <div><span>Awaiting confirmation</span><strong>{submittedCount}</strong></div>
        <div><span>Already under review</span><strong>{underReviewCount}</strong></div>
      </div>
      <div className="requisition-tracking-cards">
        {queue.slice(0, 5).map((record) => (
          <button
            type="button"
            key={`department-head-${record.RequisitionId}`}
            className={`requisition-track-card ${record.RequisitionId === selectedId ? 'requisition-track-card--active' : ''}`.trim()}
            onClick={() => onOpenDetail(record.RequisitionId, true)}
          >
            <div>
              <h4>{record.Title}</h4>
              <p>{record.Department} · {formatDate(record.RequiredBy)}</p>
            </div>
            <div className="requisition-badges">
              <span className={`req-badge ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span>
              <span className="req-badge req-badge--soft">{formatCurrency(record.TotalEstimate)}</span>
            </div>
          </button>
        ))}
        {!queue.length ? <div className="plan-empty">No requisitions currently need department head intervention.</div> : null}
      </div>
    </article>
  );
};
