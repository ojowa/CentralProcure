namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record MemberReviewSubmitRequest(
    Guid PlanId,
    string ReviewerRole,
    string ReviewerUserId,
    string Decision,
    string? Remarks
);

public record MemberReviewResponse(
    Guid ReviewId,
    Guid PlanId,
    string ReviewerRole,
    string ReviewerUserId,
    string Decision,
    string? Remarks,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CommitteeDecisionSubmitRequest(
    Guid PlanId,
    string ChairmanUserId,
    string SecretaryUserId,
    string OverallDecision,
    string? CommitteeRemarks,
    DateTime? MeetingDate
);

public record CommitteeDecisionResponse(
    Guid DecisionId,
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
