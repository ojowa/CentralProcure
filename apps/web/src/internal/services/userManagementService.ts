import type {
  RoleModuleAccessGrant,
  UserModuleAccessGrant,
  ModuleAccessAuditEntry
} from './internalAuthService';
import type { InternalUserProfile } from '../types/internal';
import { COOKIE_SESSION_TOKEN, resolveCanonicalRole } from './internalAuthService';
export type { RoleModuleAccessGrant, UserModuleAccessGrant, ModuleAccessAuditEntry } from './internalAuthService';

const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const APP_BASE_PATH = normalizeBasePath(
  process.env.NEXT_PUBLIC_APP_BASE_PATH ?? ''
);

const withBasePath = (path: string): string => `${APP_BASE_PATH}${path}`;

const API_ENDPOINTS = {
  INTERNAL_USERS: withBasePath('/api/Auth/internal/users'),
  INTERNAL_USER: (id: string) => withBasePath(`/api/Auth/internal/users/${id}`),
  INTERNAL_USER_ROLE: (id: string) => withBasePath(`/api/Auth/internal/users/${id}/role`),
  INTERNAL_USER_STATUS: (id: string) => withBasePath(`/api/Auth/internal/users/${id}/status`),
  INTERNAL_USER_RESET_PASSWORD: (id: string) => withBasePath(`/api/Auth/internal/users/${id}/reset-password`),
  INTERNAL_MODULE_ACCESS_ROLES: withBasePath('/api/Auth/internal/module-access/roles'),
  INTERNAL_MODULE_ACCESS_USERS: withBasePath('/api/Auth/internal/module-access/users'),
  INTERNAL_MODULE_ACCESS_AUDIT: withBasePath('/api/Auth/internal/module-access/audit'),
};

const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

const buildCsrfHeaders = (): Record<string, string> => {
  const csrfToken = getCookieValue('XSRF-TOKEN');
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
};

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

const parseResponse = async <T>(response: Response, fallbackError: string): Promise<T> => {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const baseMessage =
      (payload as { message?: string; error?: string } | null)?.message ||
      (payload as { message?: string; error?: string } | null)?.error ||
      fallbackError;
    throw new ApiError(`${baseMessage} (status ${response.status})`, response.status);
  }

  return payload as T;
};

export type User = InternalUserProfile & {
  IsActive?: boolean;
};

export interface Role {
  RoleId: string;
  RoleName: string;
  CanonicalRoleKey?: InternalUserProfile['CanonicalRoleKey'];
  Description?: string;
  IsActive: boolean;
}

export interface RoleDetail extends Role {
  UserCount: number;
}

export interface UpdateUserRequest {
  Email: string;
  Username: string;
  FirstName: string;
  MiddleName?: string;
  Surname: string;
  ServiceNumber: string;
  UnitId?: string;
  IsActive: boolean;
}

export interface UpdateRoleRequest {
  RoleName: string;
  Description?: string;
}

export interface ResetPasswordRequest {
  NewPassword: string;
  RequireChangeOnNextLogin?: boolean;
}

export const fetchUsers = async (token: string): Promise<User[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USERS, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  const payload = await parseResponse<User[]>(response, 'Failed to fetch users');
  return Array.isArray(payload)
    ? payload.map((user) => ({
        ...user,
        CanonicalRoleKey: resolveCanonicalRole(user.CanonicalRoleKey, user.RoleName)
      }))
    : [];
};

export const updateUser = async (
  token: string,
  userId: string,
  data: UpdateUserRequest
): Promise<User> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USER(userId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const payload = await parseResponse<User>(response, 'Failed to update user');
  return {
    ...payload,
    CanonicalRoleKey: resolveCanonicalRole(payload?.CanonicalRoleKey, payload?.RoleName)
  };
};

export const updateUserRole = async (
  token: string,
  userId: string,
  roleKey: string
): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USER_ROLE(userId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ InternalUserId: userId, RoleKey: roleKey })
  });
  await parseResponse<unknown>(response, 'Failed to update user role');
};

export const updateUserStatus = async (
  token: string,
  userId: string,
  status: string,
  isActive: boolean
): Promise<User> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USER_STATUS(userId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ Status: status, IsActive: isActive })
  });
  const payload = await parseResponse<User>(response, 'Failed to update user status');
  return {
    ...payload,
    CanonicalRoleKey: resolveCanonicalRole(payload?.CanonicalRoleKey, payload?.RoleName)
  };
};

export const resetUserPassword = async (
  token: string,
  userId: string,
  data: ResetPasswordRequest
): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USER_RESET_PASSWORD(userId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  await parseResponse<unknown>(response, 'Failed to reset password');
};

export const deactivateUser = async (
  token: string,
  userId: string
): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USER(userId), {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  await parseResponse<unknown>(response, 'Failed to deactivate user');
};

export const fetchRoleModuleAccessGrants = async (token: string): Promise<RoleModuleAccessGrant[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<RoleModuleAccessGrant[]>(response, 'Failed to fetch role module access');
};

export const fetchUserModuleAccessGrants = async (token: string): Promise<UserModuleAccessGrant[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<UserModuleAccessGrant[]>(response, 'Failed to fetch user module access');
};

export const fetchModuleAccessAudit = async (
  token: string,
  params: { RoleName?: string; InternalUserId?: string; Limit?: number }
): Promise<ModuleAccessAuditEntry[]> => {
  const query = new URLSearchParams();
  if (params.RoleName) query.set('roleName', params.RoleName);
  if (params.InternalUserId) query.set('internalUserId', params.InternalUserId);
  if (params.Limit) query.set('limit', String(params.Limit));

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_AUDIT}?${query.toString()}`, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<ModuleAccessAuditEntry[]>(response, 'Failed to fetch audit');
};

export const updateRoleModuleAccessGrant = async (
  token: string,
  data: { RoleName: string; ModuleId: string; IsEnabled: boolean }
): Promise<RoleModuleAccessGrant> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return parseResponse<RoleModuleAccessGrant>(response, 'Failed to update role module access');
};

export const updateUserModuleAccessGrant = async (
  token: string,
  data: { InternalUserId: string; ModuleId: string; IsEnabled: boolean }
): Promise<UserModuleAccessGrant> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return parseResponse<UserModuleAccessGrant>(response, 'Failed to update user module access');
};

export const deleteRoleModuleAccessGrant = async (
  token: string,
  params: { RoleName: string; ModuleId: string }
): Promise<void> => {
  const query = new URLSearchParams({
    roleName: params.RoleName,
    moduleId: params.ModuleId
  });

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES}?${query.toString()}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  await parseResponse<unknown>(response, 'Failed to reset role module access');
};

export const deleteUserModuleAccessGrant = async (
  token: string,
  params: { InternalUserId: string; ModuleId: string }
): Promise<void> => {
  const query = new URLSearchParams({
    internalUserId: params.InternalUserId,
    moduleId: params.ModuleId
  });

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS}?${query.toString()}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  await parseResponse<unknown>(response, 'Failed to reset user module access');
};

export const bulkUpdateRoleModuleAccessGrants = async (
  token: string,
  data: { RoleName: string; Grants: Array<{ ModuleId: string; IsEnabled: boolean }> }
): Promise<void> => {
  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES}/bulk`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  await parseResponse<unknown>(response, 'Failed to bulk update role module access');
};

export const bulkResetRoleModuleAccessGrants = async (
  token: string,
  params: { RoleName: string }
): Promise<void> => {
  const query = new URLSearchParams({ roleName: params.RoleName });

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES}/bulk?${query.toString()}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  await parseResponse<unknown>(response, 'Failed to reset role module access');
};

export const bulkUpdateUserModuleAccessGrants = async (
  token: string,
  data: { InternalUserId: string; Grants: Array<{ ModuleId: string; IsEnabled: boolean }> }
): Promise<void> => {
  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS}/bulk`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  await parseResponse<unknown>(response, 'Failed to bulk update user module access');
};

export const bulkResetUserModuleAccessGrants = async (
  token: string,
  params: { InternalUserId: string }
): Promise<void> => {
  const query = new URLSearchParams({ internalUserId: params.InternalUserId });

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS}/bulk?${query.toString()}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  await parseResponse<unknown>(response, 'Failed to reset user module access');
};
