import type { AdministrativeReviewCreateRequest, AdministrativeReviewDetail } from '../types/internal';
import type { AdministrativeReviewSummary, AdministrativeReviewUpdateRequest } from '../types/internal';

const baseUrl = '/api/administrative-reviews';

export type AdministrativeReviewFilingContext = {
  EntityType: string;
  EntityId: string;
  RecordTitle?: string | null;
  CurrentStageKey: string;
  CurrentStageTitle?: string | null;
  CanFile: boolean;
  Reason?: string | null;
  FilingEffectNote: string;
};

const parse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status}).`);
  }

  return text ? JSON.parse(text) as T : ({} as T);
};

export const fetchAdministrativeReviewFilingContext = async (
  token: string,
  entityType: string,
  entityId: string
): Promise<AdministrativeReviewFilingContext> => {
  const params = new URLSearchParams({ entityType, entityId });
  const response = await fetch(`${baseUrl}/filing-context?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  return parse<AdministrativeReviewFilingContext>(response);
};

export const createAdministrativeReview = async (
  token: string,
  payload: AdministrativeReviewCreateRequest
): Promise<AdministrativeReviewDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parse<AdministrativeReviewDetail>(response);
};

export const fetchAdministrativeReviews = async (
  token: string,
  filters?: { entityType?: string; entityId?: string; status?: string }
): Promise<AdministrativeReviewSummary[]> => {
  const params = new URLSearchParams();
  if (filters?.entityType) params.set('entityType', filters.entityType);
  if (filters?.entityId) params.set('entityId', filters.entityId);
  if (filters?.status) params.set('status', filters.status);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${baseUrl}${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  const data = await parse<{ Reviews: AdministrativeReviewSummary[] }>(response);
  return Array.isArray(data) ? data : (data?.Reviews ?? []);
};

export const fetchAdministrativeReviewDetail = async (
  token: string,
  complaintId: string
): Promise<AdministrativeReviewDetail> => {
  const response = await fetch(`${baseUrl}/${complaintId}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  return parse<AdministrativeReviewDetail>(response);
};

export const updateAdministrativeReview = async (
  token: string,
  complaintId: string,
  payload: AdministrativeReviewUpdateRequest
): Promise<AdministrativeReviewDetail> => {
  const response = await fetch(`${baseUrl}/${complaintId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parse<AdministrativeReviewDetail>(response);
};
