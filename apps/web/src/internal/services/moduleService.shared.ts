import { buildAuthHeaders } from './apiClient';

export {
  apiServiceBaseUrl,
  serviceBaseUrls,
  applyBasePath,
  CSRF_COOKIE,
  COOKIE_SESSION_TOKEN,
  getCookieValue,
  buildCsrfHeaders,
  getStoredJwt,
  buildCsrfHeaders as buildCsrfHeadersCompat,
  formatProblemDetails,
  parseJson,
  send
} from './apiClient';

export type { JsonBody, ProblemDetails } from './apiClient';

const resolveModuleUrl = (moduleId: string): string => {
  switch (moduleId) {
    case 'annual-procurement-plan':
      return `/api/procurement-plans`;
    case 'procurement-method-determination':
      return `/api/procurement-methods/queue`;
    case 'create-tender':
      return `/api/tenders`;
    case 'bid-opening-session':
      return `/api/bid-opening/sessions`;
    case 'assigned-tenders':
    case 'technical-evaluation':
    case 'financial-evaluation':
      return `/api/evaluations/assigned-tenders/default`;
    case 'evaluation-report':
      return `/api/evaluation-reports`;
    case 'tender-review':
    case 'approval-rejection':
    case 'tenders-board-approval':
      return `/api/tenders-board-approvals/queue`;
    case 'high-value-tenders':
      return `/api/workflow-runtime/cgis-queue`;
    case 'cgis-approval':
    case 'final-approval':
      return `/api/workflow-runtime/cgis-queue`;
    case 'bpp-escalation':
      return `/api/bpp-no-objections`;
    case 'administrative-review':
      return `/api/administrative-reviews`;
    case 'contract-award':
      return `/api/contracts/awards`;
    case 'contract-management':
      return `/api/contracts`;
    case 'inspection-acceptance':
      return `/api/inspections`;
    case 'payment-tracking':
      return `/api/payments`;
    case 'budget-workspace':
      return `/api/budget/dashboard`;
    case 'audit-dashboard':
    case 'audit-trail-viewer':
    case 'compliance-reports':
      return `/api/audit`;
    case 'workflow-configuration':
      return `/api/config/workflows`;
    case 'system-monitoring':
      return `/api/monitoring`;
    case 'user-role-management':
      return `/api/Auth/roles`;
    default:
      return `/api/notifications`;
  }
};

export const fetchModuleData = async (moduleId: string, token: string, datasetUrl?: string | null): Promise<unknown> => {
  const finalUrl = datasetUrl || resolveModuleUrl(moduleId);

  const response = await fetch(finalUrl, {
    headers: buildAuthHeaders(token),
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
  const url = `/api/workflow-runtime/cgis-queue`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
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