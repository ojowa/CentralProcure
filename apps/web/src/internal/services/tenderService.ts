import { serviceBaseUrls } from './moduleService';
import type {
  TenderCreateRequest,
  TenderDetail,
  TenderListResponse,
  TenderPublishRequest,
  TenderUpdateRequest
} from '../types/internal';

export type TenderFilters = {
  status?: string;
  category?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  minValue?: number;
  maxValue?: number;
};

const baseUrl = `${serviceBaseUrls.vendorSourcing}/api/internal/tenders`;

const buildQuery = (filters?: TenderFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.category) {
    params.set('category', filters.category);
  }
  if (filters.query) {
    params.set('query', filters.query);
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
  if (filters.minValue !== undefined && filters.minValue !== null) {
    params.set('minValue', String(filters.minValue));
  }
  if (filters.maxValue !== undefined && filters.maxValue !== null) {
    params.set('maxValue', String(filters.maxValue));
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

export const fetchTenders = async (token: string, filters?: TenderFilters): Promise<TenderListResponse> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseResponse<Record<string, unknown>>(response);
  return {
    Items: (data.Items ?? []) as TenderListResponse['Items'],
    TotalCount: (data.TotalCount ?? 0) as number,
    Page: (data.Page ?? 1) as number,
    PageSize: (data.PageSize ?? 20) as number
  };
};

export const fetchTenderDetail = async (token: string, tenderId: string): Promise<TenderDetail> => {
  const response = await fetch(`${baseUrl}/${tenderId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<TenderDetail>(response);
};

export const createTender = async (token: string, payload: TenderCreateRequest): Promise<TenderDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<TenderDetail>(response);
};

export const publishTender = async (
  token: string,
  tenderId: string,
  payload: TenderPublishRequest
): Promise<TenderDetail> => {
  const response = await fetch(`${baseUrl}/${tenderId}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<TenderDetail>(response);
};

export const updateTender = async (
  token: string,
  tenderId: string,
  payload: TenderUpdateRequest
): Promise<TenderDetail> => {
  const response = await fetch(`${baseUrl}/${tenderId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<TenderDetail>(response);
};
