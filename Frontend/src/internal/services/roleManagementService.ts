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
  ROLES: withBasePath('/api/Auth/roles'),
  ROLE: (id: string) => withBasePath(`/api/Auth/roles/${id}`),
  ROLE_USERS: (id: string) => withBasePath(`/api/Auth/roles/${id}/users`),
};

const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  if (!token) {
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
    const message =
      (payload as { message?: string; error?: string } | null)?.message ||
      (payload as { message?: string; error?: string } | null)?.error ||
      fallbackError;
    throw new Error(message);
  }

  return payload as T;
};

export interface Role {
  RoleId: string;
  RoleName: string;
  Description?: string;
  IsActive: boolean;
}

export interface RoleDetail extends Role {
  UserCount: number;
}

export interface RoleUser {
  InternalUserId: string;
  Email: string;
  Username: string;
  FirstName: string;
  Surname: string;
  Status: string;
}

export interface CreateRoleRequest {
  RoleName: string;
  Description?: string;
}

export interface UpdateRoleRequest {
  RoleName: string;
  Description?: string;
}

export const fetchRoles = async (token?: string | null): Promise<Role[]> => {
  const response = await fetch(API_ENDPOINTS.ROLES, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<Role[]>(response, 'Failed to fetch roles');
};

export const fetchRole = async (roleId: string, token?: string | null): Promise<RoleDetail> => {
  const response = await fetch(API_ENDPOINTS.ROLE(roleId), {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<RoleDetail>(response, 'Failed to fetch role');
};

export const createRole = async (
  token: string,
  data: CreateRoleRequest
): Promise<Role> => {
  const response = await fetch(API_ENDPOINTS.ROLES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return parseResponse<Role>(response, 'Failed to create role');
};

export const updateRole = async (
  token: string,
  roleId: string,
  data: UpdateRoleRequest
): Promise<Role> => {
  const response = await fetch(API_ENDPOINTS.ROLE(roleId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return parseResponse<Role>(response, 'Failed to update role');
};

export const deactivateRole = async (
  token: string,
  roleId: string
): Promise<Role> => {
  const response = await fetch(API_ENDPOINTS.ROLE(roleId), {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<Role>(response, 'Failed to deactivate role');
};

export const fetchRoleUsers = async (
  roleId: string,
  token?: string | null
): Promise<RoleUser[]> => {
  const response = await fetch(API_ENDPOINTS.ROLE_USERS(roleId), {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<RoleUser[]>(response, 'Failed to fetch role users');
};
