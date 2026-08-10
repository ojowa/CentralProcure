import type { InternalDashboardResponse } from '../types/internal';
import { parseJson, applyBasePath, buildAuthHeaders } from './apiClient';

export const fetchInternalDashboard = async (token?: string | null): Promise<InternalDashboardResponse> => {
  const response = await fetch(applyBasePath('/api/Auth/internal/dashboard'), {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  return parseJson<InternalDashboardResponse>(response);
};