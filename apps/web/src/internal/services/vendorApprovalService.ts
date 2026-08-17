import { apiServiceBaseUrl, serviceBaseUrls } from './moduleService';
import { buildCsrfHeaders } from './moduleService.shared';
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
): Promise<{ items: VendorApprovalSummary[]; total: number }> => {
  const response = await fetch(`${baseUrl}${buildQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  const data = await parseResponse<Record<string, unknown>>(response);
  return {
    items: (data.Items ?? []) as VendorApprovalSummary[],
    total: (data.TotalCount ?? 0) as number
  };
};

export const fetchVendorApprovalDetail = async (
  token: string,
  vendorId: string
): Promise<VendorApprovalDetail> => {
  const response = await fetch(`${baseUrl}/${vendorId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
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
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  return parseResponse<VendorApprovalSummary>(response);
};

export const downloadVendorApprovalDocument = async (
  token: string,
  fileUrl: string
): Promise<Blob> => {
  const targetUrl = fileUrl.startsWith('http') ? fileUrl : `${apiServiceBaseUrl}${fileUrl}`;
  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
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

export const deleteVendor = async (
  token: string,
  vendorId: string,
  reason?: string
): Promise<{ VendorId: string; Message: string }> => {
  const response = await fetch(`${baseUrl}/${vendorId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ Reason: reason || null })
  });

  return parseResponse<{ VendorId: string; Message: string }>(response);
};

export const verifyComplianceDocument = async (
  token: string,
  documentId: string,
  status: 'Approved' | 'Rejected',
  rejectionReason?: string
): Promise<{ DocumentId: string; VerificationStatus: string }> => {
  const response = await fetch(`${baseUrl}/compliance/${documentId}/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ Status: status, RejectionReason: rejectionReason || null })
  });

  return parseResponse<{ DocumentId: string; VerificationStatus: string }>(response);
};
