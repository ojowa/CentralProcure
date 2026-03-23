import { buildCsrfHeaders, serviceBaseUrls } from './moduleService.shared';

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
