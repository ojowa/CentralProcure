import {
  RoleKey,
  InternalLoginData,
  InternalLoginRequestBackend,
  InternalLoginResponse,
  InternalRegistrationData,
  InternalRegistrationRequestBackend,
  InternalRegistrationResponse,
  InternalOrganizationalUnitRecord,
  InternalRoleRecord,
  InternalModule,
  InternalUserProfile,
  InternalUserProfileUpdateRequest
} from '../types/internal';

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
  INTERNAL_LOGIN: withBasePath('/api/Auth/internal/login'),
  INTERNAL_LOGOUT: withBasePath('/api/Auth/internal/logout'),
  INTERNAL_REGISTER: withBasePath('/api/Auth/internal/register'),
  INTERNAL_ROLES: withBasePath('/api/Auth/roles'),
  INTERNAL_UNITS: withBasePath('/api/Auth/internal/units'),
  INTERNAL_MODULES: withBasePath('/api/Auth/internal/modules'),
  INTERNAL_PROFILE: withBasePath('/api/Auth/internal/profile'),
  INTERNAL_USERS: withBasePath('/api/Auth/internal/users'),
  INTERNAL_USER_ROLE: withBasePath('/api/Auth/internal/users/role'),
};

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const COOKIE_SESSION_TOKEN = '__internal_cookie_session__';
const VALID_ROLES: RoleKey[] = [
  'admin',
  'requisitioning_officer',
  'department_head',
  'procurement_officer',
  'procurement_manager',
  'planning_statistics_officer',
  'financial_unit_officer',
  'legal_reviewer',
  'technical_evaluator',
  'financial_evaluator',
  'evaluation_committee',
  'tenders_board',
  'tenders_board_secretary',
  'accounting_officer',
  'bpp_liaison',
  'bpp_reviewer',
  'complaints_review_officer',
  'contract_manager',
  'inspection_officer',
  'payment_officer',
  'audit_oversight',
  'ict_admin'
];

export const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

export const buildCsrfHeaders = (): Record<string, string> => {
  const csrfToken = getCookieValue(CSRF_COOKIE);
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
};

const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
};

const parseJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const normalizeRoleValue = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withUnderscores = trimmed.replace(/[\s-]+/g, '_');
  const camelToSnake = withUnderscores.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return camelToSnake.toLowerCase();
};

const ROLE_ALIASES: Record<string, RoleKey> = {
  admin: 'admin',
  system_administrator: 'ict_admin',
  requisitioning_officer: 'requisitioning_officer',
  department_user: 'requisitioning_officer',
  department_head: 'department_head',
  procurement_officer: 'procurement_officer',
  procurement_manager: 'procurement_manager',
  procurement_planning_committee: 'planning_statistics_officer',
  planning_statistics_officer: 'planning_statistics_officer',
  financial_unit_officer: 'financial_unit_officer',
  legal_reviewer: 'legal_reviewer',
  technical_evaluator: 'technical_evaluator',
  financial_evaluator: 'financial_evaluator',
  evaluation_committee: 'evaluation_committee',
  tenders_board_member: 'tenders_board',
  tenders_board: 'tenders_board',
  tenders_board_secretary: 'tenders_board_secretary',
  accounting_officer: 'accounting_officer',
  bpp_liaison: 'bpp_liaison',
  bppliaison: 'bpp_liaison',
  bpp_reviewer: 'bpp_reviewer',
  bppreviewer: 'bpp_reviewer',
  complaints_review_officer: 'complaints_review_officer',
  contract_manager: 'contract_manager',
  inspection_officer: 'inspection_officer',
  payment_officer: 'payment_officer',
  audit_officer: 'audit_oversight'
};

const normalizeAllowedRole = (value: unknown): RoleKey | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return resolveRole(value) ?? null;
};

export const resolveRole = (claim: unknown): RoleKey | undefined => {
  if (typeof claim !== 'string') {
    return undefined;
  }

  const normalized = normalizeRoleValue(claim);
  if (!normalized) {
    return undefined;
  }

  if (VALID_ROLES.includes(normalized as RoleKey)) {
    return normalized as RoleKey;
  }

  return ROLE_ALIASES[normalized];
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
        : (payload as { ErrorMessage?: string; message?: string; error?: string } | null)?.ErrorMessage ||
          (payload as { ErrorMessage?: string; message?: string; error?: string } | null)?.message ||
          (payload as { ErrorMessage?: string; message?: string; error?: string } | null)?.error;
    throw new Error(messageFromPayload || fallbackError);
  }

  return payload as T;
};

export const loginInternalUser = async (
  credentials: InternalLoginData
): Promise<InternalLoginResponse> => {
  const requestPayload: InternalLoginRequestBackend = {
    Email: credentials.Email,
    Password: credentials.Password,
  };

  const response = await fetch(API_ENDPOINTS.INTERNAL_LOGIN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(requestPayload)
  });

  const payload = await parseResponse<any>(response, 'Internal login failed.');

  const token = payload?.Token as string | undefined;
  const jwtPayload = token ? parseJwtPayload(token) : null;
  const role = resolveRole(payload?.Role) ?? resolveRole(jwtPayload?.role);
  const internalUserId =
    (typeof payload?.InternalUserId === 'string' ? payload.InternalUserId : undefined) ??
    (typeof jwtPayload?.sub === 'string' ? jwtPayload.sub : undefined);

  return {
    Email: payload?.Email ?? credentials.Email,
    Status: payload?.Status ?? 'Success',
    Token: token ?? '',
    Role: role,
    InternalUserId: internalUserId,
    ErrorMessage: payload?.ErrorMessage
  } as InternalLoginResponse;
};

export const logoutInternalUser = async (): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_LOGOUT, {
    method: 'POST',
    headers: {
      ...buildCsrfHeaders()
    },
    credentials: 'include'
  });

  await parseResponse<unknown>(response, 'Internal logout failed.');
};

export const registerInternalUser = async (
  data: InternalRegistrationData
): Promise<InternalRegistrationResponse> => {
  const requestPayload: InternalRegistrationRequestBackend = {
    Username: data.Username.trim(),
    FirstName: data.FirstName.trim(),
    MiddleName: data.MiddleName.trim() || undefined,
    Surname: data.Surname.trim(),
    ServiceNumber: data.ServiceNumber.trim(),
    UnitId: data.UnitId,
    Email: data.Email,
    Password: data.Password,
    Role: data.Role,
  };

  const response = await fetch(API_ENDPOINTS.INTERNAL_REGISTER, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(requestPayload)
  });

  const payload = await parseResponse<any>(response, 'Internal user registration failed.');

  return {
    InternalUserId: payload.InternalUserId,
    Email: payload.Email,
    Role: payload?.Role ?? data.Role,
    UnitId: payload?.UnitId,
    UnitName: payload?.UnitName,
  } as InternalRegistrationResponse;
};

export const fetchInternalRoles = async (): Promise<InternalRoleRecord[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_ROLES, {
    method: 'GET',
    credentials: 'include'
  });

  const payload = await parseResponse<any>(response, 'Unable to load internal roles.');

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter((role): role is InternalRoleRecord => {
    return Boolean(role) && typeof role.RoleName === 'string';
  });
};

export const fetchInternalUnits = async (): Promise<InternalOrganizationalUnitRecord[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_UNITS, {
    method: 'GET',
    credentials: 'include'
  });

  const payload = await parseResponse<any>(response, 'Unable to load internal organizational units.');

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter((unit): unit is InternalOrganizationalUnitRecord => {
    return Boolean(unit) &&
      typeof unit.UnitId === 'string' &&
      typeof unit.UnitName === 'string' &&
      typeof unit.UnitCode === 'string' &&
      typeof unit.UnitType === 'string' &&
      typeof unit.SortOrder === 'number' &&
      typeof unit.IsAssignable === 'boolean';
  });
};

export const fetchInternalModules = async (token?: string | null): Promise<InternalModule[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULES, {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.ErrorMessage || payload?.message || 'Unable to load internal modules.');
  }

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((module) => {
      return Boolean(module) &&
        typeof module.Id === 'string' &&
        typeof module.Title === 'string' &&
        typeof module.Section === 'string' &&
        typeof module.Description === 'string' &&
        typeof module.Microservice === 'string' &&
        typeof module.ControlPurpose === 'string' &&
        Array.isArray(module.Actions);
    })
    .map((module) => ({
      id: module.Id,
      title: module.Title,
      section: module.Section,
      description: module.Description,
      microservice: module.Microservice,
      controlPurpose: module.ControlPurpose,
      actions: Array.isArray(module.Actions)
        ? module.Actions.filter((action: unknown): action is string => typeof action === 'string')
        : [],
      catalogActions: Array.isArray(module.CatalogActions)
        ? module.CatalogActions.filter((action: unknown): action is string => typeof action === 'string')
        : [],
      allowedRoles: Array.isArray(module.AllowedRoles)
        ? module.AllowedRoles
            .map((roleValue: unknown) => normalizeAllowedRole(roleValue))
            .filter((roleValue: RoleKey | null): roleValue is RoleKey => Boolean(roleValue))
        : []
    }));
};

export const fetchInternalUserProfile = async (token?: string | null): Promise<InternalUserProfile> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_PROFILE, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  return parseResponse<InternalUserProfile>(response, 'Unable to load your profile.');
};

export const updateInternalUserProfile = async (
  token: string | null | undefined,
  data: InternalUserProfileUpdateRequest
): Promise<InternalUserProfile> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_PROFILE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  return parseResponse<InternalUserProfile>(response, 'Unable to update your profile.');
};

export const fetchInternalUsers = async (token: string): Promise<InternalUserProfile[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USERS, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include'
  });

  return parseResponse<InternalUserProfile[]>(response, 'Unable to fetch internal users.');
};

export const updateInternalUserRole = async (
  token: string,
  data: { InternalUserId: string; Role: string }
): Promise<any> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_USER_ROLE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  return parseResponse<any>(response, 'Unable to update user role.');
};

