import { serviceBaseUrls } from './moduleService';
import type { BudgetAvailabilityResponse, BudgetSummaryResponse } from '../types/internal';

const baseUrl = `${serviceBaseUrls.governance}/api/budget`;

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

export const fetchBudgetAvailability = async (
  token: string,
  params: { budgetCode: string; department: string; fiscalYear: number }
): Promise<BudgetAvailabilityResponse> => {
  const query = new URLSearchParams({
    budgetCode: params.budgetCode,
    department: params.department,
    fiscalYear: String(params.fiscalYear)
  });
  const response = await fetch(`${baseUrl}/availability?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetAvailabilityResponse>(response);
};

export const fetchBudgetSummary = async (
  token: string,
  params: { budgetCode: string; department: string; fiscalYear: number }
): Promise<BudgetSummaryResponse> => {
  const query = new URLSearchParams({
    budgetCode: params.budgetCode,
    department: params.department,
    fiscalYear: String(params.fiscalYear)
  });
  const response = await fetch(`${baseUrl}/summary?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<BudgetSummaryResponse>(response);
};
