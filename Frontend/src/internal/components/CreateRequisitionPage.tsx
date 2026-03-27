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
import { createRequisition, fetchRequisitionDetail, fetchRequisitions, updateRequisition } from '../services/requisitionService';
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
  RequisitionLineItem,
  RequisitionSummary,
  RoleKey,
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../types/internal';
import { getBudgetCheck, resolveThresholdRouting, toTitle } from '../utils/procureUtils';
import {
  buildDepartmentHeadReviewNote,
  buildEmptyForm,
  buildFormFromDetail,
  buildPayload,
  createLineItem,
  DEPARTMENT_HEAD_QUEUE_STATUSES,
  getPageSize,
  getStepIndex,
  normalizeItemCatalog,
  resolveDepartmentHeadAction,
  toNumber,
  validateForm,
  type FiltersState,
  type RequisitionFormState
} from './requisitionWorkspace/helpers';
import {
  DepartmentHeadPanel,
  DepartmentHeadQueueCard,
  RequisitionDetailContent,
  RequisitionQuickLinks
} from './requisitionWorkspace/detailViews';
import {
  RequisitionCreateView
} from './requisitionWorkspace/sectionViews';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import { getHumanStatus } from '../utils/workflow';

const EDIT_STORAGE_KEY = 'internal.requisitioningOfficer.editDraft';
const ROLE_EDITABLE = new Set<RoleKey>(['requisitioning_officer', 'department_head', 'admin']);

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

export const CreateRequisitionPage = ({ module, token, role, userEmail, availableModuleIds = [], onModuleChange }: Props) => {
  const mode = 'create';
  const pageSize = getPageSize(mode);
  const guidance = requisitionRoleGuidance[role ?? 'requisitioning_officer'] ?? requisitionRoleGuidance.requisitioning_officer;
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
  const [units, setUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
  const [unitsError, setUnitsError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [budgetError, setBudgetError] = useState('');
  const [isBudgetLoading, setIsBudgetLoading] = useState(false);
  const [form, setForm] = useState<RequisitionFormState>(buildEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
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

  const totalEstimate = useMemo(
    () => form.LineItems.reduce((sum, item) => sum + toNumber(item.Quantity) * toNumber(item.UnitCost), 0),
    [form.LineItems]
  );

  const selectedAppItem = useMemo(
    () => catalog.find((item) => item.id === form.AppItemId) ?? null,
    [catalog, form.AppItemId]
  );

  const budgetDepartment = (form.Department.trim() || selectedAppItem?.department || '').trim();
  const budgetCode = (form.BudgetCode.trim() || selectedAppItem?.budgetCode || '').trim();
  const fiscalYear =
    selectedAppItem?.fiscalYear ??
    (form.RequiredBy ? new Date(form.RequiredBy).getUTCFullYear() : new Date().getUTCFullYear());

  const budgetCheck = useMemo(
    () =>
      getBudgetCheck(
        totalEstimate,
        form.AppItemId || undefined,
        budgetCode || undefined,
        budgetSummary,
        selectedAppItem,
        true,
        catalog
      ),
    [budgetCode, budgetSummary, catalog, form.AppItemId, selectedAppItem, totalEstimate]
  );

  const routingBand = useMemo(() => resolveThresholdRouting(totalEstimate, thresholdBands), [totalEstimate]);
  const activeStepIndex = getStepIndex(selectedDetail);
  const canEditDrafts = Boolean(token && role && ROLE_EDITABLE.has(role));
  const canSaveCurrentForm = Boolean(token && canEditDrafts);
  const canOpenCreateModule = availableModuleIds.includes('create-requisition');
  const isSelectedEditable = Boolean(selectedDetail && editableRequisitionStatuses.has(selectedDetail.Status));
  const departmentHeadQueue = useMemo(
    () => requisitions.filter((record) => DEPARTMENT_HEAD_QUEUE_STATUSES.has(record.Status)),
    [requisitions]
  );
  const assignableUnits = useMemo(
    () => units.filter((unit) => unit.IsAssignable),
    [units]
  );

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
    let isMounted = true;

    const loadUnits = async () => {
      try {
        const fetchedUnits = await fetchInternalUnits();
        if (isMounted) {
          setUnits(fetchedUnits);
          setUnitsError('');
        }
      } catch (error) {
        if (isMounted) {
          setUnits([]);
          setUnitsError(error instanceof Error ? error.message : 'Unable to load organizational units.');
        }
      }
    };

    void loadUnits();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (form.UnitId || !form.Department.trim() || !assignableUnits.length) {
      return;
    }

    const matchedUnit = assignableUnits.find(
      (unit) => unit.UnitName.toLowerCase() === form.Department.trim().toLowerCase()
    );

    if (!matchedUnit) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      UnitId: matchedUnit.UnitId,
      Department: matchedUnit.UnitName
    }));
  }, [assignableUnits, form.Department, form.UnitId]);

  useEffect(() => {
    if (!token) {
      setCatalog([]);
      return;
    }

    let isMounted = true;
    const loadCatalog = async () => {
      setIsCatalogLoading(true);
      setCatalogError('');
      try {
        const planResponse = await fetchProcurementPlans(token, {
          page: 1,
          pageSize: 20
        });
        const candidatePlans = planResponse.Items.filter((plan) => plan.FiscalYear >= new Date().getUTCFullYear() - 1);
        const itemSets = await Promise.all(
          candidatePlans.map(async (plan) => {
            try {
              return await fetchProcurementPlanItems(token, plan.PlanId);
            } catch {
              return [];
            }
          })
        );

        if (isMounted) {
          setCatalog(normalizeItemCatalog(candidatePlans, itemSets));
        }
      } catch (error) {
        if (isMounted) {
          setCatalog([]);
          setCatalogError(error instanceof Error ? error.message : 'Unable to load APP line items.');
        }
      } finally {
        if (isMounted) {
          setIsCatalogLoading(false);
        }
      }
    };

    void loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !budgetCode || !budgetDepartment) {
      setBudgetSummary(null);
      setBudgetError('');
      return;
    }

    let isMounted = true;
    setIsBudgetLoading(true);
    setBudgetError('');

    fetchBudgetSummary(token, {
      budgetCode,
      department: budgetDepartment,
      fiscalYear
    })
      .then((summaryResponse) => {
        if (isMounted) {
          setBudgetSummary(summaryResponse);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setBudgetSummary(null);
          setBudgetError(error instanceof Error ? error.message : 'Unable to load budget summary.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsBudgetLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [budgetCode, budgetDepartment, fiscalYear, token]);

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
    setReviewNote('');
    setReviewError('');
    setReviewFeedback('');
  }, [selectedId]);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedDraft = window.sessionStorage.getItem(EDIT_STORAGE_KEY);
    if (!storedDraft) {
      return;
    }

    try {
      const detail = JSON.parse(storedDraft) as RequisitionDetail;
      setEditingId(detail.RequisitionId);
      setForm(buildFormFromDetail(detail));
      setSelectedId(detail.RequisitionId);
      setSelectedDetail(detail);
      setFeedback(`Editing ${detail.Title}. Update the draft and save or submit it.`);
      setFormError('');
    } finally {
      window.sessionStorage.removeItem(EDIT_STORAGE_KEY);
    }
  }, []);

  const updateFormField = <K extends keyof RequisitionFormState>(key: K, value: RequisitionFormState[K]) => {
    if (key === 'UnitId') {
      const nextUnitId = value as string;
      const selectedUnit = assignableUnits.find((unit) => unit.UnitId === nextUnitId);
      setForm((previous) => ({
        ...previous,
        UnitId: nextUnitId,
        Department: selectedUnit?.UnitName ?? previous.Department
      }));
      setFormError('');
      setFeedback('');
      return;
    }

    setForm((previous) => ({
      ...previous,
      [key]: value
    }));
    setFormError('');
    setFeedback('');
  };

  const updateLineItem = (index: number, key: keyof RequisitionLineItem, value: string | number) => {
    setForm((previous) => ({
      ...previous,
      LineItems: previous.LineItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          [key]: key === 'Quantity' || key === 'UnitCost' ? Number(value) : value
        };
      })
    }));
    setFormError('');
    setFeedback('');
  };

  const addLineItem = () => {
    setForm((previous) => ({
      ...previous,
      LineItems: [...previous.LineItems, createLineItem()]
    }));
  };

  const removeLineItem = (index: number) => {
    setForm((previous) => ({
      ...previous,
      LineItems:
        previous.LineItems.length === 1
          ? [createLineItem()]
          : previous.LineItems.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const resetForm = () => {
    setForm(buildEmptyForm());
    setEditingId(null);
    setFormError('');
    setFeedback('');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(EDIT_STORAGE_KEY);
    }
  };

  const handleAppItemSelect = (nextItemId: string) => {
    const match = catalog.find((item) => item.id === nextItemId);
    const matchedUnit = assignableUnits.find((unit) => unit.UnitName === (match?.department ?? ''));
    setForm((previous) => ({
      ...previous,
      AppItemId: nextItemId,
      BudgetCode: match?.budgetCode ?? previous.BudgetCode,
      UnitId: previous.UnitId || matchedUnit?.UnitId || '',
      Department: previous.Department || match?.department || '',
      ProcurementType: previous.ProcurementType || match?.procurementCategory || previous.ProcurementType
    }));
    setFormError('');
    setFeedback('');
  };

  const openDetail = (requisitionId: string, modal = false) => {
    setSelectedId(requisitionId);
    setIsDetailModalOpen(modal);
  };

  const saveDraft = async (status: 'Draft' | 'Submitted') => {
    if (!token || !canSaveCurrentForm) {
      setFormError('You do not currently have permission to save requisitions.');
      return;
    }

    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError('');
    setFeedback('');
    try {
      const payload = buildPayload(form, status);
      const response = editingId
        ? await updateRequisition(token, editingId, payload)
        : await createRequisition(token, payload);

      setSelectedId(response.RequisitionId);
      setSelectedDetail(response);
      await loadRequisitions(1);
      setFilters((previous) => ({ ...previous, page: 1 }));

      if (editableRequisitionStatuses.has(response.Status)) {
        setEditingId(response.RequisitionId);
        setForm(buildFormFromDetail(response));
      } else {
        setEditingId(null);
        setForm(buildEmptyForm());
      }

      setFeedback(
        status === 'Draft'
          ? `Draft ${editingId ? 'updated' : 'saved'} successfully.`
          : `Requisition ${editingId ? 'updated and submitted' : 'submitted'} successfully.`
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save requisition.');
    } finally {
      setIsSaving(false);
    }
  };

  const openSelectedForEdit = () => {
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
    setListError('');
    try {
      const updated = await updateRequisition(token, selectedDetail.RequisitionId, {
        Status: 'Submitted'
      });
      setSelectedDetail(updated);
      await loadRequisitions();
      setFeedback(`Requisition ${updated.Title} submitted successfully.`);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to submit requisition draft.');
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
      setReviewFeedback(
        actionConfig.nextStatus === 'Submitted'
          ? `Requisition submitted. ${updated.Title} is now awaiting department head endorsement.`
          : actionConfig.nextStatus === 'Endorsed'
            ? `Department endorsement recorded. ${updated.Title} is ready for budget allocation.`
            : `Department head review note recorded for ${updated.Title}.`
      );

      if (editingId === updated.RequisitionId && !editableRequisitionStatuses.has(updated.Status)) {
        setEditingId(null);
        setForm(buildEmptyForm());
      }

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
        <RequisitionCreateView
          editingId={editingId}
          form={form}
          units={assignableUnits}
          catalog={catalog}
          selectedAppItem={selectedAppItem}
          budgetCheck={budgetCheck}
          budgetDepartment={budgetDepartment}
          budgetCode={budgetCode}
          fiscalYear={fiscalYear}
          routingBand={routingBand}
          formError={formError}
          feedback={feedback}
          isSaving={isSaving}
          canSaveCurrentForm={canSaveCurrentForm}
          isListLoading={isListLoading}
          isCatalogLoading={isCatalogLoading}
          isBudgetLoading={isBudgetLoading}
          budgetError={budgetError}
          catalogError={[unitsError, catalogError].filter(Boolean).join(' ')}
          guidance={guidance}
          userEmail={userEmail}
          isDepartmentHead={isDepartmentHead}
          departmentHeadQueueCard={
            isDepartmentHead ? (
              <DepartmentHeadQueueCard queue={departmentHeadQueue} selectedId={selectedId} onOpenDetail={openDetail} />
            ) : null
          }
          onFormFieldChange={updateFormField}
          onLineItemChange={updateLineItem}
          onAddLineItem={addLineItem}
          onRemoveLineItem={removeLineItem}
          onSaveDraft={(status) => void saveDraft(status)}
          onResetForm={resetForm}
          onOpenDetail={openDetail}
          onAppItemSelect={handleAppItemSelect}
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
                  onDeleteRequisition={() => {}}
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
