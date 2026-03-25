using System.Data;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeWorkspaceController
{
    private static async Task<LinkContext?> GetLinkContextAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT requisition_id, title, department, budget_code, procurement_type, total_estimate, created_at, required_by, app_item_id
FROM procurement_workflow.requisitions
WHERE requisition_id = @p_requisition_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new LinkContext(
            reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetString(reader.GetOrdinal("department")),
            GetNullableString(reader, "budget_code"),
            GetNullableString(reader, "procurement_type"),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_estimate")),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            GetNullableDateTime(reader, "required_by"),
            GetNullableGuid(reader, "app_item_id"));
    }

    private async Task<PlanningCommitteeWorkspaceLinkResponse> LinkRequisitionAsync(NpgsqlConnection conn, NpgsqlTransaction tx, LinkContext context, PlanningCommitteeWorkspaceLinkRequest request, string linkedBy, CancellationToken ct)
    {
        if (context.AppItemId.HasValue)
        {
            throw new InvalidOperationException("Requisition is already part of an APP item.");
        }

        if (string.IsNullOrWhiteSpace(context.BudgetCode))
        {
            throw new InvalidOperationException("Budget code is required before assigning this requisition to a committee plan.");
        }

        var mode = request.Mode?.Trim().ToLowerInvariant();
        string? notice = null;
        Guid planId;
        string planTitle;
        if (mode == "attach")
        {
            if (!request.ExistingPlanId.HasValue || request.ExistingPlanId.Value == Guid.Empty)
            {
                throw new InvalidOperationException("Select an existing committee plan.");
            }

            var plan = await GetPlanSummaryAsync(conn, tx, request.ExistingPlanId.Value, ct)
                ?? throw new InvalidOperationException("Selected committee plan was not found.");
            planId = plan.PlanId;
            planTitle = plan.PlanTitle;
        }
        else
        {
            var fiscalYear = request.FiscalYear ?? (context.RequiredBy ?? context.CreatedAt).Year;
            var normalizedTitle = string.IsNullOrWhiteSpace(request.PlanTitle) ? $"{context.Department} Procurement Plan" : request.PlanTitle.Trim();
            var existing = await FindExistingPlanAsync(conn, tx, normalizedTitle, context.Department, fiscalYear, ct);
            if (existing is not null)
            {
                planId = existing.PlanId;
                planTitle = existing.PlanTitle;
                notice = "Existing committee plan found for this title, department, and fiscal year. This requisition was attached instead of creating a duplicate.";
            }
            else
            {
                var created = await CreatePlanAsync(conn, tx, normalizedTitle, context.Department, fiscalYear, context.TotalEstimate, ct);
                planId = created.PlanId;
                planTitle = created.PlanTitle;
            }
        }

        var linkedAt = await UpsertPlanLinkAsync(conn, tx, context.RequisitionId, planId, linkedBy, ct);
        return new PlanningCommitteeWorkspaceLinkResponse(context.RequisitionId, planId, planTitle, linkedAt, notice);
    }

    private static async Task<ProcurementPlanSummary?> GetPlanSummaryAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.department, p.fiscal_year, p.status,
       wi.current_stage_key, sc.stage_title AS current_stage_title,
       p.total_budget, p.created_at
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'procurement_plan' AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
WHERE p.plan_id = @p_plan_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new ProcurementPlanSummary(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "current_stage_key"),
            GetNullableString(reader, "current_stage_title"),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_budget")),
            reader.GetDateTime(reader.GetOrdinal("created_at")));
    }

    private static async Task<ProcurementPlanSummary?> FindExistingPlanAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string title, string department, int fiscalYear, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.department, p.fiscal_year, p.status,
       wi.current_stage_key, sc.stage_title AS current_stage_title,
       p.total_budget, p.created_at
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'procurement_plan' AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
WHERE lower(trim(p.plan_title)) = lower(trim(@p_plan_title))
  AND lower(trim(p.department)) = lower(trim(@p_department))
  AND p.fiscal_year = @p_fiscal_year
LIMIT 1;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_title", NpgsqlDbType.Varchar, title);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new ProcurementPlanSummary(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "current_stage_key"),
            GetNullableString(reader, "current_stage_title"),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_budget")),
            reader.GetDateTime(reader.GetOrdinal("created_at")));
    }

    private async Task<ProcurementPlanDetail> CreatePlanAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string title, string department, int fiscalYear, decimal totalBudget, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("procurement_workflow.create_procurement_plan_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("p_plan_title", NpgsqlDbType.Varchar, title);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, "Under Review");
        cmd.Parameters.AddWithValue("p_total_budget", NpgsqlDbType.Numeric, totalBudget);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, "Created by planning committee workspace.");
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        var result = (await ExecuteRefcursorAsync(cmd, reader => new ProcurementPlanDetail(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("status")),
            GetOptionalNullableString(reader, "current_stage_key"),
            GetOptionalNullableString(reader, "current_stage_title"),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_budget")),
            GetOptionalNullableString(reader, "notes"),
            GetOptionalNullableDateTime(reader, "submitted_at"),
            GetOptionalNullableDateTime(reader, "approved_at"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")),
            GetOptionalNullableGuid(reader, "yearly_app_id"),
            GetOptionalNullableString(reader, "yearly_app_title")), ct)).FirstOrDefault()
            ?? throw new InvalidOperationException("Procurement plan creation failed.");

        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
            "procurement_plan",
            result.PlanId,
            "planning_committee_review",
            result.Status,
            result.PlanTitle,
            null,
            null,
            null,
            null,
            null,
            "Planning committee workspace created plan.",
            User.Identity?.Name ?? string.Empty), ct);

        return result;
    }

    private static async Task<DateTime> UpsertPlanLinkAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, Guid planId, string linkedBy, CancellationToken ct)
    {
        const string sql = """
INSERT INTO procurement_workflow.planning_committee_plan_links (requisition_id, plan_id, linked_by, linked_at)
VALUES (@p_requisition_id, @p_plan_id, NULLIF(@p_linked_by, ''), NOW())
ON CONFLICT (requisition_id) DO UPDATE
SET plan_id = EXCLUDED.plan_id,
    linked_by = EXCLUDED.linked_by,
    linked_at = NOW()
RETURNING linked_at;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_linked_by", NpgsqlDbType.Varchar, linkedBy);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is DateTime linkedAt ? linkedAt : DateTime.UtcNow;
    }
}
