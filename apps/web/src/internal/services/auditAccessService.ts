import {
  RoleModuleAccessGrant,
  UserModuleAccessGrant,
  ModuleAccessAuditEntry
} from './internalAuthService';

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

const API_BASE = withBasePath('/api/Auth/internal/module-access');

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

const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
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

export type { RoleModuleAccessGrant, UserModuleAccessGrant, ModuleAccessAuditEntry };

export interface AuditQueryParams {
  RoleName?: string;
  InternalUserId?: string;
  Limit?: number;
}

export interface AuditFilters {
  targetType?: 'role' | 'user' | 'all';
  moduleId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const fetchModuleAccessAudit = async (
  token: string,
  params: AuditQueryParams
): Promise<ModuleAccessAuditEntry[]> => {
  const query = new URLSearchParams();
  if (params.RoleName) query.set('roleName', params.RoleName);
  if (params.InternalUserId) query.set('internalUserId', params.InternalUserId);
  if (params.Limit) query.set('limit', String(params.Limit));

  const response = await fetch(`${API_BASE}/audit?${query.toString()}`, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<ModuleAccessAuditEntry[]>(response, 'Failed to fetch audit');
};

export const fetchRoleModuleAccessGrants = async (token: string): Promise<RoleModuleAccessGrant[]> => {
  const response = await fetch(`${API_BASE}/roles`, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<RoleModuleAccessGrant[]>(response, 'Failed to fetch role module access');
};

export const fetchUserModuleAccessGrants = async (token: string): Promise<UserModuleAccessGrant[]> => {
  const response = await fetch(`${API_BASE}/users`, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  return parseResponse<UserModuleAccessGrant[]>(response, 'Failed to fetch user module access');
};

export const exportAuditToCsv = (entries: ModuleAccessAuditEntry[]): string => {
  const rows = [
    ['When', 'Target', 'Module', 'From', 'To', 'Source'],
    ...entries.map(entry => {
      const targetLabel = entry.TargetType === 'role'
        ? entry.RoleName ?? 'Role'
        : entry.Email ?? entry.Username ?? entry.InternalUserId ?? 'User';
      const fromState = entry.PreviousState === null || entry.PreviousState === undefined
        ? 'Default'
        : entry.PreviousState ? 'Allowed' : 'Denied';
      const toState = entry.NewState === null || entry.NewState === undefined
        ? 'Default'
        : entry.NewState ? 'Allowed' : 'Denied';
      return [
        new Date(entry.ChangedAt).toLocaleString(),
        targetLabel,
        entry.ModuleId,
        fromState,
        toState,
        entry.ChangeSource
      ];
    })
  ];

  return rows.map(row =>
    row.map(cell => {
      const value = String(cell ?? '');
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');
};

export const downloadAuditCsv = (entries: ModuleAccessAuditEntry[], filename?: string): void => {
  const content = exportAuditToCsv(entries);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'module_access_audit.csv';
  link.click();
  URL.revokeObjectURL(url);
};

export const formatAuditState = (state: boolean | null | undefined): string => {
  if (state === null || state === undefined) return 'Default';
  return state ? 'Allowed' : 'Denied';
};

export const getAuditTargetLabel = (entry: ModuleAccessAuditEntry): string => {
  if (entry.TargetType === 'role') {
    return entry.RoleName ?? 'Role';
  }
  return entry.Email ?? entry.Username ?? entry.InternalUserId ?? 'User';
};
