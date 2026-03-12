import type { InspectionItem } from '../types/internal';
import { serviceBaseUrls } from './moduleService';

export type InspectionFilters = {
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
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<InspectionItem[]>(response, 'Unable to load inspections.');
};

export const fetchInspectionDetail = async (token: string, inspectionId: string): Promise<InspectionItem> => {
  const url = `${serviceBaseUrls.postAward}/api/inspections/${inspectionId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<InspectionItem>(response, 'Unable to load inspection detail.');
};
