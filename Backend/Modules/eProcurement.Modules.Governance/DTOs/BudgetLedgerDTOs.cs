namespace eProcurement.Modules.Governance.DTOs;

public record BudgetAvailabilityResponse(decimal Available);

public record BudgetSummaryResponse(
    decimal Appropriated,
    decimal Released,
    decimal Committed,
    decimal Spent,
    decimal Available);

public record BudgetAppropriationCreateRequest(
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal Amount,
    string? Status,
    string? Notes);

public record BudgetReleaseCreateRequest(
    Guid AppropriationId,
    decimal Amount,
    DateTime? ReleaseDate,
    string? Notes);

public record BudgetExpenditureCreateRequest(
    Guid CommitmentId,
    decimal Amount,
    DateTime? SpentAt,
    string? Notes);

public record BudgetCommitmentSummary(
    Guid CommitmentId,
    Guid? RequisitionId,
    Guid? TenderId,
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal Amount,
    string Status,
    DateTime CommittedAt);
