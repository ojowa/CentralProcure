import type { ContractAwardItem } from '../types/internal';
import { serviceBaseUrls } from './moduleService';

const CSRF_COOKIE = 'XSRF-TOKEN';

const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

const buildCsrfHeaders = (): Record<string, string> => {
  const csrfToken = getCookieValue(CSRF_COOKIE);
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
};

export type ContractAwardFilters = {
  status?: string;
  query?: string;
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

export const fetchContractAwards = async (
  token: string,
  filters?: ContractAwardFilters
): Promise<ContractAwardItem[]> => {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.query) {
    params.set('query', filters.query);
  }

  const query = params.toString();
  const url = `${serviceBaseUrls.postAward}/api/contracts/awards${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseResponse<Record<string, unknown>>(response, 'Unable to load contract awards.');
  return (data.Awards ?? data.Items ?? []) as ContractAwardItem[];
};

export const fetchContractAwardDetail = async (
  token: string,
  awardId: string
): Promise<ContractAwardItem> => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/awards/${awardId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ContractAwardItem>(response, 'Unable to load contract award detail.');
};

export const publishContractAward = async (
  token: string,
  awardId: string
): Promise<ContractAwardItem> => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/awards/${awardId}/publish`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({})
  });

  return parseResponse<ContractAwardItem>(response, 'Unable to publish contract award.');
};
