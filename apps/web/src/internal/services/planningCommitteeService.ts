import { buildCsrfHeaders, send, type JsonBody } from './moduleService.shared';
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
  ReviewRound: number;
  CreatedAt: string;
  UpdatedAt: string;
};

export type CommitteeDecisionResponse = {
  DecisionId: string;
  RequisitionId: string;
  PlanId: string;
  OverallDecision: string;
  CommitteeRemarks?: string | null;
  MeetingDate: string;
  CreatedAt: string;
  MeetingMinuteUrl?: string | null;
};

const baseUrl = `${serviceBaseUrls.workflow}/api/planning-committee/workspace`;

const wrapSend = async <T>(path: string, token: string, init?: RequestInit, body?: JsonBody): Promise<T> => 
  send<T>(baseUrl, path, token, init, body);

export const fetchPlanningCommitteeQueue = (token: string) =>
  wrapSend<PlanningCommitteeQueueResponse>('/queue', token);

export const fetchPlanningCommitteeWorkspace = (token: string, requisitionId: string) =>
  wrapSend<PlanningCommitteeWorkspaceResponse>(`/requisitions/${requisitionId}`, token);

export const linkPlanningCommitteeWorkspaceRequisition = (
  token: string,
  requisitionId: string,
  payload: { Mode: 'create' | 'attach'; ExistingPlanId?: string; PlanTitle?: string; FiscalYear?: number }
) => wrapSend<{ Notice?: string | null }>(`/requisitions/${requisitionId}/link`, token, { method: 'POST' }, payload);

export const unlinkPlanningCommitteeWorkspaceRequisition = (
  token: string,
  requisitionId: string,
  reason?: string
) => wrapSend<void>(`/requisitions/${requisitionId}/unlink`, token, { method: 'POST' }, { Reason: reason ?? null });

export const submitPlanningCommitteeMemberReview = (
  token: string,
  requisitionId: string,
  payload: { Decision: string; Remarks?: string }
) => wrapSend<MemberReviewResponse>(`/requisitions/${requisitionId}/member-review`, token, { method: 'POST' }, payload);

export const finalizePlanningCommitteeReview = (
  token: string,
  requisitionId: string,
  payload: { OverallDecision: string; CommitteeRemarks?: string; MeetingMinuteUrl?: string }
) => wrapSend<CommitteeDecisionResponse>(`/requisitions/${requisitionId}/finalize`, token, { method: 'POST' }, payload);
