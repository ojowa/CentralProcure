import type { Permission, RolePermission } from '../types/internal';
import { buildAuthHeaders } from './internalAuthService';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetch<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    ...buildAuthHeaders(token),
    ...(init?.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.ErrorMessage || body.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchMyPermissions(token?: string | null): Promise<Permission[]> {
  return apiFetch<Permission[]>('/api/Auth/internal/permissions', token);
}

export async function checkPermission(token: string | null, permissionKey: string): Promise<boolean> {
  const result = await apiFetch<{ PermissionKey: string; HasPermission: boolean }>(
    `/api/Auth/internal/permissions/check?permissionKey=${encodeURIComponent(permissionKey)}`,
    token
  );
  return result.HasPermission;
}

export async function fetchAllPermissions(token?: string | null): Promise<Permission[]> {
  return apiFetch<Permission[]>('/api/Auth/internal/permissions/all', token);
}

export async function fetchRolePermissions(token?: string | null, roleName?: string): Promise<RolePermission[]> {
  const qs = roleName ? `?roleName=${encodeURIComponent(roleName)}` : '';
  return apiFetch<RolePermission[]>(`/api/Auth/internal/role-permissions${qs}`, token);
}

export async function upsertRolePermission(
  token: string | null,
  roleName: string,
  permissionKey: string,
  isEnabled: boolean
): Promise<void> {
  await apiFetch('/api/Auth/internal/role-permissions', token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleName, permissionKey, isEnabled }),
  });
}

export async function deleteRolePermission(
  token: string | null,
  roleName: string,
  permissionKey: string
): Promise<void> {
  await apiFetch('/api/Auth/internal/role-permissions', token, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleName, permissionKey }),
  });
}
