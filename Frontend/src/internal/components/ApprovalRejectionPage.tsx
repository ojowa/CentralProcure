'use client';

import { useEffect, useState } from 'react';
import { fetchApprovals, fetchApprovalDetail } from '../services/approvalService';
import { fetchWorkflowActionSnapshot } from '../services/workflowContextService';
import type { InternalModule, ApprovalSummary, ApprovalDetail, RoleKey, WorkflowActionSnapshotResponse } from '../types/internal';
import { ApprovalDetailContent } from './approvalWorkspace/detailViews';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import { canEditApprovalFromAuthority, toTitle } from './approvalWorkspace/helpers';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

export const ApprovalRejectionPage = ({ module, token, role, userEmail, availableModuleIds = [], onModuleChange }: Props) => {
  const [filters, setFilters] = useState<{
    query: string;
    status: string;
    category: string;
    page: number;
  }>({
    query: '',
    status: '',
    category: '',
    page: 1
  });

  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ApprovalDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<any>(null);
  const [workflowError, setWorkflowError] = useState('');
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);

  const pageSize = 10;

  const loadApprovals = async (pageOverride?: number) => {
    if (!token) {
      setApprovals([]);
      setTotalItems(0);
      return;
    }

    const page = pageOverride ?? filters.page;
    setIsListLoading(true);
    setListError('');

    try {
      const response = await fetchApprovals(token, {
        query: filters.query.trim() || undefined,
        status: filters.status || undefined,
        category: filters.category || undefined,
        page,
        pageSize
      });
      setApprovals(response.Items);
      setTotalItems(response.Total);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load approvals.');
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    void loadApprovals();
  }, [token, filters.query, filters.status, filters.category, filters.page, pageSize]);

  const openDetail = (approvalId: string, modal = false) => {
    setSelectedId(approvalId);
    setIsDetailModalOpen(modal);
  };

  const loadApprovalDetail = async () => {
    if (!token || !selectedId) {
      setSelectedDetail(null);
      return;
    }

    setIsDetailLoading(true);
    try {
      const detail = await fetchApprovalDetail(token, selectedId);
      if (detail) {
        setSelectedDetail(detail);
      } else {
        setSelectedDetail(null);
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load approval detail.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      void loadApprovalDetail();
    }
  }, [selectedId, token, approvals]);

  useEffect(() => {
    if (!isDetailModalOpen) {
      setSelectedDetail(null);
    }
  }, [isDetailModalOpen]);

  // Workflow context loading
  useEffect(() => {
    if (!role || !token || !selectedId) {
      setWorkflowSnapshot(null);
      setWorkflowError('');
      setIsWorkflowLoading(false);
      return;
    }

    const loadWorkflowContext = async () => {
      setIsWorkflowLoading(true);
      setWorkflowError('');

      try {
        // Fetch workflow action snapshot for the approval entity
        const workflowSnapshot = await fetchWorkflowActionSnapshot(
          token,
          'approval',
          selectedId
        );
        setWorkflowSnapshot(workflowSnapshot);
      } catch (error) {
        setWorkflowError(error instanceof Error ? error.message : 'Unable to load workflow context.');
      } finally {
        setIsWorkflowLoading(false);
      }
    };

    void loadWorkflowContext();
  }, [role, token, selectedId]);

  const summary = {
    total: totalItems,
    pending: approvals.filter(a => a.Status === 'Pending').length,
    approved: approvals.filter(a => a.Status === 'Approved').length,
    rejected: approvals.filter(a => a.Status === 'Rejected').length
  };

  return (
    <section className="portal-module">
      <div className="approval-header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="approval-badges">
          <span className="approval-badge approval-badge--soft">{module.microservice}</span>
          <span className="approval-badge approval-badge--accent">{summary.total} approvals</span>
        </div>
      </div>

      <div className="approval-metrics" style={{ marginTop: '16px' }}>
        <div><span>Pending approvals</span><strong>{summary.pending}</strong></div>
        <div><span>Approved</span><strong>{summary.approved}</strong></div>
        <div><span>Rejected</span><strong>{summary.rejected}</strong></div>
        <div><span>Current role</span><strong>{role ? toTitle(role) : 'Unspecified'}</strong></div>
      </div>

      <div style={{ marginTop: '16px' }}>
        {/* Quick links would go here in a full implementation */}
      </div>

      {!token ? <div className="portal-alert" style={{ marginTop: '16px' }}>Authentication token is missing.</div> : null}
      {listError ? <div className="portal-alert" style={{ marginTop: '16px' }}>{listError}</div> : null}

      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {approvals.map(approval => (
          <div key={approval.ApprovalId} className="approval-card">
            <div className="approval-card__header">
              <h3>{approval.Title}</h3>
              <p className="approval-card__status">{approval.Status}</p>
            </div>
            <div className="approval-card__body">
              <p><strong>Category:</strong> {approval.Category}</p>
              <p><strong>Submitted:</strong> {new Date(approval.SubmittedOn).toLocaleDateString()}</p>
              {approval.Amount != null && <p><strong>Amount:</strong> ${approval.Amount.toLocaleString()}</p>}
            </div>
            <div className="approval-card__actions">
              <button 
                type="button" 
                className="approval-button approval-button--secondary"
                onClick={() => openDetail(approval.ApprovalId, true)}
              >
                Review Details
              </button>
            </div>
          </div>
        ))}
        {approvals.length === 0 && !isListLoading && (
          <div className="portal-empty">
            <p>No approvals match the current filters.</p>
          </div>
        )}
      </div>

      {isDetailModalOpen && selectedDetail ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setIsDetailModalOpen(false)} />
          <div className="plan-modal__content approval-detail-modal">
            <div className="approval-card__header">
              <div>
                <h3>Approval Detail Review</h3>
                <p>Review the complete approval submission before making a decision.</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
            
            {isDetailLoading ? (
              <div className="plan-loading">Loading approval detail...</div>
            ) : (
              <ApprovalDetailContent
                detail={selectedDetail}
                isSelectedEditable={false} // Review mode is read-only
                workflowSnapshot={workflowSnapshot}
                isWorkflowLoading={isWorkflowLoading}
                workflowError={workflowError}
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
