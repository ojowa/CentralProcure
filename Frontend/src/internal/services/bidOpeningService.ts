import { serviceBaseUrls } from './moduleService';
import type {
  BidOpeningSessionCreateRequest,
  BidOpeningSessionDetail,
  BidOpeningSessionListResponse,
  BidOpeningSessionUpdateRequest
} from '../types/internal';

export type BidOpeningFilters = {
  status?: string;
  tenderId?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
};

const baseUrl = `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions`;

const buildQuery = (filters?: BidOpeningFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.tenderId) {
    params.set('tenderId', filters.tenderId);
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

  return payload as T;
};

export const fetchBidOpeningSessions = async (
  token: string,
  filters?: BidOpeningFilters
): Promise<BidOpeningSessionListResponse> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BidOpeningSessionListResponse>(response);
};

export const fetchBidOpeningSessionDetail = async (
  token: string,
  sessionId: string
): Promise<BidOpeningSessionDetail> => {
  const response = await fetch(`${baseUrl}/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BidOpeningSessionDetail>(response);
};

export const createBidOpeningSession = async (
  token: string,
  payload: BidOpeningSessionCreateRequest
): Promise<BidOpeningSessionDetail> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BidOpeningSessionDetail>(response);
};

export const updateBidOpeningSession = async (
  token: string,
  sessionId: string,
  payload: BidOpeningSessionUpdateRequest
): Promise<BidOpeningSessionDetail> => {
  const response = await fetch(`${baseUrl}/${sessionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<BidOpeningSessionDetail>(response);
};
