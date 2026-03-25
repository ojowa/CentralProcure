import { buildCsrfHeaders } from './internalAuthService';

const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const defaultBackendBaseUrl =
  process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:5080'
    : 'https://centralprocure-backend.onrender.com';

const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '');

export const backendServiceBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultBackendBaseUrl;

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
    case 'create-tender':
      return `${serviceBaseUrls.vendorSourcing}/api/tenders`;
    case 'bid-opening-session':
      return `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions`;
    case 'assigned-tenders':
    case 'technical-evaluation':
    case 'financial-evaluation':
    case 'evaluation-report':
      return `${serviceBaseUrls.workflow}/api/evaluations/assigned-tenders/default`;
    case 'tender-review':
    case 'approval-rejection':
    case 'high-value-tenders':
    case 'final-approval':
      return `${serviceBaseUrls.workflow}/api/approvals`;
    case 'cgis-approval':
      return `${serviceBaseUrls.workflow}/api/workflow-runtime/cgis-queue`;
    case 'bpp-escalation':
      return `${serviceBaseUrls.workflow}/api/bpp-no-objections`;
    case 'administrative-review':
      return `${serviceBaseUrls.workflow}/api/administrative-reviews`;
    case 'contract-award':
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
    if (response.status === 404) {
      return {
        message: 'No live data available yet.',
        moduleId,
        endpoint: url
      };
    }

    throw new Error(text || `Request failed for module '${moduleId}'.`);
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
