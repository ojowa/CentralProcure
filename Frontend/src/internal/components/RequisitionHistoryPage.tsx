'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  editableRequisitionStatuses,
  requisitionRoleGuidance,
  thresholdBands,
  type BudgetLineItem
} from '../data/internalData';
import { fetchInternalUnits } from '../services/internalAuthService';
import { fetchBudgetSummary } from '../services/budgetService';
import { fetchProcurementPlanItems } from '../services/procurementPlanItemService';
import { fetchProcurementPlans } from '../services/procurementPlanService';
import { fetchRequisitionDetail, fetchRequisitions, updateRequisition, deleteRequisition } from '../services/requisitionService';
import {
  fetchWorkflowActionSnapshot,
  fetchWorkflowRuntime,
  fetchWorkflowRuntimeHistory
} from '../services/workflowContextService';
import type {
  BudgetSummaryResponse,
  InternalOrganizationalUnitRecord,
  InternalModule,
  RequisitionDetail,
  RequisitionSummary,
  RoleKey,
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../types/internal';
import { toTitle } from '../utils/procureUtils';
import {
  buildDepartmentHeadReviewNote,
  buildEmptyForm,
  buildFormFromDetail,
  DEPARTMENT_HEAD_QUEUE_STATUSES,
  getPageSize,
  getStepIndex,
  normalizeItemCatalog,
  resolveDepartmentHeadAction,
  toNumber,
  type FiltersState,
  type RequisitionFormState
} from './requisitionWorkspace/helpers';
import {
  DepartmentHeadPanel,
  RequisitionDetailContent,
  RequisitionQuickLinks
} from './requisitionWorkspace/detailViews';
import {
  RequisitionHistoryView
} from './requisitionWorkspace/sectionViews';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import { getHumanStatus } from '../utils/workflow';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

export const RequisitionHistoryPage = ({ module, token, role, userEmail, availableModuleIds = [], onModuleChange }: Props) => {
  const mode = 'history';
  const pageSize = getPageSize(mode);
  const isDepartmentHead = role === 'department_head';

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
  const [selectedDetail, setSelectedDetail] = useState<RequisitionDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<BudgetLineItem[]>([]);
  const [form, setForm] = useState<RequisitionFormState>(buildEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<WorkflowActionSnapshotResponse | null>(null);
  const [workflowRuntime, setWorkflowRuntime] = useState<WorkflowRuntimeSnapshot | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowRuntimeHistoryEntry[]>([]);
  const [workflowError, setWorkflowError] = useState('');
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [workflowRefreshKey, setWorkflowRefreshKey] = useState(0);

  const activeStepIndex = getStepIndex(selectedDetail);
  const canEditDrafts = Boolean(token && role && (role === 'requisitioning_officer' || role === 'department_head' || role === 'admin'));
  const canOpenCreateModule = availableModuleIds.includes('create-requisition');
  const isSelectedEditable = Boolean(selectedDetail && editableRequisitionStatuses.has(selectedDetail.Status));

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
          setSelectedDetail(detail);
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
    if (!isDepartmentHead || !token || !selectedId) {
      setWorkflowSnapshot(null);
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
      fetchWorkflowActionSnapshot(token, 'requisition', selectedId),
      fetchWorkflowRuntime(token, 'requisition', selectedId),
      fetchWorkflowRuntimeHistory(token, 'requisition', selectedId)
    ])
      .then(([snapshotResult, runtimeResult, historyResult]) => {
        if (!isMounted) {
          return;
        }

        setWorkflowSnapshot(snapshotResult.status === 'fulfilled' ? snapshotResult.value : null);
        setWorkflowRuntime(runtimeResult.status === 'fulfilled' ? runtimeResult.value : null);
        setWorkflowHistory(historyResult.status === 'fulfilled' ? historyResult.value : []);

        const firstError =
          (snapshotResult.status === 'rejected' ? snapshotResult.reason : null) ??
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
  }, [isDepartmentHead, selectedId, token, workflowRefreshKey]);

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

  const handleDeleteRequisition = async () => {
    if (!token || !selectedDetail || role !== 'admin') {
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete requisition "${selectedDetail.Title}"? This action cannot be undone.`)) {
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

  const applyDepartmentHeadAction = async () => {
    const actionConfig = resolveDepartmentHeadAction(selectedDetail);
    if (!token || !selectedDetail || !isDepartmentHead || !actionConfig) {
      return;
    }

    setIsSaving(true);
    setReviewError('');
    setReviewFeedback('');

    try {
      const updated = await updateRequisition(token, selectedDetail.RequisitionId, {
        Status: actionConfig.nextStatus,
        RiskNotes: buildDepartmentHeadReviewNote(
          selectedDetail.RiskNotes,
          reviewNote,
          actionConfig.nextStatus,
          userEmail
        )
      });

      setSelectedDetail(updated);
      setSelectedId(updated.RequisitionId);
      setReviewNote('');
      
      await loadRequisitions(filters.page);
      setWorkflowRefreshKey((previous) => previous + 1);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Unable to record department head review.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module">
      <div className="requisition-header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="requisition-badges">
          <span className="req-badge req-badge--soft">{module.microservice}</span>
          <span className="req-badge req-badge--accent">{summary.total} requisitions</span>
        </div>
      </div>

      <div className="requisition-metrics" style={{ marginTop: '16px' }}>
        <div><span>Drafts in scope</span><strong>{summary.drafts}</strong></div>
        <div><span>Active workflow items</span><strong>{summary.active}</strong></div>
        <div><span>Approved requests</span><strong>{summary.approved}</strong></div>
        <div><span>Current role</span><strong>{role ? toTitle(role) : 'Unspecified'}</strong></div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <RequisitionQuickLinks mode={mode} onModuleChange={onModuleChange} availableModuleIds={availableModuleIds} />
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
          isDepartmentHead={isDepartmentHead}
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
                <h3>Requisition Detail</h3>
                <p>Review the full request content and current routing state.</p>
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
      isDepartmentHead={isDepartmentHead}
      isAdmin={role === 'admin'}
      canEditDrafts={canEditDrafts}
      canOpenSelectedForEdit={canOpenCreateModule}
      isSaving={isSaving}
                workflowRuntime={workflowRuntime}
                onOpenSelectedForEdit={openSelectedForEdit}
                onSubmitSelectedDraft={() => void submitSelectedDraft()}
                onDeleteRequisition={() => void handleDeleteRequisition()}
                departmentHeadPanel={
                  isDepartmentHead ? (
                    <DepartmentHeadPanel
                      detail={selectedDetail}
                      catalog={catalog}
                      workflowSnapshot={workflowSnapshot}
                      workflowRuntime={workflowRuntime}
                      workflowHistory={workflowHistory}
                      isWorkflowLoading={isWorkflowLoading}
                      workflowError={workflowError}
                      reviewNote={reviewNote}
                      onReviewNoteChange={setReviewNote}
                      reviewError={reviewError}
                      reviewFeedback={reviewFeedback}
                      isSaving={isSaving}
                      isSelectedEditable={isSelectedEditable}
                      onApplyAction={() => void applyDepartmentHeadAction()}
                      onOpenSelectedForEdit={openSelectedForEdit}
                    />
                  ) : null
                }
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
