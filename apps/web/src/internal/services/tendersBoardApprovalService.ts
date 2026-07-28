import type { TendersBoardQueueItem } from '../types/internal';
import { buildCsrfHeaders, serviceBaseUrls } from './moduleService';

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
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(message || fallbackError);
  }

  return payload as T;
};

export const fetchTendersBoardQueue = async (token: string): Promise<TendersBoardQueueItem[]> => {
  const response = await fetch(`${serviceBaseUrls.workflow}/api/tenders-board-approvals/queue`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  const payload = await parseResponse<TendersBoardQueueItem[]>(response, 'Unable to load Tenders Board queue.');
  return Array.isArray(payload) ? payload : [];
};

export const applyTendersBoardDecision = async (
  token: string,
  action: 'approve' | 'reject' | 'return',
  tenderId: string,
  rationale: string,
  actor?: string | null
) => {
  const response = await fetch(`${serviceBaseUrls.workflow}/api/tenders-board-approvals/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({
      TenderId: tenderId,
      Rationale: rationale,
      Actor: actor
    })
  });

  return parseResponse<{ message: string; targetStage: string; requiresBpp: boolean }>(
    response,
    `Unable to ${action} board recommendation.`
  );
};
