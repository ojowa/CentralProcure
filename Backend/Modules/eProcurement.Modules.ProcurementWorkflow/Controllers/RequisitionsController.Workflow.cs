using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class RequisitionsController
{
    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        RequisitionDetail requisition,
        string reason,
        CancellationToken ct)
    {
        var threshold = await _workflowPolicyGuard.ResolveThresholdAsync(
            conn,
            tx,
            requisition.ProcurementType,
            requisition.TotalEstimate,
            ct);

        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "requisition",
                requisition.RequisitionId,
                ResolveWorkflowStage(requisition.Status, threshold),
                requisition.Status,
                requisition.Title,
                requisition.AppItemId.HasValue ? "procurement_plan_item" : null,
                requisition.AppItemId,
                requisition.TotalEstimate,
                requisition.ProcurementType,
                threshold?.ThresholdId,
                reason,
                null),
            ct);
    }

    private async Task<WorkflowThresholdResolution?> ResolveThresholdForRequestAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        RequisitionUpdateRequest request,
        CancellationToken ct)
    {
        var existingContext = await GetRequisitionWorkflowContextAsync(conn, tx, requisitionId, ct);
        var amount = request.LineItems is { Count: > 0 }
            ? request.LineItems.Sum(item => item.Quantity * item.UnitCost)
            : existingContext?.TotalEstimate;
        var procurementType = string.IsNullOrWhiteSpace(request.ProcurementType)
            ? existingContext?.ProcurementType
            : request.ProcurementType;

        return await _workflowPolicyGuard.ResolveThresholdAsync(conn, tx, procurementType, amount, ct);
    }

    private static string ResolveWorkflowStage(string status, WorkflowThresholdResolution? threshold = null)
    {
        return status switch
        {
            "Draft" => "department_need_capture",
            "Submitted" => "department_need_capture",
            "Endorsed" => "department_head_endorsement",
            "Initial" => "budget_code_allocation",
            "Under Review" => "planning_committee_review",
            "Evaluation" => "evaluation",
            "Board Review" => "tenders_board_review",
            "Approved" => ResolveApprovedWorkflowStage(threshold),
            _ => "department_need_capture"
        };
    }

    private static string ResolveApprovedWorkflowStage(WorkflowThresholdResolution? threshold)
    {
        if (threshold?.RequiresBpp == true)
        {
            return "bpp_no_objection";
        }

        if (threshold?.RequiresBoard == true)
        {
            return "tenders_board_review";
        }

        return "accounting_officer_review";
    }
}
