import type {
  ProcurementInitiationResponse,
  ProcurementPlanApprovalDecisionRequest,
  ProcurementPlanApprovalDecisionResponse,
  ProcurementPlanCreateRequest,
  ProcurementPlanDetail,
  ProcurementPlanFilters,
  ProcurementPlanListResponse,
  ProcurementPlanRecommendationRequest,
  ProcurementPlanRecommendationResponse,
  ProcurementPlanUpdateRequest
} from './procurementPlanService.shared';
import { baseUrl, buildQuery, jsonHeaders, parseResponse } from './procurementPlanService.shared';

export const fetchProcurementPlans = async (
  token: string,
  filters?: ProcurementPlanFilters
): Promise<ProcurementPlanListResponse> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, { headers: { Authorization: `Bearer ${token}` } });
  return parseResponse<ProcurementPlanListResponse>(response);
};

export const createProcurementPlan = async (token: string, payload: ProcurementPlanCreateRequest): Promise<ProcurementPlanDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    body: JSON.stringify(payload)
  });
  return parseResponse<ProcurementPlanDetail>(response);
};

export const updateProcurementPlan = async (token: string, planId: string, payload: ProcurementPlanUpdateRequest): Promise<ProcurementPlanDetail> => {
  const response = await fetch(`${baseUrl}/${planId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    body: JSON.stringify(payload)
  });
  return parseResponse<ProcurementPlanDetail>(response);
};

export const deleteProcurementPlan = async (token: string, planId: string): Promise<ProcurementPlanDetail> => {
  const response = await fetch(`${baseUrl}/${planId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return parseResponse<ProcurementPlanDetail>(response);
};

export const decideProcurementPlanApproval = async (
  token: string,
  planId: string,
  payload: ProcurementPlanApprovalDecisionRequest
): Promise<ProcurementPlanApprovalDecisionResponse> => {
  const response = await fetch(`${baseUrl}/${planId}/approval-decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    body: JSON.stringify(payload)
  });
  return parseResponse<ProcurementPlanApprovalDecisionResponse>(response);
};

export const recommendProcurementPlanForApproval = async (
  token: string,
  planId: string,
  payload?: ProcurementPlanRecommendationRequest
): Promise<ProcurementPlanRecommendationResponse> => {
  const response = await fetch(`${baseUrl}/${planId}/recommend-for-approval`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    body: JSON.stringify(payload ?? {})
  });
  return parseResponse<ProcurementPlanRecommendationResponse>(response);
};

export const initiateProcurementPlan = async (token: string, planId: string): Promise<ProcurementInitiationResponse> => {
  const response = await fetch(`${baseUrl}/${planId}/initiate-procurement`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  return parseResponse<ProcurementInitiationResponse>(response);
};
