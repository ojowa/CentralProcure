import type { EvaluationReportItem } from '../types/internal';
import { serviceBaseUrls } from './moduleService';

export type EvaluationReportFilters = {
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

export const fetchEvaluationReports = async (
  token: string,
  filters?: EvaluationReportFilters
): Promise<EvaluationReportItem[]> => {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.query) {
    params.set('query', filters.query);
  }

  const query = params.toString();
  const url = `${serviceBaseUrls.workflow}/api/evaluation-reports${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<EvaluationReportItem[]>(response, 'Unable to load evaluation reports.');
};

export const fetchEvaluationReportDetail = async (
  token: string,
  reportId: string
): Promise<EvaluationReportItem> => {
  const url = `${serviceBaseUrls.workflow}/api/evaluation-reports/${reportId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<EvaluationReportItem>(response, 'Unable to load evaluation report detail.');
};
