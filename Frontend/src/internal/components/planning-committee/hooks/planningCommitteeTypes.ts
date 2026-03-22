import type {
  ProcurementPlanDetail,
  ProcurementPlanItemDetail,
  ProcurementPlanSummary,
  RequisitionDetail,
  RequisitionSummary,
  PlanningCommitteeMemberStatus
} from '../../../types/internal';

export interface MemberReview {
  ReviewId: string;
  PlanId: string;
  RequisitionId?: string;
  ReviewerRole: string;
  ReviewerUserId: string;
  Decision: string;
  Remarks: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface PlanningCommitteeWorkspaceAuthority {
  CanLinkPlan: boolean;
  CanSubmitMemberReview: boolean;
  CanSubmitFinalDecision: boolean;
  CanUnlink: boolean;
  RequiresUnlinkReason: boolean;
}

export interface PlanningCommitteeQueueResponse {
  PendingRequisitions: RequisitionSummary[];
  LinkedRequisitions: RequisitionSummary[];
  AvailablePlans: ProcurementPlanSummary[];
}

export interface PlanningCommitteeWorkspaceResponse {
  Requisition: RequisitionSummary;
  Plan: ProcurementPlanDetail | null;
  PlanItems: ProcurementPlanItemDetail[];
  MemberReviews: MemberReview[];
  MemberStatuses: PlanningCommitteeMemberStatus[];
  Authority: PlanningCommitteeWorkspaceAuthority;
}

export interface CommitteeState {
  requisitions: RequisitionSummary[];
  linkedRequisitions: RequisitionSummary[];
  availablePlans: ProcurementPlanSummary[];
  plans: ProcurementPlanSummary[];
  selectedRequisition: RequisitionSummary | null;
  selectedRequisitionDetail: RequisitionDetail | null;
  selectedPlan: ProcurementPlanDetail | null;
  planItems: ProcurementPlanItemDetail[];
  appItems: ProcurementPlanItemDetail[];
  memberReviews: MemberReview[];
  memberStatuses: PlanningCommitteeMemberStatus[];
  workspaceAuthority: PlanningCommitteeWorkspaceAuthority | null;
}

export interface LoadingState {
  initial: boolean;
  action: boolean;
}
