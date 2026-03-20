import { serviceBaseUrls } from './moduleService';
import type {
  BudgetAppropriationCreateRequest,
  BudgetAppropriationListResponse,
  BudgetAppropriationResponse,
  BudgetReleaseCreateRequest,
  BudgetReleaseListResponse,
  BudgetReleaseResponse,
  BudgetCommitmentCreateRequest,
  BudgetCommitmentListResponse,
  BudgetCommitmentResponse,
  BudgetAvailabilityResponse,
  BudgetConfirmationDetail,
  BudgetConfirmationListResponse,
  BudgetDashboardResponse,
  BudgetDecisionRequest,
  BudgetDecisionResponse,
  BudgetRequisitionListResponse,
  BudgetSummaryResponse
} from '../types/internal';

const baseUrl = `${serviceBaseUrls.governance}/api/budget`;

const parseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = await parseBody(response);

  if (!response.ok) {
    const messageFromPayload =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    const fallback = `Request failed (${response.status}).`;
    throw new Error(messageFromPayload || fallback);
  }

  return payload as T;
};

export const fetchBudgetAvailability = async (
  token: string,
  params: { budgetCode: string; department: string; fiscalYear: number }
): Promise<BudgetAvailabilityResponse> => {
  const query = new URLSearchParams({
    budgetCode: params.budgetCode,
    department: params.department,
    fiscalYear: String(params.fiscalYear)
  });
  const response = await fetch(`${baseUrl}/availability?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetAvailabilityResponse>(response);
};

export const fetchBudgetSummary = async (
  token: string,
  params: { budgetCode: string; department: string; fiscalYear: number }
): Promise<BudgetSummaryResponse> => {
  const query = new URLSearchParams({
    budgetCode: params.budgetCode,
    department: params.department,
    fiscalYear: String(params.fiscalYear)
  });
  const response = await fetch(`${baseUrl}/summary?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetSummaryResponse>(response);
};

export const fetchBudgetDashboard = async (
  token: string,
  params?: { fiscalYear?: number; department?: string }
): Promise<BudgetDashboardResponse> => {
  const query = new URLSearchParams();
  if (params?.fiscalYear) {
    query.set('fiscalYear', String(params.fiscalYear));
  }
  if (params?.department?.trim()) {
    query.set('department', params.department.trim());
  }

  const response = await fetch(`${baseUrl}/dashboard?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetDashboardResponse>(response);
};

export const fetchBudgetConfirmations = async (
  token: string,
  params?: {
    fiscalYear?: number;
    department?: string;
    stage?: string;
    query?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<BudgetConfirmationListResponse> => {
  const query = new URLSearchParams();
  if (params?.fiscalYear) {
    query.set('fiscalYear', String(params.fiscalYear));
  }
  if (params?.department?.trim()) {
    query.set('department', params.department.trim());
  }
  if (params?.stage?.trim()) {
    query.set('stage', params.stage.trim());
  }
  if (params?.query?.trim()) {
    query.set('query', params.query.trim());
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(`${baseUrl}/confirmations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetConfirmationListResponse>(response);
};

export const fetchBudgetRequisitionQueue = async (
  token: string,
  params?: {
    fiscalYear?: number;
    department?: string;
    stage?: string;
    query?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<BudgetRequisitionListResponse> => {
  const query = new URLSearchParams();
  if (params?.fiscalYear) {
    query.set('fiscalYear', String(params.fiscalYear));
  }
  if (params?.department?.trim()) {
    query.set('department', params.department.trim());
  }
  if (params?.stage?.trim()) {
    query.set('stage', params.stage.trim());
  }
  if (params?.query?.trim()) {
    query.set('query', params.query.trim());
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(`${baseUrl}/requisitions?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetRequisitionListResponse>(response);
};

export const fetchBudgetAppropriations = async (
  token: string,
  params?: {
    fiscalYear?: number;
    department?: string;
    budgetCode?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<BudgetAppropriationListResponse> => {
  const query = new URLSearchParams();
  if (params?.fiscalYear) {
    query.set('fiscalYear', String(params.fiscalYear));
  }
  if (params?.department?.trim()) {
    query.set('department', params.department.trim());
  }
  if (params?.budgetCode?.trim()) {
    query.set('budgetCode', params.budgetCode.trim());
  }
  if (params?.status?.trim()) {
    query.set('status', params.status.trim());
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(`${baseUrl}/appropriations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetAppropriationListResponse>(response);
};

export const fetchBudgetConfirmationDetail = async (
  token: string,
  planId: string
): Promise<BudgetConfirmationDetail> => {
  const response = await fetch(`${baseUrl}/confirmations/${planId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetConfirmationDetail>(response);
};

export const decideBudgetConfirmation = async (
  token: string,
  planId: string,
  payload: BudgetDecisionRequest
): Promise<BudgetDecisionResponse> => {
  const response = await fetch(`${baseUrl}/confirmations/${planId}/decision`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BudgetDecisionResponse>(response);
};

export const createBudgetAppropriation = async (
  token: string,
  payload: BudgetAppropriationCreateRequest
): Promise<BudgetAppropriationResponse> => {
  const response = await fetch(`${baseUrl}/appropriations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BudgetAppropriationResponse>(response);
};

export const closeBudgetAppropriation = async (
  token: string,
  appropriationId: string
): Promise<BudgetAppropriationResponse> => {
  const response = await fetch(`${baseUrl}/appropriations/${appropriationId}/close`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetAppropriationResponse>(response);
};

export const createBudgetRelease = async (
  token: string,
  payload: BudgetReleaseCreateRequest
): Promise<BudgetReleaseResponse> => {
  const response = await fetch(`${baseUrl}/releases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BudgetReleaseResponse>(response);
};

export const createBudgetCommitment = async (
  token: string,
  payload: BudgetCommitmentCreateRequest
): Promise<BudgetCommitmentResponse> => {
  const response = await fetch(`${baseUrl}/commitments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BudgetCommitmentResponse>(response);
};

export const cancelBudgetCommitment = async (
  token: string,
  commitmentId: string
): Promise<BudgetCommitmentResponse> => {
  const response = await fetch(`${baseUrl}/commitments/${commitmentId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetCommitmentResponse>(response);
};

export const fetchBudgetCommitments = async (
  token: string,
  params?: {
    appropriationId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<BudgetCommitmentListResponse> => {
  const query = new URLSearchParams();
  if (params?.appropriationId?.trim()) {
    query.set('appropriationId', params.appropriationId.trim());
  }
  if (params?.status?.trim()) {
    query.set('status', params.status.trim());
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(`${baseUrl}/commitments?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetCommitmentListResponse>(response);
};

export const fetchBudgetReleases = async (
  token: string,
  params?: {
    appropriationId?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<BudgetReleaseListResponse> => {
  const query = new URLSearchParams();
  if (params?.appropriationId?.trim()) {
    query.set('appropriationId', params.appropriationId.trim());
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(`${baseUrl}/releases?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetReleaseListResponse>(response);
};
