import {
  RoleKey,
  InternalLoginData,
  InternalLoginRequestApi,
  InternalLoginResponse,
  InternalRegistrationData,
  InternalRegistrationRequestApi,
  InternalRegistrationResponse,
  InternalOrganizationalUnitRecord,
  InternalRoleRecord,
  InternalModule,
  InternalUserProfile,
  InternalUserProfileUpdateRequest,
  InternalUnitStaffRecord,
  InternalNotificationResult
} from '../types/internal';
import { decodeJwtPayload } from '../../shared/utils/jwt';
import {
  applyBasePath as withBasePath,
  buildCsrfHeaders,
  COOKIE_SESSION_TOKEN,
  buildAuthHeaders
} from './apiClient';

export { buildCsrfHeaders, COOKIE_SESSION_TOKEN, buildAuthHeaders };

const API_ENDPOINTS = {
  INTERNAL_LOGIN: withBasePath('/api/Auth/internal/login'),
  INTERNAL_LOGOUT: withBasePath('/api/Auth/internal/logout'),
  INTERNAL_REGISTER: withBasePath('/api/Auth/internal/register'),
  INTERNAL_ROLES: withBasePath('/api/Auth/roles'),
  INTERNAL_UNITS: withBasePath('/api/Auth/internal/units'),
  INTERNAL_UNIT_STAFF: (unitId: string) => withBasePath(`/api/Auth/internal/units/${unitId}/staff`),
  INTERNAL_MODULES: withBasePath('/api/Auth/internal/modules'),
  INTERNAL_PROFILE: withBasePath('/api/Auth/internal/profile'),
  INTERNAL_USERS: withBasePath('/api/Auth/internal/users'),
  INTERNAL_USER_ROLE: withBasePath('/api/Auth/internal/users/role'),
  INTERNAL_MODULES_CATALOG: withBasePath('/api/Auth/internal/modules/catalog'),
  INTERNAL_MODULE_ACCESS_ROLES: withBasePath('/api/Auth/internal/module-access/roles'),
  INTERNAL_MODULE_ACCESS_USERS: withBasePath('/api/Auth/internal/module-access/users'),
  INTERNAL_MODULE_ACCESS_AUDIT: withBasePath('/api/Auth/internal/module-access/audit'),
  INTERNAL_USER_ROLE_AUDIT: withBasePath('/api/Auth/internal/user-role/audit'),
  INTERNAL_NOTIFICATIONS: withBasePath('/api/Auth/internal/notifications'),
  INTERNAL_NOTIFICATION_READ: (id: string) => withBasePath(`/api/Auth/internal/notifications/${id}/read`),
  INTERNAL_NOTIFICATION_READ_ALL: withBasePath('/api/Auth/internal/notifications/read-all'),
  CSRF_INIT: withBasePath('/api/Auth/csrf'),
};

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const getStoredJwtInternal = (): string | null => (typeof window === 'undefined' ? null : window.localStorage.getItem('__internal_jwt_token__'));

// Roles are defined by the database (identity.roles.role_key). No normalization
// or aliasing is performed client-side: the API returns the canonical role_key
// in the JWT payload, and we pass it through untouched.
export const resolveCanonicalRole = (...claims: unknown[]): RoleKey | undefined => {
  for (const claim of claims) {
    if (typeof claim === 'string') {
      const trimmed = claim.trim();
      if (trimmed) {
        return trimmed as RoleKey;
      }
    }
  }

  return undefined;
};

const parseJwtPayload = (token: string): Record<string, unknown> | null => decodeJwtPayload(token);

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
    const statusMessage = response.statusText
      ? `${response.status} ${response.statusText}`
      : `${response.status}`;
    throw new Error(messageFromPayload || `${fallbackError} (${statusMessage})`);
  }

  return payload as T;
};

export const loginInternalUser = async (
  credentials: InternalLoginData
): Promise<InternalLoginResponse> => {
  const requestPayload: InternalLoginRequestApi = {
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

  const token = (payload?.Token ?? payload?.token) as string | undefined;
  const jwtPayload = token ? parseJwtPayload(token) : null;
  const role = resolveCanonicalRole(
    payload?.CanonicalRoleKey,
    payload?.canonicalRoleKey,
    payload?.Role,
    payload?.role,
    jwtPayload?.role
  );
  const internalUserId =
    (typeof payload?.InternalUserId === 'string' ? payload.InternalUserId : (typeof payload?.internalUserId === 'string' ? payload.internalUserId : undefined)) ??
    (typeof jwtPayload?.sub === 'string' ? jwtPayload.sub : undefined);

  return {
    Email: payload?.Email ?? payload?.email ?? credentials.Email,
    Status: payload?.Status ?? payload?.status ?? 'Success',
    Token: token ?? '',
    Role: role,
    CanonicalRoleKey: role,
    InternalUserId: internalUserId,
    ErrorMessage: payload?.ErrorMessage ?? payload?.errorMessage
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
  const requestPayload: InternalRegistrationRequestApi = {
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
      ...buildAuthHeaders(),
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
    headers: buildAuthHeaders(),
    credentials: 'include'
  });

  const payload = await parseResponse<any>(response, 'Unable to load internal roles.');

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter((role): role is InternalRoleRecord => {
    return Boolean(role) && typeof role.RoleName === 'string';
  }).map((role) => ({
    RoleId: role.RoleId,
    RoleName: role.RoleName,
    CanonicalRoleKey: resolveCanonicalRole(role.CanonicalRoleKey, role.RoleName),
    Description: role.Description,
    IsActive: Boolean(role.IsActive)
  }));
};

export const fetchInternalUnits = async (): Promise<InternalOrganizationalUnitRecord[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_UNITS, {
    method: 'GET',
    headers: buildAuthHeaders(),
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

export const manageInternalUnit = async (
  token: string,
  data: {
    UnitId?: string;
    UnitCode: string;
    UnitName: string;
    UnitType: string;
    ParentUnitId?: string;
    SortOrder: number;
    IsAssignable: boolean;
    IsActive: boolean;
  }
): Promise<InternalOrganizationalUnitRecord> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_UNITS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  return parseResponse<InternalOrganizationalUnitRecord>(response, 'Unable to manage organizational unit.');
};

export const fetchInternalUnitStaff = async (
  token: string,
  unitId: string
): Promise<InternalUnitStaffRecord[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_UNIT_STAFF(unitId), {
    method: 'GET',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  return parseResponse<InternalUnitStaffRecord[]>(response, 'Unable to load unit staff.');
};

const mapInternalModule = (module: Record<string, unknown>): InternalModule => ({
  id: module.ModuleId as string,
  title: module.Title as string,
  section: module.Section as string,
  description: module.Description as string,
  microservice: module.Microservice as string,
  controlPurpose: module.ControlPurpose as string,
  actions: Array.isArray(module.Actions)
    ? (module.Actions as unknown[]).filter((a): a is string => typeof a === 'string')
    : [],
  catalogActions: Array.isArray(module.CatalogActions)
    ? (module.CatalogActions as unknown[]).filter((a): a is string => typeof a === 'string')
    : [],
  grantSource: typeof module.GrantSource === 'string' ? module.GrantSource : undefined,
  isVisible: typeof module.IsVisible === 'boolean' ? module.IsVisible : undefined,
  hasRoleOverride: typeof module.HasRoleOverride === 'boolean' ? module.HasRoleOverride : undefined,
  hasUserOverride: typeof module.HasUserOverride === 'boolean' ? module.HasUserOverride : undefined,
  requiredPermission: typeof module.RequiredPermission === 'string' ? module.RequiredPermission : undefined,
  group: typeof module.Group === 'string' ? module.Group as InternalModule['group'] : undefined,
  subSection: typeof module.SubSection === 'string' ? module.SubSection : null,
  datasetUrl: typeof module.DatasetUrl === 'string' ? module.DatasetUrl : null,
  hasDataset: typeof module.HasDataset === 'boolean' ? module.HasDataset : undefined,
});

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
        typeof module.ModuleId === 'string' &&
        typeof module.Title === 'string' &&
        typeof module.Section === 'string' &&
        typeof module.Description === 'string' &&
        typeof module.Microservice === 'string' &&
        typeof module.ControlPurpose === 'string' &&
        Array.isArray(module.Actions);
    })
    .map(mapInternalModule);
};

export const fetchInternalModulesCatalog = async (token?: string | null): Promise<InternalModule[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULES_CATALOG, {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  const payload = await parseResponse<any>(response, 'Unable to load internal module catalog.');

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((module) => {
      return Boolean(module) &&
        typeof module.ModuleId === 'string' &&
        typeof module.Title === 'string' &&
        typeof module.Section === 'string' &&
        typeof module.Description === 'string' &&
        typeof module.Microservice === 'string' &&
        typeof module.ControlPurpose === 'string';
    })
    .map(mapInternalModule);
};

export type RoleModuleAccessGrant = {
  RoleName: string;
  ModuleId: string;
  IsEnabled: boolean;
  UpdatedAt: string;
};

export type UserModuleAccessGrant = {
  InternalUserId: string;
  Email: string;
  Username: string;
  RoleName: string;
  ModuleId: string;
  IsEnabled: boolean;
  UpdatedAt: string;
};

export const fetchRoleModuleAccessGrants = async (token: string): Promise<RoleModuleAccessGrant[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES, {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  return parseResponse<RoleModuleAccessGrant[]>(response, 'Unable to load role module access grants.');
};

export const fetchUserModuleAccessGrants = async (token: string): Promise<UserModuleAccessGrant[]> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS, {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  return parseResponse<UserModuleAccessGrant[]>(response, 'Unable to load user module access grants.');
};

export const updateRoleModuleAccessGrant = async (
  token: string,
  data: { RoleName: string; ModuleId: string; IsEnabled: boolean }
): Promise<RoleModuleAccessGrant> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_ROLES, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    body: JSON.stringify(data)
  });

  return parseResponse<RoleModuleAccessGrant>(response, 'Unable to update role module access.');
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
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  await parseResponse<unknown>(response, 'Unable to reset role module access.');
};

export const updateUserModuleAccessGrant = async (
  token: string,
  data: { InternalUserId: string; ModuleId: string; IsEnabled: boolean }
): Promise<UserModuleAccessGrant> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    body: JSON.stringify(data)
  });

  return parseResponse<UserModuleAccessGrant>(response, 'Unable to update user module access.');
};

export const bulkUpdateUserModuleAccessGrants = async (
  token: string,
  data: { InternalUserId: string; Grants: Array<{ ModuleId: string; IsEnabled: boolean }> }
): Promise<void> => {
  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS}/bulk`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    body: JSON.stringify(data)
  });

  await parseResponse<unknown>(response, 'Unable to bulk update user module access.');
};

export const bulkResetUserModuleAccessGrants = async (
  token: string,
  params: { InternalUserId: string }
): Promise<void> => {
  const query = new URLSearchParams({
    internalUserId: params.InternalUserId
  });

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_MODULE_ACCESS_USERS}/bulk?${query.toString()}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  await parseResponse<unknown>(response, 'Unable to reset user module access.');
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
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  await parseResponse<unknown>(response, 'Unable to reset user module access.');
};

export type ModuleAccessAuditEntry = {
  AuditId: string;
  TargetType: string;
  RoleName?: string | null;
  InternalUserId?: string | null;
  Email?: string | null;
  Username?: string | null;
  ModuleId: string;
  PreviousState?: boolean | null;
  NewState?: boolean | null;
  ChangedBy?: string | null;
  ChangeSource: string;
  ChangedAt: string;
};

export type UserRoleAuditResult = {
  AuditId: string;
  TargetInternalUserId: string;
  TargetEmail: string;
  TargetUsername: string;
  PreviousRoleName?: string | null;
  NewRoleName: string;
  ChangedByEmail?: string | null;
  ChangedByUsername?: string | null;
  ChangedAt: string;
  ChangeReason?: string | null;
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
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  return parseResponse<ModuleAccessAuditEntry[]>(response, 'Unable to load module access audit.');
};

export const fetchUserRoleAudit = async (
  token: string,
  params: { InternalUserId?: string; Limit?: number }
): Promise<UserRoleAuditResult[]> => {
  const query = new URLSearchParams();
  if (params.InternalUserId) query.set('internalUserId', params.InternalUserId);
  if (params.Limit) query.set('limit', String(params.Limit));

  const response = await fetch(`${API_ENDPOINTS.INTERNAL_USER_ROLE_AUDIT}?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(token)
  });

  return parseResponse<UserRoleAuditResult[]>(response, 'Unable to load user role audit.');
};

export const fetchInternalNotifications = async (
  token: string,
  limit: number = 50
): Promise<InternalNotificationResult[]> => {
  const response = await fetch(`${API_ENDPOINTS.INTERNAL_NOTIFICATIONS}?limit=${limit}`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  return parseResponse<InternalNotificationResult[]>(response, 'Unable to load notifications.');
};

export const markInternalNotificationAsRead = async (
  token: string,
  notificationId: string
): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_NOTIFICATION_READ(notificationId), {
    method: 'PUT',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  await parseResponse<void>(response, 'Unable to mark notification as read.');
};

export const markAllNotificationsAsRead = async (token: string): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_NOTIFICATION_READ_ALL, {
    method: 'PUT',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  await parseResponse<void>(response, 'Unable to mark all notifications as read.');
};

export const createInternalNotification = async (
  token: string,
  data: { UserId?: string; Title: string; Message: string; NotificationType?: string; EntityType?: string; EntityId?: string }
): Promise<{ Status: string; NotificationId?: string; SentTo?: number }> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_NOTIFICATIONS, {
    method: 'POST',
    headers: { ...buildAuthHeaders(token), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return parseResponse(response, 'Unable to create notification.');
};

export const fetchInternalUserProfile = async (
  token?: string | null
): Promise<InternalUserProfile> => {
  const response = await fetch(API_ENDPOINTS.INTERNAL_PROFILE, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  const payload = await parseResponse<InternalUserProfile>(response, 'Unable to load your profile.');
  return {
    ...payload,
    CanonicalRoleKey: resolveCanonicalRole(payload?.CanonicalRoleKey, payload?.RoleName)
  };
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
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });

  const payload = await parseResponse<InternalUserProfile[]>(response, 'Unable to fetch internal users.');
  return Array.isArray(payload)
    ? payload.map((user) => ({
        ...user,
        CanonicalRoleKey: resolveCanonicalRole(user.CanonicalRoleKey, user.RoleName)
      }))
    : [];
};

export const updateInternalUserRole = async (
  token: string,
  data: { 
    InternalUserId: string; 
    Role: string;
    EffectiveFrom?: string | null;
    ExpiresAt?: string | null;
    BackupRole?: string | null;
    Reason?: string | null;
  }
): Promise<any> => {
  const { InternalUserId, Role, Reason, ...rest } = data;
  const response = await fetch(withBasePath(`/api/Auth/internal/users/${InternalUserId}/role`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ RoleKey: Role, ChangeReason: Reason, ...rest })
  });

  return parseResponse<any>(response, 'Unable to update user role.');
};

export const fetchCsrfToken = async (): Promise<void> => {
  try {
    await fetch(API_ENDPOINTS.CSRF_INIT, {
      method: 'GET',
      credentials: 'include'
    });
  } catch (error) {
    console.warn('[Internal Auth] CSRF init failed (ignoring for resilience):', error);
  }
};


