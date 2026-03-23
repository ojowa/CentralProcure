import { buildCsrfHeaders, serviceBaseUrls } from './moduleService.shared';

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

export const fetchProcurementPlans = async (token: string, status?: string) => {
  const statusParam = status ? `?status=${encodeURIComponent(status)}` : '';
  const url = `${serviceBaseUrls.workflow}/api/procurement-plans${statusParam}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch procurement plans');
  }
  return response.json();
};

export const createPlanItem = async (
  planId: string,
  payload: {
    ItemCode?: string | null;
    Description: string;
    BudgetCode: string;
    ProcurementType?: string | null;
    EstimatedAmount?: number | null;
    Status?: string | null;
    Notes?: string | null;
  },
  token: string
) => {
  const url = `${serviceBaseUrls.workflow}/api/procurement-plans/${planId}/items`;
  const response = await fetch(url, {
    method: 'POST',
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
    throw new Error(text || 'Failed to create plan item');
  }
  return response.json();
};

export const fetchPlanItemDetail = async (planItemId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/procurement-plan-items/${planItemId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch APP item details');
  }
  return response.json();
};

export const linkPlanningCommitteeRequisition = async (
  requisitionId: string,
  planId: string,
  token: string
) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/requisitions/${requisitionId}/link-plan`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ PlanId: planId })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to link requisition to committee plan');
  }
  return response.json();
};

export const unlinkPlanningCommitteeRequisition = async (
  requisitionId: string,
  token: string
) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/requisitions/${requisitionId}/unlink-plan`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to unlink requisition from committee plan');
  }
};

export const fetchPlanningCommitteePlanLinks = async (token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/plan-links`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  });
  if (!response.ok) {
    if (response.status === 404 || response.status >= 500) {
      return [];
    }

    const text = await response.text();
    throw new Error(text || `Failed to fetch committee plan links (status ${response.status})`);
  }
  return response.json() as Promise<Array<{
    RequisitionId: string;
    PlanId: string;
    PlanTitle: string;
    LinkedAt: string;
  }>>;
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

export const fetchMemberStatuses = async (planId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/plans/${planId}/member-statuses`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch member statuses');
  }
  return response.json();
};

export const fetchRequisitionMemberReviews = async (requisitionId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/requisitions/${requisitionId}/reviews`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to fetch requisition reviews (status ${response.status})`);
  }
  return response.json();
};

export const fetchRequisitionMemberStatuses = async (requisitionId: string, token: string) => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/requisitions/${requisitionId}/member-statuses`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to fetch requisition statuses (status ${response.status})`);
  }
  return response.json();
};

export type PlanningCommitteeRoleDefinition = {
  RoleKey: string;
  RoleName: string;
  DisplayName: string;
  Description: string;
  IsChair: boolean;
};

export const fetchPlanningCommitteeRoleDefinitions = async (token: string): Promise<PlanningCommitteeRoleDefinition[]> => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/committee-roles`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to fetch planning committee roles (status ${response.status})`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
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
