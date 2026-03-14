import { serviceBaseUrls } from './moduleService';
import type {
  ProcurementPlanCreateRequest,
  ProcurementPlanDetail,
  ProcurementPlanListResponse,
  ProcurementPlanUpdateRequest
} from '../types/internal';

export type ProcurementPlanFilters = {
  fiscalYear?: number;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
};

const baseUrl = `${serviceBaseUrls.workflow}/api/procurement-plans`;

const buildQuery = (filters?: ProcurementPlanFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.fiscalYear) {
    params.set('fiscalYear', String(filters.fiscalYear));
  }
  if (filters.department) {
    params.set('department', filters.department);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.page) {
    params.set('page', String(filters.page));
  }
  if (filters.pageSize) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (filters.sortBy) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.sortDir) {
    params.set('sortDir', filters.sortDir);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

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

export const fetchProcurementPlans = async (
  token: string,
  filters?: ProcurementPlanFilters
): Promise<ProcurementPlanListResponse> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ProcurementPlanListResponse>(response);
};

export const createProcurementPlan = async (
  token: string,
  payload: ProcurementPlanCreateRequest
): Promise<ProcurementPlanDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<ProcurementPlanDetail>(response);
};

export const updateProcurementPlan = async (
  token: string,
  planId: string,
  payload: ProcurementPlanUpdateRequest
): Promise<ProcurementPlanDetail> => {
  const response = await fetch(`${baseUrl}/${planId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<ProcurementPlanDetail>(response);
};

export const deleteProcurementPlan = async (token: string, planId: string): Promise<ProcurementPlanDetail> => {
  const response = await fetch(`${baseUrl}/${planId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ProcurementPlanDetail>(response);
};
