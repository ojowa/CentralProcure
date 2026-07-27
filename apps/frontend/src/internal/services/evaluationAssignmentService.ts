import { buildCsrfHeaders, serviceBaseUrls } from './moduleService.shared';
import type { TenderEvaluationAssignmentItem, TenderEvaluationAssignmentUpdateRequest } from '../types/internal';

const parseResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string; detail?: string } | null)?.message
          || (payload as { message?: string; error?: string; detail?: string } | null)?.error
          || (payload as { message?: string; error?: string; detail?: string } | null)?.detail
          || fallback;
    throw new Error(message);
  }

  return payload as T;
};

export const fetchTenderEvaluationAssignments = async (
  token: string,
  tenderId?: string
): Promise<TenderEvaluationAssignmentItem[]> => {
  const query = tenderId ? `?tenderId=${encodeURIComponent(tenderId)}` : '';
  const response = await fetch(`${serviceBaseUrls.workflow}/api/evaluations/assignments${query}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  return parseResponse<TenderEvaluationAssignmentItem[]>(response, 'Failed to fetch tender evaluation assignments.');
};

export const updateTenderEvaluationAssignment = async (
  token: string,
  tenderId: string,
  payload: TenderEvaluationAssignmentUpdateRequest
): Promise<void> => {
  const response = await fetch(`${serviceBaseUrls.workflow}/api/evaluations/assignments/${tenderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  await parseResponse(response, 'Failed to update tender evaluation assignment.');
};
