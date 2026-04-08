using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

public interface IPlanningCommitteeReviewService
{
    Task<List<MemberReviewResponse>> GetReviewsAsync(Guid requisitionId, CancellationToken ct);
    Task<List<MemberReviewResponse>> GetPlanReviewsAsync(Guid planId, CancellationToken ct);
    Task<List<MemberStatusResponse>> GetMemberStatusesAsync(Guid requisitionId, CancellationToken ct);
    Task<List<MemberStatusResponse>> GetPlanMemberStatusesAsync(Guid planId, CancellationToken ct);
    Task<List<CommitteeRoleDefinitionResponse>> GetCommitteeRolesAsync(CancellationToken ct);
    Task<List<PlanningCommitteePlanLinkSummaryResponse>> GetPlanLinksAsync(CancellationToken ct);
    Task<PlanningCommitteePlanLinkResponse> LinkRequisitionToPlanAsync(Guid requisitionId, Guid planId, string? linkedBy, CancellationToken ct);
    Task UnlinkRequisitionFromPlanAsync(Guid requisitionId, CancellationToken ct);
    Task<MemberReviewResponse> SubmitMemberReviewAsync(MemberReviewSubmitRequest request, CancellationToken ct);
    Task<CommitteeDecisionResponse> SubmitCommitteeDecisionAsync(CommitteeDecisionSubmitRequest request, string chairmanIdentity, string secretaryIdentity, CancellationToken ct);
    Task<PlanningCommitteeChairmanAssignmentResponse> GetChairmanAssignmentAsync(CancellationToken ct);
    Task<PlanningCommitteeChairmanAssignmentResponse> UpsertChairmanAssignmentAsync(Guid? internalUserId, string assignedBy, Guid? assignedByUserId, CancellationToken ct);
}
