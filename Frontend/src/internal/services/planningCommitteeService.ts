import { buildCsrfHeaders } from './internalAuthService';
import { serviceBaseUrls } from './moduleService';
import type {
  PlanningCommitteeQueueResponse,
  PlanningCommitteeWorkspaceResponse
} from '../components/planning-committee/hooks/planningCommitteeTypes';

type MemberReviewResponse = {
  ReviewId: string;
  PlanId: string;
  RequisitionId: string;
  ReviewerRole: string;
  ReviewerUserId: string;
  Decision: string;
  Remarks?: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

type CommitteeDecisionResponse = {
  DecisionId: string;
  RequisitionId: string;
  PlanId: string;
  OverallDecision: string;
  CommitteeRemarks?: string | null;
  MeetingDate: string;
  CreatedAt: string;
};

const baseUrl = `${serviceBaseUrls.workflow}/api/planning-committee/workspace`;

type JsonBody = Record<string, unknown> | null;

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status}).`);
  }

  return text ? JSON.parse(text) as T : ({} as T);
};

const send = async <T>(path: string, token: string, init?: RequestInit, body?: JsonBody): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json', ...buildCsrfHeaders() } : {}),
      ...(init?.headers ?? {})
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : init?.body
  });

  return parseJson<T>(response);
};

export const fetchPlanningCommitteeQueue = (token: string) =>
  send<PlanningCommitteeQueueResponse>('/queue', token);

export const fetchPlanningCommitteeWorkspace = (token: string, requisitionId: string) =>
  send<PlanningCommitteeWorkspaceResponse>(`/requisitions/${requisitionId}`, token);

export const linkPlanningCommitteeWorkspaceRequisition = (
  token: string,
  requisitionId: string,
  payload: { Mode: 'create' | 'attach'; ExistingPlanId?: string; PlanTitle?: string; FiscalYear?: number }
) => send<{ Notice?: string | null }>(`/requisitions/${requisitionId}/link`, token, { method: 'POST' }, payload);

export const unlinkPlanningCommitteeWorkspaceRequisition = (
  token: string,
  requisitionId: string,
  reason?: string
) => send<void>(`/requisitions/${requisitionId}/unlink`, token, { method: 'POST' }, { Reason: reason ?? null });

export const submitPlanningCommitteeMemberReview = (
  token: string,
  requisitionId: string,
  payload: { Decision: string; Remarks?: string }
) => send<MemberReviewResponse>(`/requisitions/${requisitionId}/member-review`, token, { method: 'POST' }, payload);

export const finalizePlanningCommitteeReview = (
  token: string,
  requisitionId: string,
  payload: { OverallDecision: string; CommitteeRemarks?: string }
) => send<CommitteeDecisionResponse>(`/requisitions/${requisitionId}/finalize`, token, { method: 'POST' }, payload);
