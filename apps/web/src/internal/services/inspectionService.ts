import type { InspectionItem, InspectionUpdateRequest } from '../types/internal';
import { serviceBaseUrls } from './moduleService';

export type InspectionFilters = {
  status?: string;
  query?: string;
};

const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

const buildHeaders = (token: string, withJson = false): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };

  if (withJson) {
    headers['Content-Type'] = 'application/json';
  }

  const csrfToken = getCookieValue('XSRF-TOKEN');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return headers;
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

const parseResponse = async <T>(response: Response, fallbackError: string): Promise<T> => {
  const payload = await parseBody(response);

  if (!response.ok) {
    const messageFromPayload =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(messageFromPayload || fallbackError);
  }

  return payload as T;
};

export const fetchInspections = async (token: string, filters?: InspectionFilters): Promise<InspectionItem[]> => {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.query) {
    params.set('query', filters.query);
  }

  const query = params.toString();
  const url = `${serviceBaseUrls.postAward}/api/inspections${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    headers: buildHeaders(token)
  });

  const data = await parseResponse<Record<string, unknown>>(response, 'Unable to load inspections.');
  return (data.Items ?? []) as InspectionItem[];
};

export const fetchInspectionDetail = async (token: string, inspectionId: string): Promise<InspectionItem> => {
  const url = `${serviceBaseUrls.postAward}/api/inspections/${inspectionId}`;
  const response = await fetch(url, {
    headers: buildHeaders(token)
  });

  return parseResponse<InspectionItem>(response, 'Unable to load inspection detail.');
};

export const updateInspection = async (
  token: string,
  inspectionId: string,
  payload: InspectionUpdateRequest
): Promise<InspectionItem> => {
  const response = await fetch(`${serviceBaseUrls.postAward}/api/inspections/${inspectionId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildHeaders(token, true),
    body: JSON.stringify(payload)
  });

  return parseResponse<InspectionItem>(response, 'Unable to update inspection.');
};
