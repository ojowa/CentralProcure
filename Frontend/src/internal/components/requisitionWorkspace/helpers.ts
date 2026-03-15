'use client';

import {
  requisitionFundingSources,
  requisitionPriorities,
  requisitionTypes,
  type BudgetLineItem
} from '../../data/internalData';
import type {
  ProcurementPlanItemDetail,
  ProcurementPlanSummary,
  RequisitionCreateRequest,
  RequisitionDetail,
  RequisitionLineItem
} from '../../types/internal';
import { formatDate, getBudgetCheck } from '../../utils/procureUtils';

export const DEPARTMENT_HEAD_QUEUE_STATUSES = new Set(['Draft', 'Submitted', 'Rejected', 'Under Review']);

export type DepartmentHeadActionConfig = {
  label: string;
  nextStatus: 'Submitted' | 'Under Review';
  helper: string;
};

export type DepartmentHeadChecklistItem = {
  label: string;
  complete: boolean;
  detail: string;
};

export type WorkspaceMode = 'create' | 'history' | 'tracking';

export type RequisitionFormState = {
  Title: string;
  Department: string;
  UnitId: string;
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

export type FiltersState = {
  query: string;
  status: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
  page: number;
};

export const createLineItem = (): RequisitionLineItem => ({
  Description: '',
  Unit: '',
  Quantity: 1,
  UnitCost: 0
});

export const buildEmptyForm = (): RequisitionFormState => ({
  Title: '',
  Department: '',
  UnitId: '',
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

export const buildFormFromDetail = (detail: RequisitionDetail): RequisitionFormState => ({
  Title: detail.Title ?? '',
  Department: detail.Department ?? '',
  UnitId: detail.UnitId ?? '',
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

export const toNumber = (value: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const resolveMode = (moduleId: string): WorkspaceMode => {
  if (moduleId === 'requisition-history') {
    return 'history';
  }
  if (moduleId === 'requisition-tracking') {
    return 'tracking';
  }
  return 'create';
};

export const getPageSize = (mode: WorkspaceMode): number => {
  if (mode === 'history') {
    return 10;
  }
  return 8;
};

export const normalizeItemCatalog = (
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

export const buildPayload = (
  form: RequisitionFormState,
  status: string
): RequisitionCreateRequest => ({
  Title: form.Title.trim(),
  Department: form.Department.trim(),
  UnitId: form.UnitId || undefined,
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

export const validateForm = (form: RequisitionFormState): string => {
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

export const getStepIndex = (detail: RequisitionDetail | null): number => {
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

export const resolveDepartmentHeadAction = (detail: RequisitionDetail | null): DepartmentHeadActionConfig | null => {
  if (!detail) {
    return null;
  }

  switch (detail.Status) {
    case 'Draft':
    case 'Rejected':
      return {
        label: 'Endorse and Submit',
        nextStatus: 'Submitted',
        helper: 'Release the requisition from the department into live procurement routing.'
      };
    case 'Submitted':
      return {
        label: 'Confirm Department Review',
        nextStatus: 'Under Review',
        helper: 'Record that the department head has validated scope, timing, and readiness.'
      };
    case 'Under Review':
      return {
        label: 'Update Review Note',
        nextStatus: 'Under Review',
        helper: 'Refresh the department head note without changing the current workflow stage.'
      };
    default:
      return null;
  }
};

export const buildDepartmentHeadReviewNote = (
  existing: string | null | undefined,
  note: string,
  nextStatus: 'Submitted' | 'Under Review',
  userEmail?: string | null
): string => {
  const timestamp = new Date().toISOString();
  const defaultNote =
    nextStatus === 'Submitted'
      ? 'Department head endorsed the requisition and released it for procurement review.'
      : 'Department head confirmed the requisition is ready for downstream processing.';
  const entry = `[Department Head Review | ${timestamp}${userEmail ? ` | ${userEmail}` : ''}] ${note.trim() || defaultNote}`;

  return [existing?.trim(), entry].filter((value): value is string => Boolean(value)).join('\n\n');
};

const getCatalogMatchForDetail = (detail: RequisitionDetail, catalog: BudgetLineItem[]): BudgetLineItem | null => {
  return (
    catalog.find((item) => (detail.AppItemId ? item.id === detail.AppItemId : false)) ??
    catalog.find((item) => (detail.BudgetCode ? item.budgetCode === detail.BudgetCode : false)) ??
    null
  );
};

export const buildDepartmentHeadChecklist = (
  detail: RequisitionDetail,
  catalog: BudgetLineItem[]
): DepartmentHeadChecklistItem[] => {
  const catalogMatch = getCatalogMatchForDetail(detail, catalog);
  const budgetCheck = getBudgetCheck(
    detail.TotalEstimate,
    detail.AppItemId ?? undefined,
    detail.BudgetCode ?? undefined,
    null,
    catalogMatch,
    true,
    catalog
  );

  return [
    {
      label: 'Need owner is clear',
      complete: detail.Department.trim().length >= 2,
      detail: detail.Department ? `Department: ${detail.Department}` : 'Department is missing.'
    },
    {
      label: 'APP linkage exists',
      complete: Boolean(detail.AppItemId),
      detail: detail.AppItemId ? 'APP line item linked to the requisition.' : 'APP line item has not been linked.'
    },
    {
      label: 'Budget coding is present',
      complete: Boolean(detail.BudgetCode),
      detail: detail.BudgetCode ? `Budget code: ${detail.BudgetCode}` : 'Budget code has not been supplied.'
    },
    {
      label: 'Business justification is complete',
      complete: (detail.Justification ?? '').trim().length >= 10,
      detail: detail.Justification ? 'Justification is recorded for the request.' : 'Justification is missing.'
    },
    {
      label: 'Delivery plan is defined',
      complete: Boolean(detail.RequiredBy) && Boolean((detail.DeliveryLocation ?? '').trim()),
      detail:
        detail.RequiredBy && detail.DeliveryLocation
          ? `Required by ${formatDate(detail.RequiredBy)} at ${detail.DeliveryLocation}.`
          : 'Required-by date or delivery location is incomplete.'
    },
    {
      label: 'Commercial lines are usable',
      complete:
        detail.LineItems.length > 0 &&
        detail.LineItems.every((item) => item.Description.trim() && item.Unit.trim() && Number(item.Quantity) > 0 && Number(item.UnitCost) > 0),
      detail: `${detail.LineItems.length} line item(s) captured.`
    },
    {
      label: 'Budget position is supportable',
      complete: budgetCheck.status === 'sufficient',
      detail: budgetCheck.message
    }
  ];
};
