import { serviceBaseUrls } from './moduleService';
import { buildCsrfHeaders } from './internalAuthService';
import type {
  RequisitionCreateRequest,
  RequisitionDetail,
  RequisitionListResponse,
  RequisitionUpdateRequest
} from '../types/internal';

export type RequisitionFilters = {
  status?: string;
  department?: string;
  priority?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
};

const baseUrl = `${serviceBaseUrls.workflow}/api/requisitions`;

const buildQuery = (filters?: RequisitionFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.department) {
    params.set('department', filters.department);
  }
  if (filters.priority) {
    params.set('priority', filters.priority);
  }
  if (filters.query) {
    params.set('query', filters.query);
  }
  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
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

  if (payload === null) {
    return {} as T;
  }

  return payload as T;
};

export const fetchRequisitions = async (
  token: string,
  filters?: RequisitionFilters
): Promise<RequisitionListResponse> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  return parseResponse<RequisitionListResponse>(response);
};

export const fetchRequisitionDetail = async (token: string, requisitionId: string): Promise<RequisitionDetail> => {
  const response = await fetch(`${baseUrl}/${requisitionId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  return parseResponse<RequisitionDetail>(response);
};

export const createRequisition = async (
  token: string,
  payload: RequisitionCreateRequest
): Promise<RequisitionDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  return parseResponse<RequisitionDetail>(response);
};

export const deleteRequisition = async (token: string, requisitionId: string): Promise<void> => {
  const response = await fetch(`${baseUrl}/${requisitionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include'
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Delete failed (${response.status}).`;
    try {
      const payload = JSON.parse(text);
      message = payload?.message || payload?.error || message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }
};

export const updateRequisition = async (
  token: string,
  requisitionId: string,
  payload: RequisitionUpdateRequest
): Promise<RequisitionDetail> => {
  const response = await fetch(`${baseUrl}/${requisitionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  return parseResponse<RequisitionDetail>(response);
};
