using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class AdministrativeReviewsController
{
    private static string? ValidateCreateRequest(AdministrativeReviewCreateRequest? request)
    {
        if (request is null)
        {
            return "Request body is required.";
        }

        if (string.IsNullOrWhiteSpace(request.EntityType))
        {
            return "EntityType is required.";
        }

        if (request.EntityId == Guid.Empty)
        {
            return "EntityId is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Trim().Length < 5)
        {
            return "Subject must be at least 5 characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Trim().Length < 10)
        {
            return "Summary must be at least 10 characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Details) || request.Details.Trim().Length < 20)
        {
            return "Details must be at least 20 characters.";
        }

        return null;
    }

    private static string? ValidateUpdateRequest(
        AdministrativeReviewUpdateRequest? request,
        out string? normalizedStatus,
        out string? normalizedOutcome)
    {
        normalizedStatus = null;
        normalizedOutcome = null;

        if (request is null)
        {
            return "Request body is required.";
        }

        var hasAny =
            request.Status is not null ||
            request.AssignedTo is not null ||
            request.ReviewedBy is not null ||
            request.ResolutionOutcome is not null ||
            request.ResolutionStageKey is not null ||
            request.ResolutionNotes is not null;

        if (!hasAny)
        {
            return "At least one field is required to update a complaint.";
        }

        if (!TryNormalizeStatus(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (!TryNormalizeOutcome(request.ResolutionOutcome, out normalizedOutcome))
        {
            return $"ResolutionOutcome must be one of: {string.Join(", ", AllowedResolutionOutcomes)}.";
        }

        var isResolutionStatus =
            string.Equals(normalizedStatus, "Resolved", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedStatus, "Rejected", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedStatus, "Closed", StringComparison.OrdinalIgnoreCase);

        if (isResolutionStatus && string.IsNullOrWhiteSpace(normalizedOutcome))
        {
            return "ResolutionOutcome is required when resolving, rejecting, or closing a complaint.";
        }

        if (isResolutionStatus && string.IsNullOrWhiteSpace(request.ResolutionNotes))
        {
            return "ResolutionNotes are required when resolving, rejecting, or closing a complaint.";
        }

        return null;
    }

    private static bool TryNormalizeStatus(string? status, out string? normalizedStatus)
    {
        normalizedStatus = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        normalizedStatus = AllowedStatuses.FirstOrDefault(item => item.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedStatus is not null;
    }

    private static bool TryNormalizeOutcome(string? outcome, out string? normalizedOutcome)
    {
        normalizedOutcome = null;
        if (string.IsNullOrWhiteSpace(outcome))
        {
            return true;
        }

        normalizedOutcome = AllowedResolutionOutcomes.FirstOrDefault(item => item.Equals(outcome.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedOutcome is not null;
    }

    private static object? ResolveResolutionStageKey(
        AdministrativeReviewDetail complaint,
        string? resolutionOutcome,
        string? requestedResolutionStageKey)
    {
        if (string.IsNullOrWhiteSpace(resolutionOutcome) && string.IsNullOrWhiteSpace(requestedResolutionStageKey))
        {
            return null;
        }

        var normalizedRequestedStageKey = NormalizeNullable(requestedResolutionStageKey)?.ToLowerInvariant();
        string? resolvedStageKey = resolutionOutcome switch
        {
            "Escalate To BPP" => "bpp_no_objection",
            "Terminate Procurement" => "closeout_and_audit",
            "Resume Procurement" => complaint.StageKeyAtFiling,
            "Dismiss Complaint" => complaint.StageKeyAtFiling,
            "Modify Decision" => normalizedRequestedStageKey ?? complaint.StageKeyAtFiling,
            _ => normalizedRequestedStageKey
        };

        if (string.IsNullOrWhiteSpace(resolvedStageKey))
        {
            return null;
        }

        if (string.Equals(resolutionOutcome, "Escalate To BPP", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(resolvedStageKey, "bpp_no_objection", StringComparison.OrdinalIgnoreCase))
        {
            return new ErrorStageKey("Escalate To BPP complaints must exit to 'bpp_no_objection'.");
        }

        if (string.Equals(resolutionOutcome, "Terminate Procurement", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(resolvedStageKey, "closeout_and_audit", StringComparison.OrdinalIgnoreCase))
        {
            return new ErrorStageKey("Terminate Procurement complaints must exit to 'closeout_and_audit'.");
        }

        return resolvedStageKey;
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record ErrorStageKey(string Message);
}
