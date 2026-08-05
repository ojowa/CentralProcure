const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const defaultApiBaseUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000'
  : '';

const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '');

export const apiServiceBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? defaultApiBaseUrl;

export const applyBasePath = (path: string): string => `${appBasePath}${path}`;

// All internal microservices are reached through the same origin/rewrite today.
export const serviceBaseUrls = {
  identity: appBasePath,
  workflow: appBasePath,
  vendorSourcing: appBasePath,
  postAward: appBasePath,
  governance: appBasePath,
};

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const COOKIE_SESSION_TOKEN = '__internal_cookie_session__';
const JWT_STORAGE_KEY = '__internal_jwt_token__';

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

export const getStoredJwt = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(JWT_STORAGE_KEY);
};

export const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  const resolved = token && token !== COOKIE_SESSION_TOKEN ? token : getStoredJwt();
  if (!resolved) {
    return {};
  }

  return {
    Authorization: `Bearer ${resolved}`
  };
};

export type JsonBody = Record<string, unknown> | null;

export type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
};

export const formatProblemDetails = (payload: ProblemDetails) => {
  const fieldErrors = payload.errors
    ? Object.values(payload.errors)
        .flat()
        .filter(Boolean)
    : [];

  if (fieldErrors.length > 0) {
    return fieldErrors.join(' ');
  }

  return payload.detail || payload.title || (payload.status ? `Request failed (${payload.status}).` : 'Request failed.');
};

export const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!response.ok) {
    if (text) {
      try {
        const problem = JSON.parse(text) as ProblemDetails & { ErrorMessage?: string; message?: string; error?: string };
        const message =
          problem?.ErrorMessage ||
          problem?.message ||
          problem?.error ||
          (problem.status || problem.title || problem.detail || problem.errors
            ? formatProblemDetails(problem)
            : '');
        if (message) {
          throw new Error(message);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== text) {
          throw e;
        }
      }
      throw new Error(text);
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return text ? JSON.parse(text) as T : ({} as T);
};

export const send = async <T>(
  baseUrl: string,
  path: string,
  token: string,
  init?: RequestInit,
  body?: JsonBody
): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json', ...buildCsrfHeaders() } : {}),
      ...(init?.headers ?? {})
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : init?.body
  });

  return parseJson<T>(response);
};