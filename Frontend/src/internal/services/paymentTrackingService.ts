import type { PaymentRecordRequest, PaymentRecordResponse, PaymentTrackingItem } from '../types/internal';
import { serviceBaseUrls } from './moduleService';

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

export const fetchPaymentTracking = async (
  token: string,
  filters?: { status?: string; query?: string; closeoutEligible?: boolean }
): Promise<PaymentTrackingItem[]> => {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.query) {
    params.set('query', filters.query);
  }
  if (typeof filters?.closeoutEligible === 'boolean') {
    params.set('closeoutEligible', String(filters.closeoutEligible));
  }

  const query = params.toString();
  const response = await fetch(`${serviceBaseUrls.postAward}/api/payments${query ? `?${query}` : ''}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<PaymentTrackingItem[]>(response, 'Unable to load payment tracking.');
};

export const recordPayment = async (token: string, request: PaymentRecordRequest): Promise<PaymentRecordResponse> => {
  const response = await fetch(`${serviceBaseUrls.postAward}/api/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(request)
  });

  return parseResponse<PaymentRecordResponse>(response, 'Unable to record payment.');
};
