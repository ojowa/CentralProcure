using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementPlansController
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

    private string? ValidateCreateRequest(ProcurementPlanCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = "Draft";
        if (string.IsNullOrWhiteSpace(request.PlanTitle) || request.PlanTitle.Trim().Length < MinTitleLength || request.PlanTitle.Trim().Length > MaxTitleLength)
            return $"PlanTitle must be between {MinTitleLength} and {MaxTitleLength} characters.";
        if (string.IsNullOrWhiteSpace(request.Department) || request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength)
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";
        if (request.FiscalYear < MinFiscalYear || request.FiscalYear > MaxFiscalYear)
            return $"FiscalYear must be between {MinFiscalYear} and {MaxFiscalYear}.";
        if (request.TotalBudget < 0 || request.TotalBudget > MaxTotalBudget)
            return $"TotalBudget must be between 0 and {MaxTotalBudget}.";
        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        return null;
    }

    private string? ValidateUpdateRequest(ProcurementPlanUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;
        if (request.PlanTitle != null && (request.PlanTitle.Trim().Length < MinTitleLength || request.PlanTitle.Trim().Length > MaxTitleLength))
            return $"PlanTitle must be between {MinTitleLength} and {MaxTitleLength} characters.";
        if (request.Department != null && (request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength))
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";
        if (request.FiscalYear.HasValue && (request.FiscalYear.Value < MinFiscalYear || request.FiscalYear.Value > MaxFiscalYear))
            return $"FiscalYear must be between {MinFiscalYear} and {MaxFiscalYear}.";
        if (request.TotalBudget.HasValue && (request.TotalBudget.Value < 0 || request.TotalBudget.Value > MaxTotalBudget))
            return $"TotalBudget must be between 0 and {MaxTotalBudget}.";
        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        return null;
    }

    private static string? NormalizeApprovalDecision(string? decision)
    {
        if (string.IsNullOrWhiteSpace(decision))
            return null;

        return decision.Trim().ToLowerInvariant() switch
        {
            "approve" => "approve",
            "return" => "return",
            "reject" => "reject",
            _ => null
        };
    }

    private static string BuildApprovalDecisionNote(string decision, string? note, string? actor)
    {
        var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");
        var actorLabel = string.IsNullOrWhiteSpace(actor) ? "system" : actor.Trim();
        var message = string.IsNullOrWhiteSpace(note) ? "No note supplied." : note.Trim();
        return $"[{stamp}] APP approval {decision}: {message} (actor: {actorLabel})";
    }

    private static ApprovalDecisionTarget ResolveApprovalDecisionTarget(string decision) => decision switch
    {
        "approve" => new ApprovalDecisionTarget("accounting_officer_review", "CGIS Approval", "Approved", "Approved", "Departmental plan approved and forwarded to CGIS for approval before procurement begins.", DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)),
        "return" => new ApprovalDecisionTarget("planning_committee_review", "Planning Committee Review", "Returned", "Returned", "APP returned to Planning Committee for further comments and rework.", null),
        "reject" => new ApprovalDecisionTarget("app_approval", "APP Approval", "Rejected", "Rejected", "APP rejected at approval stage.", null),
        _ => throw new InvalidOperationException("Unknown APP approval decision.")
    };

    private static async Task UpdatePlanForApprovalDecisionAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, string planStatus, string noteEntry, DateTime? approvedAt, CancellationToken ct)
    {
        var normalizedApprovedAt = approvedAt.HasValue
            ? DateTime.SpecifyKind(approvedAt.Value, DateTimeKind.Unspecified)
            : (DateTime?)null;
        const string sql = """
UPDATE procurement_workflow.procurement_plans
SET status = @p_status,
    approved_at = @p_approved_at,
    notes = CASE
        WHEN NULLIF(BTRIM(notes), '') IS NULL THEN @p_note
        ELSE notes || E'\n\n' || @p_note
    END,
    updated_at = NOW()
WHERE plan_id = @p_plan_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, planStatus);
        cmd.Parameters.AddWithValue("p_note", NpgsqlDbType.Text, noteEntry);
        cmd.Parameters.AddWithValue("p_approved_at", NpgsqlDbType.Timestamp, (object?)normalizedApprovedAt ?? DBNull.Value);
        if (await cmd.ExecuteNonQueryAsync(ct) == 0)
            throw new InvalidOperationException("Procurement plan could not be updated.");
    }

    private sealed record ApprovalDecisionTarget(
        string StageKey,
        string StageTitle,
        string WorkflowStatus,
        string PlanStatus,
        string Message,
        DateTime? ApprovedAt);
}
