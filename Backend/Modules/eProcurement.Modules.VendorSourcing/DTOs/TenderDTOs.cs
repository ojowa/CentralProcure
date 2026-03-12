namespace eProcurement.Modules.VendorSourcing.DTOs;

public record TenderSummary(
    Guid TenderId,
    string Title,
    string Category,
    string Status,
    decimal? Budget,
    string? Department,
    string? BudgetCode,
    int? FiscalYear,
    DateTime? PublishDate,
    DateTime? OpeningDate,
    DateTime? ClosingDate,
    DateTime CreatedAt);

public record TenderDetail(
    Guid TenderId,
    string Title,
    string Description,
    string Category,
    string Status,
    decimal? Budget,
    string? Department,
    string? BudgetCode,
    int? FiscalYear,
    string? Specifications,
    string? EligibilityCriteria,
    string? EvaluationCriteria,
    DateTime? PublishDate,
    DateTime? OpeningDate,
    DateTime? ClosingDate,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record TenderListResponse(
    IReadOnlyList<TenderSummary> Items,
    int Page,
    int PageSize,
    long Total);

public record TenderCreateRequest(
    string Title,
    string Description,
    string Category,
    string? Status,
    decimal? Budget,
    string? Department,
    string? BudgetCode,
    int? FiscalYear,
    string? Specifications,
    string? EligibilityCriteria,
    string? EvaluationCriteria,
    DateTime? PublishDate,
    DateTime? OpeningDate,
    DateTime? ClosingDate);

public record TenderUpdateRequest(
    string? Title,
    string? Description,
    string? Category,
    string? Status,
    decimal? Budget,
    string? Department,
    string? BudgetCode,
    int? FiscalYear,
    string? Specifications,
    string? EligibilityCriteria,
    string? EvaluationCriteria,
    DateTime? PublishDate,
    DateTime? OpeningDate,
    DateTime? ClosingDate);

public record TenderPublishRequest(
    DateTime? PublishDate,
    DateTime? OpeningDate,
    DateTime? ClosingDate);
