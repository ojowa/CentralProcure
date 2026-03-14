const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

export const serviceBaseUrls = {
  identity: backendBaseUrl,
  workflow: backendBaseUrl,
  vendorSourcing: backendBaseUrl,
  postAward: backendBaseUrl,
  governance: backendBaseUrl,
};

const resolveModuleUrl = (moduleId: string): string => {
  switch (moduleId) {
    // Procurement Workflow Service
    case 'create-requisition':
    case 'requisition-history':
    case 'requisition-tracking':
      return `${serviceBaseUrls.workflow}/api/requisitions`;
    case 'annual-procurement-plan':
    case 'procurement-planning-committee':
      return `${serviceBaseUrls.workflow}/api/procurement-plans`;
    case 'create-tender':
    case 'publish-tender':
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
    case 'bpp-escalation':
      return `${serviceBaseUrls.workflow}/api/bpp-no-objections`;
    case 'administrative-review':
      return `${serviceBaseUrls.workflow}/api/administrative-reviews`;

    // Post-Award Service
    case 'contract-award':
    case 'contract-management':
      return `${serviceBaseUrls.postAward}/api/contracts`;
    case 'inspection-acceptance':
      return `${serviceBaseUrls.postAward}/api/inspections`;
    case 'payment-tracking':
      return `${serviceBaseUrls.postAward}/api/payments`;

    // Governance Service
    case 'audit-dashboard':
    case 'audit-trail-viewer':
    case 'compliance-reports':
      return `${serviceBaseUrls.governance}/api/audit`;
    case 'workflow-configuration':
      return `${serviceBaseUrls.workflow}/api/config/workflows`;
    case 'system-monitoring':
      return `${serviceBaseUrls.governance}/api/monitoring`;
    
    // Identity Service
    case 'user-role-management':
      return `${serviceBaseUrls.identity}/api/Auth/roles`;

    default:
      return `${serviceBaseUrls.governance}/api/notifications`;
  }
};

export const fetchModuleData = async (moduleId: string, token: string): Promise<unknown> => {
  const url = resolveModuleUrl(moduleId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
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
