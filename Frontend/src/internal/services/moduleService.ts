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

// Use same-origin API paths so Next.js rewrites handle backend routing and cookies/CORS stay consistent.
export const serviceBaseUrls = {
  identity: appBasePath,
  workflow: appBasePath,
  vendorSourcing: appBasePath,
  postAward: appBasePath,
  governance: appBasePath,
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
    case 'cgis-approval':
      return `${serviceBaseUrls.workflow}/api/workflow-runtime/cgis-queue`;
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
    case 'procurement-planning-committee':
      return `${serviceBaseUrls.workflow}/api/planning-committee`;

    default:
      return `${serviceBaseUrls.governance}/api/notifications`;
  }
};

export const fetchModuleData = async (moduleId: string, token: string): Promise<unknown> => {
  const url = resolveModuleUrl(moduleId);
  
  // Specific override for planning committee list to fetch plans in the right stage
  const finalUrl = moduleId === 'procurement-planning-committee' 
    ? `${serviceBaseUrls.workflow}/api/procurement-plans?status=Submitted`
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

export const fetchPlanDetails = async (planId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/procurement-plans/${planId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch plan details');
  }
  return response.json();
};

export const createPlan = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/procurement-plans`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to create plan');
  }
  return response.json();
};

export const createPlanItem = async (planId: string, data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/procurement-plan-items`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ ...data, planId })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to add item');
  }
  return response.json();
};

export const fetchTenderDetails = async (tenderId: string, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/tenders/${tenderId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch tender details');
  return response.json();
};

export const createTender = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/tenders`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to create tender');
  }
  return response.json();
};

export const publishTender = async (tenderId: string, data: any, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/tenders/${tenderId}/publish`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to publish tender');
  }
  return response.json();
};

export const fetchAssignedTenders = async (token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/evaluations/assigned-tenders/default`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch assigned tenders');
  return response.json();
};

export const logEvaluationAction = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/evaluations/actions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to log evaluation action');
  }
  return response.json();
};

export const fetchTenderBids = async (tenderId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/tenders/${tenderId}/bids`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch bids for evaluation');
  return response.json();
};

export const fetchApprovedRequisitions = async (token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/requisitions?status=Approved`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch approved requisitions');
  const data = await response.json();
  return data.Items || data; // Handle different response shapes
};

export const fetchBidOpeningSessions = async (token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to fetch bid opening sessions (${response.status})`);
  }
  const data = await response.json();
  return data.Items || data;
};

export const updateRequisitionStatus = async (requisitionId: string, status: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/requisitions/${requisitionId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to update requisition status');
  }
  return response.json();
};

export const fetchEvaluationReports = async (status: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/evaluation-reports?status=${status}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch evaluation reports');
  return response.json();
};

export const fetchContracts = async (token: string) => {
  const url = `${serviceBaseUrls.postAward}/api/contracts`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch contracts');
  return response.json();
};

export const fetchContractMilestones = async (contractId: string, token: string) => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/${contractId}/milestones`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch milestones');
  return response.json();
};

export const logContractMilestone = async (contractId: string, data: any, token: string) => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/${contractId}/milestones`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to log milestone');
  }
  return response.json();
};

export const fetchBppNoObjections = async (token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/bpp-no-objections`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch BPP no-objections');
  return response.json();
};

export const createBppNoObjection = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/bpp-no-objections`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to create BPP escalation');
  }
  return response.json();
};

export const fetchAdministrativeReviews = async (token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/administrative-reviews`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch administrative reviews');
  return response.json();
};

export const submitAdministrativeReviewDecision = async (complaintId: string, data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/administrative-reviews/${complaintId}`;
  
  // Map internal module form state to the DTO expected by the backend
  const payload = {
    Status: 'Resolved',
    ResolutionOutcome: data.outcome,
    ResolutionStageKey: data.resolutionStageKey || undefined,
    ResolutionNotes: data.resolutionNotes
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to resolve review');
  }
  return response.json();
};

export const fetchBidOpeningSessionDetails = async (sessionId: string, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions/${sessionId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch session details');
  return response.json();
};

export const createBidOpeningSession = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to create session');
  }
  return response.json();
};

export const updateBidOpeningSession = async (sessionId: string, data: any, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions/${sessionId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to update session');
  }
  return response.json();
};

export const fetchMemberReviews = async (planId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/plans/${planId}/reviews`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch member reviews');
  }
  return response.json();
};

export const submitMemberReview = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/submit-member-review`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to submit member review');
  }
  return response.json();
};

export const submitCommitteeDecision = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/submit-committee-decision`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to submit committee decision');
  }
  return response.json();
};

export const fetchCgisDocuments = async (entityType: string, entityId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/cgis-approval/documents/${entityType}/${entityId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch case documents.');
  }
  return response.json();
};

export const applyCgisAction = async (action: 'approve' | 'reject' | 'return' | 'escalate', data: any, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/cgis-approval/${action}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to ${action} case.`);
  }
  return response.json();
};
