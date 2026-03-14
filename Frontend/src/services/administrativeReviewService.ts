import type {
  AdministrativeReviewCreateRequest,
  AdministrativeReviewDetail,
  AdministrativeReviewSummary,
  AdministrativeReviewUpdateRequest
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

export const fetchAdministrativeReviews = async (
  token: string,
  filters?: { entityType?: string; entityId?: string; status?: string }
): Promise<AdministrativeReviewSummary[]> => {
  const params = new URLSearchParams();
  if (filters?.entityType) {
    params.set('entityType', filters.entityType);
  }
  if (filters?.entityId) {
    params.set('entityId', filters.entityId);
  }
  if (filters?.status) {
    params.set('status', filters.status);
  }

  const query = params.toString();
  const response = await fetch(
    `${serviceBaseUrls.workflow}/api/administrative-reviews${query ? `?${query}` : ''}`,
    {
      headers: buildHeaders(token)
    }
  );

  return parseResponse<AdministrativeReviewSummary[]>(response, 'Unable to load administrative reviews.');
};

export const fetchAdministrativeReviewDetail = async (
  token: string,
  complaintId: string
): Promise<AdministrativeReviewDetail> => {
  const response = await fetch(`${serviceBaseUrls.workflow}/api/administrative-reviews/${complaintId}`, {
    headers: buildHeaders(token)
  });

  return parseResponse<AdministrativeReviewDetail>(response, 'Unable to load administrative review detail.');
};

export const createAdministrativeReview = async (
  token: string,
  payload: AdministrativeReviewCreateRequest
): Promise<AdministrativeReviewDetail> => {
  const response = await fetch(`${serviceBaseUrls.workflow}/api/administrative-reviews`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(token, true),
    body: JSON.stringify(payload)
  });

  return parseResponse<AdministrativeReviewDetail>(response, 'Unable to create administrative review.');
};

export const updateAdministrativeReview = async (
  token: string,
  complaintId: string,
  payload: AdministrativeReviewUpdateRequest
): Promise<AdministrativeReviewDetail> => {
  const response = await fetch(`${serviceBaseUrls.workflow}/api/administrative-reviews/${complaintId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildHeaders(token, true),
    body: JSON.stringify(payload)
  });

  return parseResponse<AdministrativeReviewDetail>(response, 'Unable to update administrative review.');
};
