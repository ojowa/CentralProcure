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

const mapReport = (payload: any): EvaluationReportItem => ({
  ReportId: String(payload?.ReportId ?? payload?.ReportCode ?? ''),
  ReportCode: String(payload?.ReportCode ?? payload?.ReportId ?? ''),
  TenderId: String(payload?.TenderId ?? ''),
  TenderTitle: String(payload?.TenderTitle ?? ''),
  CommitteeLead: String(payload?.CommitteeLead ?? ''),
  Recommendation: String(payload?.Recommendation ?? ''),
  ScoreSummary: String(payload?.ScoreSummary ?? ''),
  Status: String(payload?.Status ?? ''),
  SubmittedAt: String(payload?.SubmittedAt ?? ''),
  Notes: String(payload?.Notes ?? '')
});

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
    },
    credentials: 'include'
  });

  const payload = await parseResponse<any[]>(response, 'Unable to load evaluation reports.');
  return Array.isArray(payload) ? payload.map(mapReport) : [];
};

export const fetchEvaluationReportDetail = async (
  token: string,
  reportId: string
): Promise<EvaluationReportItem> => {
  const url = `${serviceBaseUrls.workflow}/api/evaluation-reports/${reportId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  const payload = await parseResponse<any>(response, 'Unable to load evaluation report detail.');
  return mapReport(payload);
};
