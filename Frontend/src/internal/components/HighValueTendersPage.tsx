'use client';

import { useEffect, useState } from 'react';
import { fetchApprovals, fetchApprovalDetail } from '../services/approvalService';
import type { InternalModule, ApprovalSummary, ApprovalDetail, RoleKey } from '../types/internal';
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

export const HighValueTendersPage = ({ module, token, role, userEmail, availableModuleIds = [], onModuleChange }: Props) => {
  const [filters, setFilters] = useState<{
    query: string;
    minValue: number;
    maxValue: number;
    page: number;
  }>({
    query: '',
    minValue: 1000000, // High value threshold: 1,000,000+
    maxValue: 100000000, // Up to 100M
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
      // Note: The backend endpoint doesn't currently support minValue/maxValue filtering
      // For now, we'll fetch all and filter client-side, or modify the backend later
      const response = await fetchApprovals(token, {
        query: filters.query.trim() || undefined,
        status: '', // We could add a status filter if needed
        category: '',
        page,
        pageSize
      });
      
      // Filter by amount client-side (in a real implementation, this would be done server-side)
      const filteredItems = response.Items.filter(approval => 
        (approval.Amount !== null && approval.Amount >= filters.minValue && approval.Amount <= filters.maxValue) ||
        (filters.minValue === 1000000 && filters.maxValue === 100000000) // Default high-value range
      );
      
      setApprovals(filteredItems);
      setTotalItems(response.Total); // Note: This is total approvals, not filtered count
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load high-value approvals.');
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    void loadApprovals();
  }, [token, filters.query, filters.minValue, filters.maxValue, filters.page, pageSize]);

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
  }, [selectedId, token]);

  useEffect(() => {
    if (!isDetailModalOpen) {
      setSelectedDetail(null);
    }
  }, [isDetailModalOpen]);

  // Workflow context loading (simplified)
  useEffect(() => {
    if (!role || !token || !selectedId) {
      setWorkflowSnapshot(null);
      setWorkflowError('');
      setIsWorkflowLoading(false);
      return;
    }

    setIsWorkflowLoading(true);
    setWorkflowError('');

    // In a real implementation, we would call workflow context services
    // For now, we'll simulate basic workflow data
    setTimeout(() => {
      setWorkflowSnapshot({
        EntityType: 'approval',
        EntityId: selectedId,
        CurrentStageKey: 'bpp-review',
        CurrentStageTitle: 'Under BPP Review',
        RoleKey: role ?? 'bpp_officer',
        Actions: ['approve', 'reject', 'request-revision']
      });
      setIsWorkflowLoading(false);
    }, 500);

    return () => {
      // Cleanup would go here
    };
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
          <span className="approval-badge approval-badge--accent">{summary.total} high-value approvals</span>
        </div>
      </div>

      <div className="approval-metrics" style={{ marginTop: '16px' }}>
        <div><span>Pending approvals</span><strong>{summary.pending}</strong></div>
        <div><span>Approved</span><strong>{summary.approved}</strong></div>
        <div><span>Rejected</span><strong>{summary.rejected}</strong></div>
        <div><span>Current role</span><strong>{role ? toTitle(role) : 'Unspecified'}</strong></div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div className="filter-controls">
          <label>
            Minimum Value (₦): 
            <input 
              type="number" 
              value={filters.minValue} 
              onChange={(e) => setFilters(prev => ({ ...prev, minValue: Number(e.target.value) || 0, page: 1 }))}
              min="0"
            />
          </label>
          <label>
            Maximum Value (₦): 
            <input 
              type="number" 
              value={filters.maxValue} 
              onChange={(e) => setFilters(prev => ({ ...prev, maxValue: Number(e.target.value) || 100000000, page: 1 }))}
              min="0"
            />
          </label>
        </div>
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
              {approval.Amount !== null && <p><strong>Amount:</strong> ${approval.Amount.toLocaleString()}</p>}
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
            <p>No high-value approvals match the current filters.</p>
          </div>
        )}
      </div>

      {isDetailModalOpen && selectedDetail ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setIsDetailModalOpen(false)} />
          <div className="plan-modal__content approval-detail-modal">
            <div className="approval-card__header">
              <div>
                <h3>High-Value Approval Detail Review</h3>
                <p>Review the complete high-value approval submission before making a BPP decision.</p>
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