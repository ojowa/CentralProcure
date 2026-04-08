using eProcurement.Modules.Governance.DTOs;

namespace eProcurement.Modules.Governance.Services;

public interface IBudgetLedgerService
{
    // Appropriations
    Task<BudgetAppropriationResponse> CreateAppropriationAsync(BudgetAppropriationCreateRequest request, CancellationToken ct);
    Task<BudgetAppropriationListResponse> GetAppropriationsAsync(int? fiscalYear, string? department, string? budgetCode, string? status, int page, int pageSize, CancellationToken ct);
    Task<BudgetAppropriationResponse> CloseAppropriationAsync(Guid id, CancellationToken ct);

    // Releases
    Task<BudgetReleaseResponse> CreateReleaseAsync(BudgetReleaseCreateRequest request, CancellationToken ct);
    Task<BudgetReleaseListResponse> GetReleasesAsync(Guid? appropriationId, int page, int pageSize, CancellationToken ct);

    // Commitments
    Task<BudgetCommitmentResponse> CreateCommitmentAsync(BudgetCommitmentCreateRequest request, CancellationToken ct);
    Task<BudgetCommitmentListResponse> GetCommitmentsAsync(Guid? appropriationId, string? status, int page, int pageSize, CancellationToken ct);
    Task<BudgetCommitmentResponse> CancelCommitmentAsync(Guid id, CancellationToken ct);

    // Other methods from other partial files might be needed later
    Task<BudgetDashboardResponse> GetDashboardAsync(int fiscalYear, CancellationToken ct);
    Task<BudgetSummaryResponse> GetBudgetSummaryAsync(string budgetCode, string department, int fiscalYear, CancellationToken ct);
    Task<BudgetConfirmationListResponse> GetConfirmationQueueAsync(string? department, int? fiscalYear, string? status, int page, int pageSize, CancellationToken ct);
    Task<BudgetConfirmationDetail> GetConfirmationDetailAsync(Guid planId, CancellationToken ct);
    Task<BudgetDecisionResponse> SubmitDecisionAsync(Guid planId, BudgetDecisionRequest request, string actor, CancellationToken ct);
    Task<BudgetRequisitionListResponse> GetRequisitionQueueAsync(string? department, string? status, int page, int pageSize, CancellationToken ct);
}
