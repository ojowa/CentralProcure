import { buildCsrfHeaders } from './internalAuthService';

const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const defaultApiBaseUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000'
  : 'https://centralprocure.onrender.com';

const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '');

export const apiServiceBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? defaultApiBaseUrl;

export const serviceBaseUrls = {
  identity: appBasePath,
  workflow: appBasePath,
  vendorSourcing: appBasePath,
  postAward: appBasePath,
  governance: appBasePath,
};

const resolveModuleUrl = (moduleId: string): string => {
  switch (moduleId) {
    case 'create-requisition':
    case 'requisition-history':
    case 'requisition-tracking':
      return `${serviceBaseUrls.workflow}/api/requisitions`;
    case 'annual-procurement-plan':
    case 'procurement-planning-committee':
      return `${serviceBaseUrls.workflow}/api/procurement-plans`;
    case 'procurement-method-determination':
      return `${serviceBaseUrls.workflow}/api/procurement-methods/queue`;
    case 'create-tender':
      return `${serviceBaseUrls.vendorSourcing}/api/tenders`;
    case 'bid-opening-session':
      return `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions`;
    case 'assigned-tenders':
    case 'technical-evaluation':
    case 'financial-evaluation':
      return `${serviceBaseUrls.workflow}/api/evaluations/assigned-tenders/default`;
    case 'evaluation-report':
      return `${serviceBaseUrls.workflow}/api/evaluation-reports`;
    case 'tender-review':
    case 'approval-rejection':
    case 'tenders-board-approval':
      return `${serviceBaseUrls.workflow}/api/tenders-board-approvals/queue`;
    case 'high-value-tenders':
      return `${serviceBaseUrls.workflow}/api/workflow-runtime/cgis-queue`;
    case 'cgis-approval':
    case 'final-approval':
      return `${serviceBaseUrls.workflow}/api/workflow-runtime/cgis-queue`;
    case 'bpp-escalation':
      return `${serviceBaseUrls.workflow}/api/bpp-no-objections`;
    case 'administrative-review':
      return `${serviceBaseUrls.workflow}/api/administrative-reviews`;
    case 'contract-award':
      return `${serviceBaseUrls.postAward}/api/contracts/awards`;
    case 'contract-management':
      return `${serviceBaseUrls.postAward}/api/contracts`;
    case 'inspection-acceptance':
      return `${serviceBaseUrls.postAward}/api/inspections`;
    case 'payment-tracking':
      return `${serviceBaseUrls.postAward}/api/payments`;
    case 'budget-workspace':
      return `${serviceBaseUrls.governance}/api/budget/dashboard`;
    case 'audit-dashboard':
    case 'audit-trail-viewer':
    case 'compliance-reports':
      return `${serviceBaseUrls.governance}/api/audit`;
    case 'workflow-configuration':
      return `${serviceBaseUrls.workflow}/api/config/workflows`;
    case 'system-monitoring':
      return `${serviceBaseUrls.governance}/api/monitoring`;
    case 'user-role-management':
      return `${serviceBaseUrls.identity}/api/Auth/roles`;
    default:
      return `${serviceBaseUrls.governance}/api/notifications`;
  }
};

export const fetchModuleData = async (moduleId: string, token: string): Promise<unknown> => {
  const url = resolveModuleUrl(moduleId);
  const finalUrl = moduleId === 'procurement-planning-committee'
    ? `${serviceBaseUrls.workflow}/api/procurement-plans?status=Under%20Review`
    : url;

  const response = await fetch(finalUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed for module '${moduleId}'.`);
  }

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (moduleId === 'workflow-configuration') {
      const stages = Array.isArray(parsed) ? parsed : parsed?.Stages ?? [];
      return {
        Title: 'Workflow Configuration',
        Summary: 'System workflow configuration',
        Stages: stages,
        Transitions: parsed?.Transitions ?? [],
        RoleTasks: parsed?.RoleTasks ?? [],
        Thresholds: parsed?.Thresholds ?? [],
        Roles: parsed?.Roles ?? [],
        GovernanceBodies: parsed?.GovernanceBodies ?? []
      };
    }
    return parsed;
  } catch {
    return text;
  }
};

export const fetchCgisQueue = async (token: string): Promise<unknown> => {
  const url = `${serviceBaseUrls.workflow}/api/workflow-runtime/cgis-queue`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || 'Unable to load the CGIS queue.');
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export { buildCsrfHeaders };

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
        const problem = JSON.parse(text) as ProblemDetails;
        throw new Error(formatProblemDetails(problem));
      } catch {
        throw new Error(text);
      }
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return text ? JSON.parse(text) as T : ({} as T);
};

export const send = async <T>(baseUrl: string, path: string, token: string, init?: RequestInit, body?: JsonBody): Promise<T> => {
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
