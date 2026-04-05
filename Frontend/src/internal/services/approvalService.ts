import type { ApprovalSummary, ApprovalDetail } from '../types/internal';

interface PaginatedResponse<T> {
  Items: T[];
  Total: number;
}

export const fetchApprovals = async (
  token: string,
  filters?: {
    query?: string;
    status?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResponse<ApprovalSummary>> => {
  const query = filters?.query?.toLowerCase() || '';
  const statusFilter = filters?.status || '';
  const categoryFilter = filters?.category || '';
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 10;
  
  // Build query parameters
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (statusFilter) params.set('status', statusFilter);
  if (categoryFilter) params.set('category', categoryFilter);
  if (page > 1) params.set('page', String(page));
  if (pageSize !== 10) params.set('pageSize', String(pageSize));
  
  const queryString = params.toString();
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://centralprocure-backend.onrender.com'}/api/approvals${queryString ? '?' + queryString : ''}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to fetch approvals: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    Items: data.Items || [],
    Total: data.Total || 0
  };
};

export const fetchApprovalDetail = async (
  token: string,
  approvalId: string
): Promise<ApprovalDetail | null> => {
  if (!approvalId) return null;
  
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://centralprocure-backend.onrender.com'}/api/approvals/${approvalId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Not found
    }
    const errorText = await response.text();
    throw new Error(errorText || `Failed to fetch approval detail: ${response.status}`);
  }
  
  return response.json();
};