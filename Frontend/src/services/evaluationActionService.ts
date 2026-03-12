import { serviceBaseUrls } from './moduleService';

export type EvaluationActionPayload = {
  ActionType: string;
  ReportCode?: string;
  TenderId: string;
  Notes?: string;
  Reason?: string;
  Justification?: string;
  Recommendation?: string;
  ThresholdNote?: string;
  RequestedBy?: string;
};

const baseUrl = `${serviceBaseUrls.workflow}/api/evaluations/actions`;

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

export const logEvaluationAction = async (
  token: string,
  payload: EvaluationActionPayload
): Promise<{ actionId?: string; status: string }> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<{ actionId?: string; status: string }>(response);
};
