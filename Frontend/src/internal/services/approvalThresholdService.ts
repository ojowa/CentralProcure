import { serviceBaseUrls } from './moduleService';
import type { ApprovalThresholdDetail } from '../types/internal';

const baseUrl = `${serviceBaseUrls.governance}/api/approval-thresholds`;

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

export const fetchApprovalThresholds = async (
  token: string,
  status?: string
): Promise<ApprovalThresholdDetail[]> => {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`${baseUrl}${query}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ApprovalThresholdDetail[]>(response);
};

export const resolveApprovalThreshold = async (
  token: string,
  params: { amount: number; procurementType?: string }
): Promise<ApprovalThresholdDetail> => {
  const query = new URLSearchParams({
    amount: String(params.amount)
  });
  if (params.procurementType) {
    query.set('procurementType', params.procurementType);
  }
  const response = await fetch(`${baseUrl}/resolve?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ApprovalThresholdDetail>(response);
};
