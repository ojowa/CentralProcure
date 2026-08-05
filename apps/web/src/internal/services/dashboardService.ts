import type { InternalDashboardResponse } from '../types/internal';
import { parseJson } from './apiClient';
import { applyBasePath } from './apiClient';

export const fetchInternalDashboard = async (token: string): Promise<InternalDashboardResponse> => {
  const response = await fetch(applyBasePath('/api/Auth/internal/dashboard'), {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });

  return parseJson<InternalDashboardResponse>(response);
};