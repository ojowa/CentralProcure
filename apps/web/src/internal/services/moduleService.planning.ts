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

export type PlanningCommitteeRoleDefinition = {
  RoleKey: string;
  RoleName: string;
  DisplayName: string;
  Description: string;
  IsChair: boolean;
};

export type PlanningCommitteeChairmanAssignment = {
  InternalUserId?: string | null;
  Email?: string | null;
  Username?: string | null;
  RoleName?: string | null;
  Status?: string | null;
  UnitId?: string | null;
  UnitName?: string | null;
  AssignedBy?: string | null;
  AssignedAt?: string | null;
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

export const fetchPlanningCommitteeChairmanAssignment = async (token: string): Promise<PlanningCommitteeChairmanAssignment> => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/chairman`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to fetch planning committee chairman (status ${response.status})`);
  }
  return response.json();
};

export const updatePlanningCommitteeChairmanAssignment = async (
  token: string,
  internalUserId: string | null
): Promise<PlanningCommitteeChairmanAssignment> => {
  const url = `${serviceBaseUrls.workflow}/api/planning-committee/chairman`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...buildCsrfHeaders()
    },
    credentials: 'include',
    body: JSON.stringify({ InternalUserId: internalUserId || null })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to update planning committee chairman (status ${response.status})`);
  }
  return response.json();
};

export const fetchNeedsAnalysis = async (
  fiscalYear: number,
  token: string,
  unitId?: string,
  status: string = 'Endorsed'
) => {
  const query = new URLSearchParams({
    fiscalYear: String(fiscalYear),
    status
  });
  if (unitId) {
    query.append('unitId', unitId);
  }

  const url = `${serviceBaseUrls.workflow}/api/needs-collection/analysis?${query.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch needs analysis');
  }
  return response.json();
};
