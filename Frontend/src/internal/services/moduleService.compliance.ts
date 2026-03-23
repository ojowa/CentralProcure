import { buildCsrfHeaders, serviceBaseUrls } from './moduleService.shared';

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
