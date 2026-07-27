import type { WorkflowRuntimeDisplay } from '../components/workflowDisplayTypes';
import { serviceBaseUrls } from './moduleService';

export type TenderWorkflowDisplayResponse = {
  TenderId: string;
  CurrentStageKey?: string | null;
  CurrentStageTitle?: string | null;
  WorkflowDisplay?: WorkflowRuntimeDisplay | null;
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

export const fetchTenderWorkflowDisplay = async (tenderId: string, token: string): Promise<TenderWorkflowDisplayResponse> => {
  const response = await fetch(`${serviceBaseUrls.vendorSourcing}/api/tenders/${tenderId}/workflow-display`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await parseBody(response);
  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error ||
          'Unable to load tender workflow display.';
    throw new Error(message);
  }

  return payload as TenderWorkflowDisplayResponse;
};
