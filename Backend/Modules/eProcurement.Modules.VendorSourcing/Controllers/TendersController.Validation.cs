using Npgsql;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class TendersController
{
    private static bool IsStatusValid(string? status, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        var trimmed = status.Trim();
        var match = AllowedStatuses.FirstOrDefault(s => string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            return false;
        }

        normalized = match;
        return true;
    }

    private static string? ValidateCreateRequest(TenderCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        var hasRequisitionSeed = request.RequisitionId.HasValue && request.RequisitionId.Value != Guid.Empty;
        if (!hasRequisitionSeed)
        {
            if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length < 5)
            {
                return "Title must be at least 5 characters.";
            }

            if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length < 10)
            {
                return "Description must be at least 10 characters.";
            }

            if (string.IsNullOrWhiteSpace(request.Category) || request.Category.Trim().Length < 3)
            {
                return "Category must be at least 3 characters.";
            }
        }
        else if (request.RequisitionId == Guid.Empty)
        {
            return "RequisitionId must be a valid identifier.";
        }

        if (request.Budget.HasValue && request.Budget.Value < 0)
        {
            return "Budget cannot be negative.";
        }

        if (!string.IsNullOrWhiteSpace(request.Department) && request.Department.Trim().Length > MaxDepartmentLength)
        {
            return $"Department must be {MaxDepartmentLength} characters or fewer.";
        }

        if (!string.IsNullOrWhiteSpace(request.BudgetCode) && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";
        }

        if (request.OpeningDate.HasValue && request.ClosingDate.HasValue && request.ClosingDate < request.OpeningDate)
        {
            return "ClosingDate cannot be earlier than OpeningDate.";
        }

        return null;
    }

    private static string? ValidateUpdateRequest(TenderUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        var hasAny =
            request.Title is not null ||
            request.Description is not null ||
            request.Category is not null ||
            request.Status is not null ||
            request.Budget.HasValue ||
            request.Specifications is not null ||
            request.EligibilityCriteria is not null ||
            request.EvaluationCriteria is not null ||
            request.PublishDate.HasValue ||
            request.OpeningDate.HasValue ||
            request.ClosingDate.HasValue;

        if (!hasAny)
        {
            return "At least one field is required to update a tender.";
        }

        if (request.Title is not null && request.Title.Trim().Length < 5)
        {
            return "Title must be at least 5 characters.";
        }

        if (request.Description is not null && request.Description.Trim().Length < 10)
        {
            return "Description must be at least 10 characters.";
        }

        if (request.Category is not null && request.Category.Trim().Length < 3)
        {
            return "Category must be at least 3 characters.";
        }

        if (request.Budget.HasValue && request.Budget.Value < 0)
        {
            return "Budget cannot be negative.";
        }

        if (request.Department is not null && request.Department.Trim().Length > MaxDepartmentLength)
        {
            return $"Department must be {MaxDepartmentLength} characters or fewer.";
        }

        if (request.BudgetCode is not null && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (normalizedStatus is "Published" or "Closed" or "Awarded")
        {
            if (request.Budget.HasValue && request.Budget.Value <= 0)
            {
                return "Budget must be greater than 0 for this status.";
            }

            if (request.Department is not null && string.IsNullOrWhiteSpace(request.Department))
            {
                return "Department is required for this status.";
            }

            if (request.BudgetCode is not null && string.IsNullOrWhiteSpace(request.BudgetCode))
            {
                return "BudgetCode is required for this status.";
            }
        }

        if (request.OpeningDate.HasValue && request.ClosingDate.HasValue && request.ClosingDate < request.OpeningDate)
        {
            return "ClosingDate cannot be earlier than OpeningDate.";
        }

        return null;
    }

    private static async Task<ResolvedTenderCreateRequest> ResolveCreateRequestAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        TenderCreateRequest request,
        string? normalizedStatus,
        CancellationToken ct)
    {
        var requisition = request.RequisitionId.HasValue
            ? await GetRequisitionSeedAsync(conn, tx, request.RequisitionId.Value, ct)
            : null;

        if (request.RequisitionId.HasValue && requisition is null)
        {
            return new ResolvedTenderCreateRequest(ErrorMessage: "Selected requisition was not found.", IsNotFound: true);
        }

        if (requisition is not null && !string.Equals(requisition.Status, "Approved", StringComparison.OrdinalIgnoreCase))
        {
            return new ResolvedTenderCreateRequest(ErrorMessage: "Only approved requisitions can be converted to tenders.");
        }

        var title = NormalizeRequired(request.Title) ?? requisition?.Title;
        var description = NormalizeRequired(request.Description) ?? BuildRequisitionDescription(requisition);
        var category = NormalizeRequired(request.Category) ?? requisition?.ProcurementType;
        var budget = request.Budget ?? requisition?.TotalEstimate;
        var department = NormalizeOptional(request.Department) ?? requisition?.Department;
        var budgetCode = NormalizeOptional(request.BudgetCode) ?? requisition?.BudgetCode;
        var fiscalYear = request.FiscalYear ?? (requisition?.RequiredBy ?? requisition?.CreatedAt)?.Year;

        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length < 5)
        {
            return new ResolvedTenderCreateRequest(ErrorMessage: "Title must be at least 5 characters.");
        }

        if (string.IsNullOrWhiteSpace(description) || description.Trim().Length < 10)
        {
            return new ResolvedTenderCreateRequest(ErrorMessage: "Description must be at least 10 characters.");
        }

        if (string.IsNullOrWhiteSpace(category) || category.Trim().Length < 3)
        {
            return new ResolvedTenderCreateRequest(ErrorMessage: "Category must be at least 3 characters.");
        }

        if (requisition is not null && string.IsNullOrWhiteSpace(budgetCode))
        {
            return new ResolvedTenderCreateRequest(ErrorMessage: "The selected requisition does not have a budget code in the database.");
        }

        if (normalizedStatus is "Published" or "Closed" or "Awarded")
        {
            if (!budget.HasValue || budget.Value <= 0)
            {
                return new ResolvedTenderCreateRequest(ErrorMessage: "Budget must be greater than 0 for this status.");
            }

            if (string.IsNullOrWhiteSpace(department))
            {
                return new ResolvedTenderCreateRequest(ErrorMessage: "Department is required for this status.");
            }

            if (string.IsNullOrWhiteSpace(budgetCode))
            {
                return new ResolvedTenderCreateRequest(ErrorMessage: "BudgetCode is required for this status.");
            }
        }

        return new ResolvedTenderCreateRequest(
            Title: title.Trim(),
            Description: description.Trim(),
            Category: category.Trim(),
            Status: normalizedStatus,
            Budget: budget,
            Department: department,
            BudgetCode: budgetCode,
            FiscalYear: fiscalYear);
    }

    private static string? NormalizeRequired(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? BuildRequisitionDescription(RequisitionSeed? requisition)
    {
        if (requisition is null)
        {
            return null;
        }

        return $"Tender for {requisition.Title}. Department: {requisition.Department}. Approved Estimate: {requisition.TotalEstimate}";
    }

    private sealed record ResolvedTenderCreateRequest(
        string? Title = null,
        string? Description = null,
        string? Category = null,
        string? Status = null,
        decimal? Budget = null,
        string? Department = null,
        string? BudgetCode = null,
        int? FiscalYear = null,
        string? ErrorMessage = null,
        bool IsNotFound = false);
}
