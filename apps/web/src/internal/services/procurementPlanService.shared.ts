import { buildCsrfHeaders } from './internalAuthService';
import { serviceBaseUrls } from './moduleService';
import type {
  ProcurementInitiationResponse,
  ProcurementPlanApprovalDecisionRequest,
  ProcurementPlanApprovalDecisionResponse,
  ProcurementPlanCreateRequest,
  ProcurementPlanDetail,
  ProcurementPlanListResponse,
  ProcurementPlanUpdateRequest,
  RequisitionSummary
} from '../types/internal';

export type {
  ProcurementInitiationResponse,
  ProcurementPlanApprovalDecisionRequest,
  ProcurementPlanApprovalDecisionResponse,
  ProcurementPlanCreateRequest,
  ProcurementPlanDetail,
  ProcurementPlanListResponse,
  ProcurementPlanUpdateRequest,
  RequisitionSummary
};

export type YearlyAppCreateRequest = {
  Title: string;
  FiscalYear: number;
  Notes?: string | null;
};

export type YearlyAppUpdateRequest = {
  Title?: string;
  Notes?: string | null;
};

export type ProcurementPlanRecommendationResponse = {
  PlanId: string;
  Message: string;
  StageKey: string;
  StageTitle: string;
  WorkflowStatus: string;
  PlanStatus: string;
  SubmittedAt: string;
};

export type ProcurementPlanRecommendationRequest = {
  Note?: string | null;
};

export type ProcurementPlanRecommendationRequisitionResponse = {
  RequisitionId: string;
  Title: string;
  Department: string;
  TotalEstimate: number;
  FinalCommitteeDecision?: string | null;
  AppItemId?: string | null;
  IsReadyForRecommendation: boolean;
};

export type ProcurementPlanRecommendationReadinessResponse = {
  PlanId: string;
  TotalTrackedRequisitions: number;
  RecommendedRequisitions: number;
  PendingFinalDecisionRequisitions: number;
  NonRecommendedRequisitions: number;
  AppItemCount: number;
  CanRecommend: boolean;
  Message: string;
  Requisitions: ProcurementPlanRecommendationRequisitionResponse[];
};

export type YearlyAppSummary = {
  YearlyAppId: string;
  Title: string;
  FiscalYear: number;
  Status: string;
  CurrentStageKey?: string | null;
  CurrentStageTitle?: string | null;
  PlansCount: number;
  IncludedPlansCount?: number;
  PendingPlansCount?: number;
  ItemsCount: number;
  TotalBudget: number;
  CreatedAt: string;
};

export type YearlyAppDetail = {
  YearlyAppId: string;
  Title: string;
  FiscalYear: number;
  Status: string;
  CurrentStageKey?: string | null;
  CurrentStageTitle?: string | null;
  TotalBudget: number;
  PlansCount: number;
  IncludedPlansCount?: number;
  PendingPlansCount?: number;
  ItemsCount: number;
  Notes?: string | null;
  SubmittedAt?: string | null;
  ApprovedAt?: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type YearlyAppPlanSummary = {
  PlanId: string;
  PlanTitle: string;
  Department: string;
  FiscalYear: number;
  Status: string;
  CurrentStageKey?: string | null;
  CurrentStageTitle?: string | null;
  TotalBudget: number;
  ItemCount: number;
  CreatedAt: string;
};

export type YearlyAppDetailsResponse = {
  App: YearlyAppDetail;
  IncludedPlans?: YearlyAppPlanSummary[];
  PendingPlans?: YearlyAppPlanSummary[];
  Plans?: YearlyAppPlanSummary[];
};

export type YearlyAppRecommendationReadinessResponse = {
  YearlyAppId: string;
  TotalPlans: number;
  TotalTrackedRequisitions: number;
  RecommendedRequisitions: number;
  PendingFinalDecisionRequisitions: number;
  NonRecommendedRequisitions: number;
  AppItemCount: number;
  CanRecommend: boolean;
  Message: string;
  Requisitions: ProcurementPlanRecommendationRequisitionResponse[];
};

export type YearlyAppRecommendationResponse = {
  YearlyAppId: string;
  Message: string;
  StageKey: string;
  StageTitle: string;
  WorkflowStatus: string;
  AppStatus: string;
  SubmittedAt: string;
};

export type ProcurementPlanFilters = {
  fiscalYear?: number;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
};

export const baseUrl = `${serviceBaseUrls.workflow}/api/procurement-plans`;
export const yearlyAppBaseUrl = `${serviceBaseUrls.workflow}/api/yearly-apps`;

export const buildQuery = (filters?: ProcurementPlanFilters): string => {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.fiscalYear) params.set('fiscalYear', String(filters.fiscalYear));
  if (filters.department) params.set('department', filters.department);
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDir) params.set('sortDir', filters.sortDir);
  const query = params.toString();
  return query ? `?${query}` : '';
};

const parseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = await parseBody(response);
  if (!response.ok) {
    const messageFromPayload =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    const fallback = `HTTP ${response.status}: Request failed.`;
    const message = messageFromPayload ? `HTTP ${response.status}: ${messageFromPayload}` : fallback;
    throw new Error(message);
  }
  return payload as T;
};

export const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...buildCsrfHeaders()
});
