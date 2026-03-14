import type {
  ContractManagementItem,
  ContractMilestoneCreateRequest,
  ContractMilestoneItem
} from '../types/internal';
import { serviceBaseUrls } from './moduleService';

export type ContractManagementFilters = {
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

export const fetchContracts = async (
  token: string,
  filters?: ContractManagementFilters
): Promise<ContractManagementItem[]> => {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.query) {
    params.set('query', filters.query);
  }

  const query = params.toString();
  const url = `${serviceBaseUrls.postAward}/api/contracts${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ContractManagementItem[]>(response, 'Unable to load contracts.');
};

export const fetchContractDetail = async (
  token: string,
  contractId: string
): Promise<ContractManagementItem> => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/${contractId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ContractManagementItem>(response, 'Unable to load contract detail.');
};

export const fetchContractMilestones = async (
  token: string,
  contractId: string
): Promise<ContractMilestoneItem[]> => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/${contractId}/milestones`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<ContractMilestoneItem[]>(response, 'Unable to load contract milestones.');
};

export const logContractMilestone = async (
  token: string,
  contractId: string,
  payload: ContractMilestoneCreateRequest
): Promise<ContractManagementItem> => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/${contractId}/milestones`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<ContractManagementItem>(response, 'Unable to log contract milestone.');
};
