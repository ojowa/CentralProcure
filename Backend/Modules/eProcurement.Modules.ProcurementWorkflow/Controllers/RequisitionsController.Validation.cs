using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class RequisitionsController
{
    private static bool IsStatusValid(string? status, out string? normalizedStatus)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            normalizedStatus = null;
            return true;
        }

        normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedStatus != null;
    }

    private static bool IsPriorityValid(string? priority, out string? normalizedPriority)
    {
        if (string.IsNullOrWhiteSpace(priority))
        {
            normalizedPriority = null;
            return true;
        }

        normalizedPriority = AllowedPriorities.FirstOrDefault(p => p.Equals(priority.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedPriority != null;
    }

    private static bool IsProcurementTypeValid(string? procurementType, out string? normalizedType)
    {
        if (string.IsNullOrWhiteSpace(procurementType))
        {
            normalizedType = null;
            return true;
        }

        normalizedType = AllowedProcurementTypes.FirstOrDefault(p => p.Equals(procurementType.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedType != null;
    }

    private string? ValidateCreateRequest(RequisitionCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = "Draft";

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length < MinTitleLength || request.Title.Trim().Length > MaxTitleLength)
            return $"Title must be between {MinTitleLength} and {MaxTitleLength} characters.";

        if (request.UnitId.HasValue && request.UnitId.Value == Guid.Empty)
            return "UnitId must be a valid GUID.";

        if (string.IsNullOrWhiteSpace(request.Department))
        {
            if (!request.UnitId.HasValue)
                return "Department or UnitId is required.";
        }
        else if (request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength)
        {
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";
        }

        if (!string.IsNullOrWhiteSpace(request.BudgetCode) && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";

        if (request.AppItemId.HasValue && request.AppItemId.Value == Guid.Empty)
            return "AppItemId must be a valid GUID.";

        if (!string.IsNullOrWhiteSpace(request.ProjectCode) && request.ProjectCode.Trim().Length > MaxProjectCodeLength)
            return $"ProjectCode must be {MaxProjectCodeLength} characters or fewer.";

        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";

        if (!string.IsNullOrWhiteSpace(request.Priority) && !IsPriorityValid(request.Priority, out _))
            return $"Priority must be one of: {string.Join(", ", AllowedPriorities)}.";

        if (!string.IsNullOrWhiteSpace(request.ProcurementType) && !IsProcurementTypeValid(request.ProcurementType, out _))
            return $"ProcurementType must be one of: {string.Join(", ", AllowedProcurementTypes)}.";

        if (request.LineItems is null || request.LineItems.Count == 0)
            return "At least one line item is required.";

        foreach (var item in request.LineItems)
        {
            if (string.IsNullOrWhiteSpace(item.Description))
                return "Line item description is required.";

            if (string.IsNullOrWhiteSpace(item.Unit))
                return "Line item unit is required.";

            if (item.Quantity <= 0)
                return "Line item quantity must be greater than 0.";

            if (item.UnitCost <= 0)
                return "Line item unit cost must be greater than 0.";
        }

        return null;
    }

    private string? ValidateUpdateRequest(RequisitionUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (request.Title is not null && (request.Title.Trim().Length < MinTitleLength || request.Title.Trim().Length > MaxTitleLength))
            return $"Title must be between {MinTitleLength} and {MaxTitleLength} characters.";

        if (request.UnitId.HasValue && request.UnitId.Value == Guid.Empty)
            return "UnitId must be a valid GUID.";

        if (request.Department is not null && request.Department.Trim().Length > 0 &&
            (request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength))
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";

        if (request.BudgetCode is not null && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";

        if (request.AppItemId.HasValue && request.AppItemId.Value == Guid.Empty)
            return "AppItemId must be a valid GUID.";

        if (request.ProjectCode is not null && request.ProjectCode.Trim().Length > MaxProjectCodeLength)
            return $"ProjectCode must be {MaxProjectCodeLength} characters or fewer.";

        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";

        if (!string.IsNullOrWhiteSpace(request.Priority) && !IsPriorityValid(request.Priority, out _))
            return $"Priority must be one of: {string.Join(", ", AllowedPriorities)}.";

        if (!string.IsNullOrWhiteSpace(request.ProcurementType) && !IsProcurementTypeValid(request.ProcurementType, out _))
            return $"ProcurementType must be one of: {string.Join(", ", AllowedProcurementTypes)}.";

        if (request.LineItems is not null)
        {
            if (request.LineItems.Count == 0)
                return "Line items cannot be empty.";

            foreach (var item in request.LineItems)
            {
                if (string.IsNullOrWhiteSpace(item.Description))
                    return "Line item description is required.";

                if (string.IsNullOrWhiteSpace(item.Unit))
                    return "Line item unit is required.";

                if (item.Quantity <= 0)
                    return "Line item quantity must be greater than 0.";

                if (item.UnitCost <= 0)
                    return "Line item unit cost must be greater than 0.";
            }
        }

        return null;
    }
}
