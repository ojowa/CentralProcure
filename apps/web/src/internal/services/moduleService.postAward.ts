import { buildCsrfHeaders, serviceBaseUrls } from './moduleService.shared';

export const fetchContracts = async (token: string) => {
  const url = `${serviceBaseUrls.postAward}/api/contracts`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch contracts');
  const data = await response.json();
  return data.Contracts || [];
};

export const fetchContractMilestones = async (contractId: string, token: string) => {
  const url = `${serviceBaseUrls.postAward}/api/contracts/${contractId}/milestones`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch milestones');
  const data = await response.json();
  return data.Milestones || [];
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
