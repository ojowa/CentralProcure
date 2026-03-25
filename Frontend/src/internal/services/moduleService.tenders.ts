import { buildCsrfHeaders, serviceBaseUrls } from './moduleService.shared';
import { COOKIE_SESSION_TOKEN } from './internalAuthService';

type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
};

const parseProblemText = (text: string, status: number, fallback: string) => {
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as ProblemDetails;
    const fieldErrors = payload.errors
      ? Object.values(payload.errors)
          .flat()
          .filter(Boolean)
      : [];

    return fieldErrors.join(' ')
      || payload.message
      || payload.error
      || payload.detail
      || payload.title
      || fallback;
  } catch {
    return text || fallback || `Request failed (${status}).`;
  }
};

const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
};

export const fetchTenderDetails = async (tenderId: string, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/internal/tenders/${tenderId}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch tender details');
  return response.json();
};

export const createTender = async (data: any, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/internal/tenders`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseProblemText(text, response.status, `Failed to create tender (${response.status}).`));
  }
  return response.json();
};

export const publishTender = async (tenderId: string, data: any, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/internal/tenders/${tenderId}/publish`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseProblemText(text, response.status, `Failed to publish tender (${response.status}).`));
  }
  return response.json();
};

export const deleteTender = async (tenderId: string, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/internal/tenders/${tenderId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...buildAuthHeaders(token),
      ...buildCsrfHeaders()
    },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseProblemText(text, response.status, `Failed to delete tender (${response.status}).`));
  }
};

export const fetchAssignedTenders = async (token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/evaluations/assigned-tenders/default`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
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
    if (text) {
      try {
        const payload = JSON.parse(text) as { message?: string; detail?: string; title?: string };
        throw new Error(payload.message || payload.detail || payload.title || `Request failed (${response.status}).`);
      } catch {
        throw new Error(text);
      }
    }

    throw new Error(`Request failed (${response.status}).`);
  }
  return response.json();
};

export const fetchTenderBids = async (tenderId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/tenders/${tenderId}/bids`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
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
  return data.Items || data;
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
      ...buildAuthHeaders(token),
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
    headers: buildAuthHeaders(token),
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch evaluation reports');
  return response.json();
};

export const fetchBidOpeningSessionDetails = async (sessionId: string, token: string) => {
  const url = `${serviceBaseUrls.vendorSourcing}/api/bid-opening/sessions/${sessionId}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
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
      ...buildAuthHeaders(token),
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
      ...buildAuthHeaders(token),
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

export const fetchCgisDocuments = async (entityType: string, entityId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/cgis-approval/documents/${entityType}/${entityId}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
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
      ...buildAuthHeaders(token),
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
