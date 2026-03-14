'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  editableRequisitionStatuses,
  requisitionFundingSources,
  requisitionPriorities,
  requisitionRoleGuidance,
  requisitionStatuses,
  requisitionSteps,
  requisitionTypes,
  thresholdBands,
  type BudgetLineItem
} from '../data/internalData';
import { fetchBudgetSummary } from '../services/budgetService';
import { fetchProcurementPlanItems } from '../services/procurementPlanItemService';
import { fetchProcurementPlans } from '../services/procurementPlanService';
import { createRequisition, fetchRequisitionDetail, fetchRequisitions, updateRequisition } from '../services/requisitionService';
import type {
  BudgetSummaryResponse,
  InternalModule,
  ProcurementPlanItemDetail,
  ProcurementPlanSummary,
  RequisitionCreateRequest,
  RequisitionDetail,
  RequisitionLineItem,
  RequisitionSummary,
  RoleKey
} from '../types/internal';
import {
  formatCurrency,
  formatDate,
  getBudgetCheck,
  requisitionStatusTone,
  resolveThresholdRouting,
  toTitle
} from '../utils/procureUtils';

const EDIT_STORAGE_KEY = 'internal.requisitioningOfficer.editDraft';
const ROLE_EDITABLE = new Set<RoleKey>(['requisitioning_officer', 'department_head', 'admin']);

type WorkspaceMode = 'create' | 'history' | 'tracking';

type RequisitionFormState = {
  Title: string;
  Department: string;
  ProcurementType: string;
  Priority: string;
  FundingSource: string;
  BudgetCode: string;
  AppItemId: string;
  ProjectCode: string;
  RequiredBy: string;
  DeliveryLocation: string;
  Justification: string;
  RiskNotes: string;
  LineItems: RequisitionLineItem[];
};

type FiltersState = {
  query: string;
  status: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
  page: number;
};

type Props = {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  onModuleChange?: (moduleId: string) => void;
};

const createLineItem = (): RequisitionLineItem => ({
  Description: '',
  Unit: '',
  Quantity: 1,
  UnitCost: 0
});

const buildEmptyForm = (): RequisitionFormState => ({
  Title: '',
  Department: '',
  ProcurementType: requisitionTypes[0],
  Priority: requisitionPriorities[0],
  FundingSource: requisitionFundingSources[0],
  BudgetCode: '',
  AppItemId: '',
  ProjectCode: '',
  RequiredBy: '',
  DeliveryLocation: '',
  Justification: '',
  RiskNotes: '',
  LineItems: [createLineItem()]
});

const toInputDate = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const buildFormFromDetail = (detail: RequisitionDetail): RequisitionFormState => ({
  Title: detail.Title ?? '',
  Department: detail.Department ?? '',
  ProcurementType: detail.ProcurementType ?? requisitionTypes[0],
  Priority: detail.Priority ?? requisitionPriorities[0],
  FundingSource: detail.FundingSource ?? requisitionFundingSources[0],
  BudgetCode: detail.BudgetCode ?? '',
  AppItemId: detail.AppItemId ?? '',
  ProjectCode: detail.ProjectCode ?? '',
  RequiredBy: toInputDate(detail.RequiredBy),
  DeliveryLocation: detail.DeliveryLocation ?? '',
  Justification: detail.Justification ?? '',
  RiskNotes: detail.RiskNotes ?? '',
  LineItems: detail.LineItems?.length
    ? detail.LineItems.map((item) => ({
        ItemId: item.ItemId ?? undefined,
        Description: item.Description ?? '',
        Unit: item.Unit ?? '',
        Quantity: Number(item.Quantity ?? 0),
        UnitCost: Number(item.UnitCost ?? 0)
      }))
    : [createLineItem()]
});

const toNumber = (value: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveMode = (moduleId: string): WorkspaceMode => {
  if (moduleId === 'requisition-history') {
    return 'history';
  }
  if (moduleId === 'requisition-tracking') {
    return 'tracking';
  }
  return 'create';
};

const getPageSize = (mode: WorkspaceMode): number => {
  if (mode === 'history') {
    return 10;
  }
  return 8;
};

const normalizeItemCatalog = (
  plans: ProcurementPlanSummary[],
  itemSets: ProcurementPlanItemDetail[][]
): BudgetLineItem[] => {
  const plansById = new Map(plans.map((plan) => [plan.PlanId, plan]));
  const items = itemSets.flatMap((records) => records);
  const unique = new Map<string, BudgetLineItem>();

  for (const item of items) {
    const plan = plansById.get(item.PlanId);
    if (!plan) {
      continue;
    }

    unique.set(item.PlanItemId, {
      id: item.PlanItemId,
      title: item.Description,
      planRef: plan.PlanTitle,
      budgetCode: item.BudgetCode,
      department: plan.Department,
      fiscalYear: plan.FiscalYear,
      allocated: Number(item.EstimatedAmount ?? 0),
      committed: 0,
      reserved: 0,
      procurementCategory: item.ProcurementType ?? 'Unspecified'
    });
  }

  return Array.from(unique.values());
};

const buildPayload = (
  form: RequisitionFormState,
  status: string
): RequisitionCreateRequest => ({
  Title: form.Title.trim(),
  Department: form.Department.trim(),
  ProcurementType: form.ProcurementType || undefined,
  Priority: form.Priority || undefined,
  FundingSource: form.FundingSource || undefined,
  BudgetCode: form.BudgetCode.trim() || undefined,
  AppItemId: form.AppItemId || undefined,
  ProjectCode: form.ProjectCode.trim() || undefined,
  RequiredBy: form.RequiredBy || undefined,
  DeliveryLocation: form.DeliveryLocation.trim() || undefined,
  Justification: form.Justification.trim() || undefined,
  RiskNotes: form.RiskNotes.trim() || undefined,
  Status: status,
  LineItems: form.LineItems.map((item) => ({
    ItemId: item.ItemId ?? undefined,
    Description: item.Description.trim(),
    Unit: item.Unit.trim(),
    Quantity: toNumber(item.Quantity),
    UnitCost: toNumber(item.UnitCost)
  }))
});

const validateForm = (form: RequisitionFormState): string => {
  if (form.Title.trim().length < 5) {
    return 'Title must be at least 5 characters.';
  }

  if (form.Department.trim().length < 2) {
    return 'Department is required.';
  }

  if (!form.LineItems.length) {
    return 'At least one line item is required.';
  }

  const invalidItem = form.LineItems.find((item) => {
    return (
      item.Description.trim().length < 3 ||
      item.Unit.trim().length < 1 ||
      toNumber(item.Quantity) <= 0 ||
      toNumber(item.UnitCost) <= 0
    );
  });

  if (invalidItem) {
    return 'Each line item must include a description, unit, quantity, and unit cost.';
  }

  return '';
};

const getStepIndex = (detail: RequisitionDetail | null): number => {
  if (!detail) {
    return 0;
  }

  switch (detail.Status) {
    case 'Draft':
    case 'Rejected':
      return 0;
    case 'Submitted':
    case 'Under Review':
      return 1;
    case 'Evaluation':
      return 2;
    case 'Board Review':
      return 3;
    case 'Approved':
      return 5;
    default:
      return 0;
  }
};

export const RequisitionOfficerWorkspace = ({
  module,
  token,
  role,
  userEmail,
  onModuleChange
}: Props) => {
  const mode = resolveMode(module.id);
  const pageSize = getPageSize(mode);
  const guidance = requisitionRoleGuidance[role ?? 'requisitioning_officer'] ?? requisitionRoleGuidance.requisitioning_officer;

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

  const totalEstimate = useMemo(
    () =>
      form.LineItems.reduce((sum, item) => {
        return sum + toNumber(item.Quantity) * toNumber(item.UnitCost);
      }, 0),
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
  const isSelectedEditable = Boolean(selectedDetail && editableRequisitionStatuses.has(selectedDetail.Status));

  const summary = useMemo(() => {
    const counts = requisitions.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.Status] = (accumulator[record.Status] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      total: totalItems,
      drafts: counts.Draft ?? 0,
      active: (counts.Submitted ?? 0) + (counts['Under Review'] ?? 0) + (counts.Evaluation ?? 0) + (counts['Board Review'] ?? 0),
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

      if (mode === 'tracking') {
        if (response.Items.length === 0) {
          setSelectedId(null);
          setSelectedDetail(null);
        } else if (!response.Items.some((item) => item.RequisitionId === selectedId)) {
          setSelectedId(response.Items[0].RequisitionId);
        }
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load requisitions.');
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    void loadRequisitions();
  }, [token, filters.query, filters.status, filters.priority, filters.dateFrom, filters.dateTo, filters.page, pageSize, mode]);

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

        if (!isMounted) {
          return;
        }

        setCatalog(normalizeItemCatalog(candidatePlans, itemSets));
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
    if (mode !== 'create' || typeof window === 'undefined') {
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
  }, [mode]);

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      page: key === 'page' ? Number(value) : 1
    }));
  };

  const updateFormField = <K extends keyof RequisitionFormState>(key: K, value: RequisitionFormState[K]) => {
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
    setForm((previous) => ({
      ...previous,
      AppItemId: nextItemId,
      BudgetCode: match?.budgetCode ?? previous.BudgetCode,
      Department: previous.Department || match?.department || '',
      ProcurementType: previous.ProcurementType || match?.procurementCategory || requisitionTypes[0]
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

  const renderQuickLinks = () => (
    <div className="requisition-actions">
      <button
        type="button"
        className={`plan-button ${mode === 'create' ? '' : 'plan-button--secondary'}`}
        onClick={() => onModuleChange?.('create-requisition')}
      >
        Create Requisition
      </button>
      <button
        type="button"
        className={`plan-button ${mode === 'history' ? '' : 'plan-button--secondary'}`}
        onClick={() => onModuleChange?.('requisition-history')}
      >
        Requisition History
      </button>
      <button
        type="button"
        className={`plan-button ${mode === 'tracking' ? '' : 'plan-button--secondary'}`}
        onClick={() => onModuleChange?.('requisition-tracking')}
      >
        Requisition Tracking
      </button>
    </div>
  );

  const renderDetail = (detail: RequisitionDetail) => {
    const band = resolveThresholdRouting(detail.TotalEstimate, thresholdBands);

    return (
      <>
        <div className="requisition-card__header">
          <div>
            <h3>{detail.Title}</h3>
            <p>{detail.Department} · {detail.RequisitionId}</p>
          </div>
          <div className="requisition-badges">
            <span className={`req-badge ${requisitionStatusTone(detail.Status)}`.trim()}>{detail.Status}</span>
            <span className="req-badge req-badge--soft">{formatCurrency(detail.TotalEstimate)}</span>
          </div>
        </div>

        <div className="requisition-detail-grid">
          <div>
            <span>Department</span>
            <strong>{detail.Department}</strong>
          </div>
          <div>
            <span>Priority</span>
            <strong>{detail.Priority || 'Not set'}</strong>
          </div>
          <div>
            <span>Funding Source</span>
            <strong>{detail.FundingSource || 'Not set'}</strong>
          </div>
          <div>
            <span>Procurement Type</span>
            <strong>{detail.ProcurementType || 'Not set'}</strong>
          </div>
          <div>
            <span>Required By</span>
            <strong>{formatDate(detail.RequiredBy)}</strong>
          </div>
          <div>
            <span>Current Stage</span>
            <strong>{detail.CurrentStage || detail.Status}</strong>
          </div>
          <div>
            <span>Budget Code</span>
            <strong>{detail.BudgetCode || 'Not linked'}</strong>
          </div>
          <div>
            <span>APP Item</span>
            <strong>{detail.AppItemId || 'Not linked'}</strong>
          </div>
          <div>
            <span>Project Code</span>
            <strong>{detail.ProjectCode || 'Not set'}</strong>
          </div>
        </div>

        <div className="routing-panel" style={{ marginTop: '16px' }}>
          <div className="routing-panel__header">
            <div>
              <h4>Routing Outlook</h4>
              <p>{band.escalation}</p>
            </div>
            <div className="routing-panel__badges">
              <span className="requisition-tag">{band.label}</span>
              <span className="requisition-tag requisition-tag--accent">{band.approvalLevel}</span>
            </div>
          </div>
          <div className="routing-panel__grid">
            <div>
              <span>Timeline</span>
              <strong>{band.timeline}</strong>
            </div>
            <div>
              <span>BPP Requirement</span>
              <strong>{band.requiresBpp ? 'Required' : 'Not required'}</strong>
            </div>
          </div>
        </div>

        <div className="requisition-detail-items">
          <h4>Line Items</h4>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.LineItems.map((item, index) => (
                <tr key={`${item.ItemId ?? 'line'}-${index}`}>
                  <td>{item.Description}</td>
                  <td>{item.Unit}</td>
                  <td>{item.Quantity}</td>
                  <td>{formatCurrency(item.UnitCost)}</td>
                  <td>{formatCurrency(Number(item.Quantity) * Number(item.UnitCost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="requisition-detail-note">
          <h4>Justification</h4>
          <p>{detail.Justification || 'No justification recorded.'}</p>
        </div>

        <div className="requisition-detail-note">
          <h4>Delivery and Risk Notes</h4>
          <p>{detail.DeliveryLocation || 'No delivery location provided.'}</p>
          <p>{detail.RiskNotes || 'No risk note recorded.'}</p>
        </div>

        <div className="requisition-detail-note">
          <h4>Workflow Steps</h4>
          <div className="requisition-steps">
            {requisitionSteps.map((step, index) => {
              const stepClassName =
                index < activeStepIndex
                  ? 'requisition-step requisition-step--done'
                  : index === activeStepIndex
                    ? 'requisition-step requisition-step--active'
                    : 'requisition-step';

              return (
                <div key={step.key} className={stepClassName}>
                  <div>
                    <strong>{step.title}</strong>
                    <span className="requisition-step__detail">{step.detail}</span>
                  </div>
                  <span className="requisition-step__status">{index === activeStepIndex ? detail.Status : step.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isSelectedEditable ? (
          <div className="requisition-actions">
            <button type="button" className="plan-button" onClick={openSelectedForEdit}>
              Edit Draft
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              disabled={isSaving || !canEditDrafts}
              onClick={() => void submitSelectedDraft()}
            >
              {isSaving ? 'Submitting...' : 'Submit Draft'}
            </button>
          </div>
        ) : null}
      </>
    );
  };

  const renderCreateWorkspace = () => (
    <div className="requisition-grid">
      <div className="requisition-panel">
        <article className="requisition-card">
          <div className="requisition-card__header">
            <div>
              <h3>{editingId ? 'Update Requisition Draft' : 'Draft New Requisition'}</h3>
              <p>Capture business need, planning linkage, and delivery expectations before submission.</p>
            </div>
            {editingId ? <span className="requisition-tag">Editing existing draft</span> : null}
          </div>

          <div className="requisition-form-grid">
            <label className="plan-field">
              <span>Title</span>
              <input className="plan-input" value={form.Title} onChange={(event) => updateFormField('Title', event.target.value)} />
            </label>
            <label className="plan-field">
              <span>Department</span>
              <input className="plan-input" value={form.Department} onChange={(event) => updateFormField('Department', event.target.value)} />
            </label>
            <label className="plan-field">
              <span>Required By</span>
              <input className="plan-input" type="date" value={form.RequiredBy} onChange={(event) => updateFormField('RequiredBy', event.target.value)} />
            </label>
            <label className="plan-field">
              <span>Procurement Type</span>
              <select className="plan-select" value={form.ProcurementType} onChange={(event) => updateFormField('ProcurementType', event.target.value)}>
                {requisitionTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Priority</span>
              <select className="plan-select" value={form.Priority} onChange={(event) => updateFormField('Priority', event.target.value)}>
                {requisitionPriorities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Funding Source</span>
              <select className="plan-select" value={form.FundingSource} onChange={(event) => updateFormField('FundingSource', event.target.value)}>
                {requisitionFundingSources.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Budget Code</span>
              <input className="plan-input" value={form.BudgetCode} onChange={(event) => updateFormField('BudgetCode', event.target.value)} />
            </label>
            <label className="plan-field">
              <span>APP Line Item</span>
              <select className="plan-select" value={form.AppItemId} onChange={(event) => handleAppItemSelect(event.target.value)}>
                <option value="">Select APP line item</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.planRef}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Project Code</span>
              <input className="plan-input" value={form.ProjectCode} onChange={(event) => updateFormField('ProjectCode', event.target.value)} />
            </label>
            <label className="plan-field plan-field--span">
              <span>Delivery Location</span>
              <input className="plan-input" value={form.DeliveryLocation} onChange={(event) => updateFormField('DeliveryLocation', event.target.value)} />
            </label>
            <label className="plan-field plan-field--span">
              <span>Justification</span>
              <textarea className="plan-textarea" rows={4} value={form.Justification} onChange={(event) => updateFormField('Justification', event.target.value)} />
            </label>
            <label className="plan-field plan-field--span">
              <span>Risk Notes</span>
              <textarea className="plan-textarea" rows={3} value={form.RiskNotes} onChange={(event) => updateFormField('RiskNotes', event.target.value)} />
            </label>
          </div>
        </article>

        <article className="requisition-card">
          <div className="requisition-card__header requisition-card__header--inline">
            <div>
              <h3>Line Items</h3>
              <p>Break the requirement into clear commercial units for threshold and budget validation.</p>
            </div>
            <button type="button" className="plan-button plan-button--secondary" onClick={addLineItem}>
              Add Item
            </button>
          </div>

          <div className="requisition-items">
            <div className="requisition-item-row requisition-item-row--header">
              <div>Description</div>
              <div>Unit</div>
              <div>Qty</div>
              <div>Unit Cost</div>
              <div>Total</div>
              <div>Action</div>
            </div>
            {form.LineItems.map((item, index) => (
              <div key={`line-item-${index}`} className="requisition-item-row">
                <div className="requisition-item-cell--desc">
                  <input
                    className="plan-input"
                    value={item.Description}
                    onChange={(event) => updateLineItem(index, 'Description', event.target.value)}
                    placeholder="Describe the line item"
                  />
                </div>
                <div className="requisition-item-cell">
                  <input
                    className="plan-input"
                    value={item.Unit}
                    onChange={(event) => updateLineItem(index, 'Unit', event.target.value)}
                    placeholder="pcs"
                  />
                </div>
                <div className="requisition-item-cell">
                  <input
                    className="plan-input"
                    type="number"
                    min="0"
                    step="1"
                    value={item.Quantity}
                    onChange={(event) => updateLineItem(index, 'Quantity', event.target.value)}
                  />
                </div>
                <div className="requisition-item-cell">
                  <input
                    className="plan-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.UnitCost}
                    onChange={(event) => updateLineItem(index, 'UnitCost', event.target.value)}
                  />
                </div>
                <div className="requisition-item-total">
                  {formatCurrency(toNumber(item.Quantity) * toNumber(item.UnitCost))}
                </div>
                <div className="requisition-item-cell">
                  <button type="button" className="plan-link plan-link--danger" onClick={() => removeLineItem(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="requisition-summary">
            <div>
              <span>Total Estimate</span>
              <strong>{formatCurrency(totalEstimate)}</strong>
            </div>
            <div>
              <span>Threshold Route</span>
              <strong>{routingBand.label}</strong>
            </div>
            <div>
              <span>Approval Level</span>
              <strong>{routingBand.approvalLevel}</strong>
            </div>
          </div>

          {formError ? <div className="req-error req-error--block">{formError}</div> : null}
          {feedback ? <div className="requisition-success">{feedback}</div> : null}

          <div className="requisition-actions">
            <button type="button" className="plan-button" disabled={isSaving || !canSaveCurrentForm} onClick={() => void saveDraft('Draft')}>
              {isSaving ? 'Saving...' : editingId ? 'Update Draft' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              disabled={isSaving || !canSaveCurrentForm}
              onClick={() => void saveDraft('Submitted')}
            >
              {isSaving ? 'Submitting...' : 'Submit Requisition'}
            </button>
            <button type="button" className="plan-button plan-button--secondary" onClick={resetForm}>
              Reset Form
            </button>
          </div>
        </article>

        <article className="requisition-card">
          <div className="requisition-card__header">
            <div>
              <h3>Recent Requisitions</h3>
              <p>Search recent drafts and submissions without leaving the creation workspace.</p>
            </div>
          </div>

          <div className="plan-filters">
            <label className="plan-field">
              <span>Search</span>
              <input
                className="plan-input"
                value={filters.query}
                onChange={(event) => updateFilter('query', event.target.value)}
                placeholder="Search title, department, or budget code"
              />
            </label>
            <label className="plan-field">
              <span>Status</span>
              <select className="plan-select" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {requisitionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="plan-actions">
              <button type="button" className="plan-button plan-button--secondary" disabled={isListLoading} onClick={() => void loadRequisitions(1)}>
                {isListLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <table className="plan-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Total</th>
                <th>Required By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.slice(0, 5).map((record) => (
                <tr key={record.RequisitionId}>
                  <td>
                    <strong>{record.Title}</strong>
                    <div className="plan-muted">{record.Department}</div>
                  </td>
                  <td>
                    <span className={`admin-status ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span>
                  </td>
                  <td>{formatCurrency(record.TotalEstimate)}</td>
                  <td>{formatDate(record.RequiredBy)}</td>
                  <td>
                    <button type="button" className="plan-link" onClick={() => openDetail(record.RequisitionId, true)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!requisitions.length ? (
                <tr>
                  <td colSpan={5} className="plan-empty">
                    No requisitions match the current search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </article>
      </div>

      <div className="requisition-panel">
        <article className="requisition-card">
          <div className="requisition-card__header">
            <div>
              <h3>APP and Budget Check</h3>
              <p>Validate planning linkage and live budget position before submission.</p>
            </div>
            {isCatalogLoading ? <span className="requisition-tag requisition-tag--ghost">Loading APP items</span> : null}
          </div>

          {selectedAppItem ? (
            <div className="budget-app-summary">
              <div>
                <span>APP Line</span>
                <strong>{selectedAppItem.title}</strong>
              </div>
              <div>
                <span>Plan Reference</span>
                <strong>{selectedAppItem.planRef}</strong>
              </div>
              <div>
                <span>Budget Code</span>
                <strong>{selectedAppItem.budgetCode}</strong>
              </div>
            </div>
          ) : null}

          <div className={`budget-check budget-check--${budgetCheck.status}`}>
            <div className="budget-check__header">
              <div>
                <h4>Budget Position</h4>
                <p>{budgetCheck.message}</p>
              </div>
              {isBudgetLoading ? <span className="requisition-tag requisition-tag--ghost">Refreshing</span> : null}
            </div>
            <div className="budget-check__grid">
              <div>
                <span>Request Amount</span>
                <strong>{formatCurrency(budgetCheck.amount)}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{formatCurrency(budgetCheck.available)}</strong>
              </div>
              <div>
                <span>Variance</span>
                <strong>{formatCurrency(budgetCheck.variance)}</strong>
              </div>
            </div>
            <div className="budget-check__meta">
              <span>Department: {budgetDepartment || 'Not set'}</span>
              <span>Budget Code: {budgetCode || 'Not set'}</span>
              <span>Fiscal Year: {fiscalYear}</span>
            </div>
          </div>
          {budgetError ? <div className="req-error req-error--block">{budgetError}</div> : null}
          {catalogError ? <div className="req-error req-error--block">{catalogError}</div> : null}
        </article>

        <article className="requisition-card">
          <div className="requisition-card__header">
            <div>
              <h3>Routing Forecast</h3>
              <p>{routingBand.escalation}</p>
            </div>
            <span className="requisition-tag requisition-tag--accent">{routingBand.timeline}</span>
          </div>

          <div className="routing-panel routing-panel--empty">
            <div className="routing-panel__header">
              <div>
                <h4>{routingBand.approvalLevel}</h4>
                <p>{routingBand.label}</p>
              </div>
              <div className="routing-panel__badges">
                <span className="requisition-tag">{routingBand.requiresBpp ? 'BPP Required' : 'Internal Approval'}</span>
              </div>
            </div>
            <div className="routing-steps">
              {routingBand.steps.map((step, index) => (
                <div key={`${routingBand.id}-${step}`} className="routing-step">
                  <span className="routing-step__index">{index + 1}</span>
                  <div>
                    <strong>{step}</strong>
                    <span className="routing-step__meta">{routingBand.timeline}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="requisition-card">
          <div className="requisition-card__header">
            <div>
              <h3>Role Focus</h3>
              <p>{guidance?.focus || 'Prepare complete, defensible requisitions with clear planning and budget linkage.'}</p>
            </div>
          </div>
          <div className="requisition-checklist">
            {(guidance?.checks ?? []).map((check) => (
              <div key={check} className="requisition-check">
                <input type="checkbox" checked readOnly />
                <span>{check}</span>
              </div>
            ))}
          </div>
          <div className="requisition-detail-note">
            <h4>Prepared By</h4>
            <p>{userEmail || 'Current authenticated internal user'}</p>
          </div>
        </article>
      </div>
    </div>
  );

  const renderHistoryWorkspace = () => (
    <>
      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Search title, department, or budget code"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select className="plan-select" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {requisitionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Priority</span>
            <select className="plan-select" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
              <option value="">All priorities</option>
              {requisitionPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Date From</span>
            <input className="plan-input" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label className="plan-field">
            <span>Date To</span>
            <input className="plan-input" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" disabled={isListLoading} onClick={() => void loadRequisitions()}>
              {isListLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Department</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Total</th>
            <th>Required By</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {requisitions.map((record) => (
            <tr key={record.RequisitionId}>
              <td>
                <button type="button" className="plan-link" onClick={() => openDetail(record.RequisitionId, true)}>
                  {record.Title}
                </button>
              </td>
              <td>{record.Department}</td>
              <td>{record.Priority || 'Not set'}</td>
              <td>
                <span className={`admin-status ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span>
              </td>
              <td>{formatCurrency(record.TotalEstimate)}</td>
              <td>{formatDate(record.RequiredBy)}</td>
              <td>{formatDate(record.CreatedAt)}</td>
            </tr>
          ))}
          {!requisitions.length ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No requisitions match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="plan-pagination">
        <div className="plan-pagination__meta">
          Showing {pageStart} - {pageEnd} of {totalItems}
        </div>
        <div className="plan-pagination__controls">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            disabled={filters.page <= 1}
            onClick={() => updateFilter('page', filters.page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            disabled={pageEnd >= totalItems}
            onClick={() => updateFilter('page', filters.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );

  const renderTrackingWorkspace = () => (
    <>
      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Search title, department, or requisition ID"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select className="plan-select" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {requisitionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Priority</span>
            <select className="plan-select" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
              <option value="">All priorities</option>
              {requisitionPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" disabled={isListLoading} onClick={() => void loadRequisitions()}>
              {isListLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="requisition-tracking-grid">
        <article className="requisition-card requisition-tracking-list">
          <div className="requisition-card__header">
            <div>
              <h3>Tracked Requisitions</h3>
              <p>Select a requisition to inspect its current routing state and underlying request details.</p>
            </div>
          </div>

          <div className="requisition-tracking-cards">
            {requisitions.map((record) => (
              <button
                type="button"
                key={record.RequisitionId}
                className={`requisition-track-card ${record.RequisitionId === selectedId ? 'requisition-track-card--active' : ''}`.trim()}
                onClick={() => openDetail(record.RequisitionId, false)}
              >
                <div>
                  <h4>{record.Title}</h4>
                  <p>{record.Department} · {formatDate(record.CreatedAt)}</p>
                </div>
                <div className="requisition-badges">
                  <span className={`req-badge ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span>
                  <span className="req-badge req-badge--soft">{formatCurrency(record.TotalEstimate)}</span>
                </div>
              </button>
            ))}
            {!requisitions.length ? <div className="plan-empty">No requisitions match the tracking filters.</div> : null}
          </div>
        </article>

        <div className="requisition-tracking-detail">
          {isDetailLoading ? <div className="plan-loading">Loading requisition detail...</div> : null}
          {selectedDetail ? <article className="requisition-detail">{renderDetail(selectedDetail)}</article> : null}
          {!selectedDetail && !isDetailLoading ? (
            <article className="requisition-card">
              <h3>No requisition selected</h3>
              <p>Select a requisition card to review its current workflow progress.</p>
            </article>
          ) : null}
        </div>
      </div>
    </>
  );

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
        <div>
          <span>Drafts in scope</span>
          <strong>{summary.drafts}</strong>
        </div>
        <div>
          <span>Active workflow items</span>
          <strong>{summary.active}</strong>
        </div>
        <div>
          <span>Approved requests</span>
          <strong>{summary.approved}</strong>
        </div>
        <div>
          <span>Current role</span>
          <strong>{role ? toTitle(role) : 'Unspecified'}</strong>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>{renderQuickLinks()}</div>

      {!token ? <div className="portal-alert" style={{ marginTop: '16px' }}>Authentication token is missing.</div> : null}
      {listError ? <div className="portal-alert" style={{ marginTop: '16px' }}>{listError}</div> : null}

      <div style={{ marginTop: '16px' }}>
        {mode === 'create' ? renderCreateWorkspace() : null}
        {mode === 'history' ? renderHistoryWorkspace() : null}
        {mode === 'tracking' ? renderTrackingWorkspace() : null}
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
            {isDetailLoading ? <div className="plan-loading">Loading requisition detail...</div> : renderDetail(selectedDetail)}
          </div>
        </div>
      ) : null}
    </section>
  );
};
