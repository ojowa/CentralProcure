import { backendServiceBaseUrl, serviceBaseUrls } from './moduleService';
import type {
  VendorApprovalDecisionRequest,
  VendorApprovalDetail,
  VendorApprovalSummary
} from '../types/internal';

export type VendorApprovalFilters = {
  status?: string;
  query?: string;
};

const baseUrl = `${serviceBaseUrls.vendorSourcing}/api/admin/vendors`;

const buildQuery = (filters?: VendorApprovalFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.query) {
    params.set('query', filters.query);
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
    throw new Error(messageFromPayload || `Request failed (${response.status}).`);
  }

  return payload as T;
};

export const fetchVendorApprovals = async (
  token: string,
  filters?: VendorApprovalFilters
): Promise<VendorApprovalSummary[]> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<VendorApprovalSummary[]>(response);
};

export const fetchVendorApprovalDetail = async (
  token: string,
  vendorId: string
): Promise<VendorApprovalDetail> => {
  const response = await fetch(`${baseUrl}/${vendorId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseResponse<VendorApprovalDetail>(response);
};

export const decideVendorApproval = async (
  token: string,
  vendorId: string,
  payload: VendorApprovalDecisionRequest
): Promise<VendorApprovalSummary> => {
  const response = await fetch(`${baseUrl}/${vendorId}/decision`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<VendorApprovalSummary>(response);
};

export const downloadVendorApprovalDocument = async (
  token: string,
  fileUrl: string
): Promise<Blob> => {
  const targetUrl = fileUrl.startsWith('http') ? fileUrl : `${backendServiceBaseUrl}${fileUrl}`;
  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = await parseBody(response);
    const messageFromPayload =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(messageFromPayload || `Download failed (${response.status}).`);
  }

  return response.blob();
};
