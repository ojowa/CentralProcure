'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchRequisitionDetail, fetchRequisitions, updateRequisition, deleteRequisition } from '../services/requisitionService';
import { fetchWorkflowRuntime, fetchWorkflowRuntimeHistory } from '../services/workflowContextService';
import { usePermission } from '../hooks/usePermission';
import type {
  InternalModule,
  RequisitionDetail,
  RequisitionSummary,
  RoleKey,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../types/internal';
import { getPageSize, getStepIndex, type FiltersState } from './requisitionWorkspace/helpers';
import { RequisitionDetailContent } from './requisitionWorkspace/detailViews';
import { RequisitionHistoryView } from './requisitionWorkspace/sectionViews';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

type RequisitionAuthority = {
  IsEditable?: boolean;
  CanEdit?: boolean;
  CanDelete?: boolean;
  CanRoute?: boolean;
};
type RequisitionDetailWithAuthority = RequisitionDetail & { Authority?: RequisitionAuthority | null };

export const AdminRequisitionManagementPage = ({ module, token, role, userEmail, availableModuleIds = [], onModuleChange }: Props) => {
  const { hasPermission } = usePermission(token);
  const mode = 'history';
  const pageSize = getPageSize(mode);

  const [filters, setFilters] = useState<FiltersState>({
    query: '',
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
    page: 1
  });
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<RequisitionDetailWithAuthority | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [workflowRuntime, setWorkflowRuntime] = useState<WorkflowRuntimeSnapshot | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowRuntimeHistoryEntry[]>([]);
  const [workflowError, setWorkflowError] = useState('');
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);

  const activeStepIndex = getStepIndex(selectedDetail);
  const canEditDrafts = Boolean(selectedDetail?.Authority?.CanEdit);
  const canDelete = Boolean(selectedDetail?.Authority?.CanDelete);
  const canRoute = Boolean(selectedDetail?.Authority?.CanRoute);
  const isSelectedEditable = Boolean(selectedDetail?.Authority?.IsEditable);
  const canApproveForPlanningCommittee = canRoute && selectedDetail?.Status === 'Initial';
  const canOpenCreateModule = availableModuleIds.includes('create-requisition');

  const summary = useMemo(() => {
    const counts = requisitions.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.Status] = (accumulator[record.Status] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      total: totalItems,
      drafts: (counts.Draft ?? 0) + (counts.Submitted ?? 0) + (counts.Endorsed ?? 0),
      active: (counts.Initial ?? 0) + (counts['Under Review'] ?? 0) + (counts.Evaluation ?? 0) + (counts['Board Review'] ?? 0),
      approved: counts.Approved ?? 0
    };
  }, [requisitions, totalItems]);

  const pageStart = totalItems === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(totalItems, filters.page * pageSize);

  const loadRequisitions = async (pageOverride?: number) => {
    if (!token) {
      setRequisitions([]);
      setTotalItems(0);
      return;
    }

    const page = pageOverride ?? filters.page;

    setIsListLoading(true);
    setListError('');
    try {
      const response = await fetchRequisitions(token, {
        query: filters.query.trim() || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page,
        pageSize
      });
      setRequisitions(response.Items);
      setTotalItems(response.Total);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load requisitions.');
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    void loadRequisitions();
  }, [token, filters.query, filters.status, filters.priority, filters.dateFrom, filters.dateTo, filters.page, pageSize]);

  useEffect(() => {
    if (!token || !selectedId) {
      setSelectedDetail(null);
      return;
    }

    let isMounted = true;
    setIsDetailLoading(true);

    fetchRequisitionDetail(token, selectedId)
      .then((detail) => {
        if (isMounted) {
          setSelectedDetail(detail as RequisitionDetailWithAuthority);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setListError(error instanceof Error ? error.message : 'Unable to load requisition detail.');
          setSelectedDetail(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedId, token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setWorkflowRuntime(null);
      setWorkflowHistory([]);
      setWorkflowError('');
      setIsWorkflowLoading(false);
      return;
    }

    let isMounted = true;
    setIsWorkflowLoading(true);
    setWorkflowError('');

    Promise.allSettled([
      fetchWorkflowRuntime(token, 'requisition', selectedId),
      fetchWorkflowRuntimeHistory(token, 'requisition', selectedId)
    ])
      .then(([runtimeResult, historyResult]) => {
        if (!isMounted) {
          return;
        }

        setWorkflowRuntime(runtimeResult.status === 'fulfilled' ? runtimeResult.value : null);
        setWorkflowHistory(historyResult.status === 'fulfilled' ? historyResult.value : []);

        const firstError =
          (runtimeResult.status === 'rejected' ? runtimeResult.reason : null) ??
          (historyResult.status === 'rejected' ? historyResult.reason : null);

        setWorkflowError(firstError instanceof Error ? firstError.message : firstError ? 'Unable to load workflow context.' : '');
      })
      .finally(() => {
        if (isMounted) {
          setIsWorkflowLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedId, token]);

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      page: key === 'page' ? Number(value) : 1
    }));
  };

  const openDetail = (requisitionId: string, modal = false) => {
    setSelectedId(requisitionId);
    setIsDetailModalOpen(modal);
  };

  const handleDeleteRequisition = async () => {
    if (!token || !selectedDetail || !canDelete) {
      return;
    }

    if (!confirm(`ADMIN OVERRIDE: Are you sure you want to PERMANENTLY DELETE requisition "${selectedDetail.Title}"? This action bypasses all workflow guards and cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteRequisition(token, selectedDetail.RequisitionId);
      setIsDetailModalOpen(false);
      setSelectedId(null);
      setSelectedDetail(null);
      await loadRequisitions();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete requisition.');
    } finally {
      setIsSaving(false);
    }
  };

  const openSelectedForEdit = () => {
    const EDIT_STORAGE_KEY = 'internal.requisitioningOfficer.editDraft';
    if (!selectedDetail || !onModuleChange) {
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(selectedDetail));
    }

    setIsDetailModalOpen(false);
    onModuleChange('create-requisition');
  };

  const submitSelectedDraft = async () => {
    if (!token || !selectedDetail || !isSelectedEditable || !canEditDrafts) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateRequisition(token, selectedDetail.RequisitionId, {
        Status: 'Submitted'
      });
      setSelectedDetail(updated);
      await loadRequisitions();
    } finally {
      setIsSaving(false);
    }
  };

  const approveForPlanningCommittee = async () => {
    if (!token || !selectedDetail || !canRoute || !canApproveForPlanningCommittee) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateRequisition(token, selectedDetail.RequisitionId, {
        Status: 'Under Review'
      });
      setSelectedDetail(updated);
      await loadRequisitions();
      setListError('');
      setModalError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to approve requisition.';
      setListError(message);
      setModalError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const returnToDepartment = async () => {
    if (!token || !selectedDetail || !canRoute) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateRequisition(token, selectedDetail.RequisitionId, {
        Status: 'Draft'
      });
      setSelectedDetail(updated);
      await loadRequisitions();
      setListError('');
      setModalError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to return requisition.';
      setListError(message);
      setModalError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module">
      <div className="requisition-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded tracking-wider ${hasPermission('requisition.endorse') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {hasPermission('requisition.endorse') ? 'Comptroller Procurement' : 'Admin Only'}
            </span>
            <h2 className="text-2xl font-bold text-slate-900">
              {hasPermission('requisition.endorse') ? 'Comptroller Procurement' : module.title}
            </h2>
          </div>
          <p className="text-slate-500">
            {hasPermission('requisition.endorse')
              ? 'Review submitted requisitions and clear them for Planning Committee review.'
              : 'Global administrative oversight and management of all agency procurement requisitions.'}
          </p>
        </div>
        <div className="requisition-badges">
          <span className="req-badge req-badge--soft">System Admin</span>
          <span className="req-badge req-badge--accent">{summary.total} global requisitions</span>
        </div>
      </div>

      <div className="requisition-metrics" style={{ marginTop: '16px' }}>
        <div><span>Drafts</span><strong>{summary.drafts}</strong></div>
        <div><span>Active Workflow</span><strong>{summary.active}</strong></div>
        <div><span>Approved</span><strong>{summary.approved}</strong></div>
        <div>
          <span>{hasPermission('requisition.endorse') ? 'Procurement Control' : 'Admin Control'}</span>
          <strong>Active</strong>
        </div>
      </div>

      {!token ? <div className="portal-alert" style={{ marginTop: '16px' }}>Authentication token is missing.</div> : null}
      {listError ? <div className="portal-alert" style={{ marginTop: '16px' }}>{listError}</div> : null}

      <div style={{ marginTop: '16px' }}>
        <RequisitionHistoryView
          filters={filters}
          requisitions={requisitions}
          totalItems={totalItems}
          pageStart={pageStart}
          pageEnd={pageEnd}
          isListLoading={isListLoading}
          isDepartmentHead={false}
          onFilterChange={updateFilter}
          onRefresh={() => void loadRequisitions()}
          onOpenDetail={openDetail}
        />
      </div>

      {isDetailModalOpen && selectedDetail ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setIsDetailModalOpen(false)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 text-white text-[9px] font-bold uppercase rounded tracking-wider ${hasPermission('requisition.endorse') ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {hasPermission('requisition.endorse') ? 'Procurement Review' : 'Admin Console'}
                  </span>
                  <h3>Requisition Detail</h3>
                </div>
                <p>{hasPermission('requisition.endorse') ? 'Validate readiness before Planning Committee review.' : 'Global oversight of request content and routing history.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
            {isDetailLoading ? (
              <div className="plan-loading">Loading requisition detail...</div>
            ) : (
              <RequisitionDetailContent
                  detail={selectedDetail}
                  activeStepIndex={activeStepIndex}
                  isSelectedEditable={isSelectedEditable}
      isDepartmentHead={false}
      isAdmin={hasPermission('requisition.view.all')}
      canEditDrafts={canEditDrafts}
      canOpenSelectedForEdit={canOpenCreateModule}
      isSaving={isSaving}
                  workflowRuntime={workflowRuntime}
                  onOpenSelectedForEdit={openSelectedForEdit}
                  onSubmitSelectedDraft={() => void submitSelectedDraft()}
                onDeleteRequisition={() => void handleDeleteRequisition()}
              />
            )}

            {modalError ? <div className="portal-alert" style={{ marginTop: '12px' }}>{modalError}</div> : null}
            
            {hasPermission('requisition.endorse') && selectedDetail?.Status === 'Initial' && (
              <div className="plan-actions" style={{ marginTop: '16px' }}>
                <button type="button" className="plan-button" onClick={() => void approveForPlanningCommittee()} disabled={!canRoute || isSaving}>
                  Approve for Planning Committee
                </button>
                <button type="button" className="plan-button plan-button--secondary" onClick={() => void returnToDepartment()} disabled={!canRoute || isSaving}>
                  Return to Department
                </button>
              </div>
            )}

            {workflowHistory.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold uppercase text-slate-400 tracking-widest mb-4">Audit / Workflow History</h4>
                <table className="plan-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Stage</th>
                      <th>Status</th>
                      <th>Reason / Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflowHistory.map((entry) => (
                      <tr key={entry.HistoryId}>
                        <td className="text-xs font-mono">{new Date(entry.CreatedAt).toLocaleString()}</td>
                        <td>{entry.ToStageTitle}</td>
                        <td><span className="req-badge req-badge--soft">{entry.StageStatus || 'Recorded'}</span></td>
                        <td className="text-xs italic text-slate-500">{entry.TransitionReason || entry.TransitionSource}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};

