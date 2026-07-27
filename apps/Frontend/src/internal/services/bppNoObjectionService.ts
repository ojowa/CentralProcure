import { serviceBaseUrls } from './moduleService';
import type {
  BppNoObjectionCreateRequest,
  BppNoObjectionDetail,
  BppNoObjectionUpdateRequest
} from '../types/internal';

export type BppNoObjectionFilters = {
  requisitionId?: string;
  tenderId?: string;
  status?: string;
};

const baseUrl = `${serviceBaseUrls.workflow}/api/bpp-no-objections`;

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

const buildQuery = (filters?: BppNoObjectionFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.requisitionId) {
    params.set('requisitionId', filters.requisitionId);
  }
  if (filters.tenderId) {
    params.set('tenderId', filters.tenderId);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const fetchBppNoObjections = async (
  token: string,
  filters?: BppNoObjectionFilters
): Promise<BppNoObjectionDetail[]> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BppNoObjectionDetail[]>(response);
};

export const fetchBppNoObjectionDetail = async (
  token: string,
  noObjectionId: string
): Promise<BppNoObjectionDetail> => {
  const response = await fetch(`${baseUrl}/${noObjectionId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BppNoObjectionDetail>(response);
};

export const createBppNoObjection = async (
  token: string,
  payload: BppNoObjectionCreateRequest
): Promise<BppNoObjectionDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BppNoObjectionDetail>(response);
};

export const updateBppNoObjection = async (
  token: string,
  noObjectionId: string,
  payload: BppNoObjectionUpdateRequest
): Promise<BppNoObjectionDetail> => {
  const response = await fetch(`${baseUrl}/${noObjectionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BppNoObjectionDetail>(response);
};
