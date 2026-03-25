namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record MemberReviewSubmitRequest(
    Guid PlanId,
    Guid RequisitionId,
    string ReviewerRole,
    string ReviewerUserId,
    string Decision,
    string? Remarks
);

public record MemberReviewResponse(
    Guid ReviewId,
    Guid PlanId,
    Guid RequisitionId,
    string ReviewerRole,
    string ReviewerUserId,
    string Decision,
    string? Remarks,
    int ReviewRound,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record MemberStatusResponse(
    string RoleKey,
    string StatusLabel,
    string? Decision,
    string? UpdatedBy,
    DateTime UpdatedAt
);

public record CommitteeDecisionSubmitRequest(
    Guid RequisitionId,
    Guid PlanId,
    string ChairmanUserId,
    string SecretaryUserId,
    string OverallDecision,
    string? CommitteeRemarks,
    DateTime? MeetingDate
);

public record CommitteeDecisionResponse(
    Guid DecisionId,
    Guid RequisitionId,
    Guid PlanId,
    string OverallDecision,
    string? CommitteeRemarks,
    DateTime MeetingDate,
    DateTime CreatedAt
);

public record PlanReviewStatusResponse(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string Status,
    decimal TotalBudget,
    List<MemberReviewResponse> MemberReviews,
    CommitteeDecisionResponse? Decision
);

public record CommitteeRoleDefinitionResponse(
    string RoleKey,
    string RoleName,
    string DisplayName,
    string Description,
    bool IsChair
);

public record PlanningCommitteePlanLinkRequest(
    Guid PlanId
);

public record PlanningCommitteePlanLinkResponse(
    Guid RequisitionId,
    Guid PlanId,
    DateTime LinkedAt
);

public record PlanningCommitteePlanLinkSummaryResponse(
    Guid RequisitionId,
    Guid PlanId,
    string PlanTitle,
    DateTime LinkedAt
);

public record PlanningCommitteeQueueAuthority(
    bool CanLinkPlan,
    bool CanOpenWorkspace,
    bool CanViewDetails
);

public record PlanningCommitteeWorkspaceAuthority(
    bool CanLinkPlan,
    bool CanSubmitMemberReview,
    bool CanSubmitFinalDecision,
    bool CanUnlink,
    bool RequiresUnlinkReason,
    bool IsReviewReopened
);

public record PlanningCommitteeWorkspaceQueueResponse(
    IReadOnlyList<RequisitionSummary> PendingRequisitions,
    IReadOnlyList<RequisitionSummary> LinkedRequisitions,
    IReadOnlyList<ProcurementPlanSummary> AvailablePlans,
    PlanningCommitteeQueueAuthority Authority
);

public record PlanningCommitteeWorkspaceResponse(
    RequisitionSummary Requisition,
    ProcurementPlanDetail? Plan,
    IReadOnlyList<ProcurementPlanItemDetail> PlanItems,
    IReadOnlyList<MemberReviewResponse> MemberReviews,
    IReadOnlyList<MemberStatusResponse> MemberStatuses,
    CommitteeDecisionResponse? Decision,
    PlanningCommitteeWorkspaceAuthority Authority
);

public record PlanningCommitteeWorkspaceLinkRequest(
    string Mode,
    Guid? ExistingPlanId,
    string? PlanTitle,
    int? FiscalYear
);

public record PlanningCommitteeWorkspaceLinkResponse(
    Guid RequisitionId,
    Guid PlanId,
    string PlanTitle,
    DateTime LinkedAt,
    string? Notice
);

public record PlanningCommitteeWorkspaceUnlinkRequest(
    string? Reason
);

public record PlanningCommitteeMemberReviewActionRequest(
    string Decision,
    string? Remarks
);

public record PlanningCommitteeFinalizeReviewRequest(
    string OverallDecision,
    string? CommitteeRemarks
);
