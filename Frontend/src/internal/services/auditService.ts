import type {
  AuditCloseoutCreateRequest,
  AuditCloseoutItem,
  AuditHistoryItem,
  AuditHistoryListResponse,
  AuditSummaryResponse,
  AuditWorkflowDiagnosticsResponse
} from '../types/internal';
import { serviceBaseUrls } from './moduleService';

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

export const fetchAuditSummary = async (token: string): Promise<AuditSummaryResponse> => {
  const response = await fetch(`${serviceBaseUrls.governance}/api/audit/summary`, {
    headers: buildHeaders(token)
  });

  return parseResponse<AuditSummaryResponse>(response, 'Unable to load audit summary.');
};

export const fetchAuditCloseouts = async (token: string, status?: string): Promise<AuditCloseoutItem[]> => {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }

  const query = params.toString();
  const response = await fetch(`${serviceBaseUrls.governance}/api/audit/closeouts${query ? `?${query}` : ''}`, {
    headers: buildHeaders(token)
  });

  return parseResponse<AuditCloseoutItem[]>(response, 'Unable to load closeouts.');
};

export const createAuditCloseout = async (
  token: string,
  payload: AuditCloseoutCreateRequest
): Promise<AuditCloseoutItem> => {
  const response = await fetch(`${serviceBaseUrls.governance}/api/audit/closeouts`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(token, true),
    body: JSON.stringify(payload)
  });

  return parseResponse<AuditCloseoutItem>(response, 'Unable to create closeout.');
};

export const fetchAuditHistory = async (
  token: string,
  filters?: {
    entityType?: string;
    entityId?: string;
    actor?: string;
    transitionSource?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }
): Promise<AuditHistoryItem[]> => {
  const safeLimit = Math.min(Math.max(filters?.limit ?? 250, 1), 100);
  const result = await fetchAuditHistoryPage(token, {
    ...filters,
    page: 1,
    pageSize: safeLimit
  });

  return result.Items;
};

export const fetchAuditHistoryPage = async (
  token: string,
  filters?: {
    entityType?: string;
    entityId?: string;
    actor?: string;
    transitionSource?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }
): Promise<AuditHistoryListResponse> => {
  const params = new URLSearchParams();
  if (filters?.entityType) {
    params.set('entityType', filters.entityType);
  }
  if (filters?.entityId) {
    params.set('entityId', filters.entityId);
  }
  if (filters?.actor) {
    params.set('actor', filters.actor);
  }
  if (filters?.transitionSource) {
    params.set('transitionSource', filters.transitionSource);
  }
  if (filters?.query) {
    params.set('query', filters.query);
  }
  if (filters?.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }
  if (filters?.dateTo) {
    params.set('dateTo', filters.dateTo);
  }
  if (filters?.page) {
    params.set('page', String(filters.page));
  }
  if (filters?.pageSize) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (filters?.sortBy) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters?.sortDir) {
    params.set('sortDir', filters.sortDir);
  }

  const query = params.toString();
  const response = await fetch(`${serviceBaseUrls.governance}/api/audit/history${query ? `?${query}` : ''}`, {
    headers: buildHeaders(token)
  });

  return parseResponse<AuditHistoryListResponse>(response, 'Unable to load audit history.');
};

export const fetchAuditWorkflowDiagnostics = async (
  token: string,
  entityType: string,
  entityId: string
): Promise<AuditWorkflowDiagnosticsResponse> => {
  const response = await fetch(`${serviceBaseUrls.governance}/api/audit/diagnostics/${entityType}/${entityId}`, {
    headers: buildHeaders(token)
  });

  return parseResponse<AuditWorkflowDiagnosticsResponse>(response, 'Unable to load workflow diagnostics.');
};
