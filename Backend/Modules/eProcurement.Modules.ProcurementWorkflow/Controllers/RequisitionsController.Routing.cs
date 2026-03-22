using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class RequisitionsController
{
    private async Task<RequisitionDetail> EnrichDetailWithRoutingAsync(
        string connectionString,
        RequisitionDetail requisition,
        CancellationToken ct)
    {
        var routeDecision = await GetRequisitionRouteDecisionAsync(connectionString, requisition.RequisitionId, ct);
        return requisition with { RouteDecision = routeDecision };
    }

    private async Task<RequisitionRouteDecision?> GetRequisitionRouteDecisionAsync(
        string connectionString,
        Guid requisitionId,
        CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var decision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, "requisition", requisitionId, ct);
        await tx.CommitAsync(ct);

        return decision is null
            ? null
            : new RequisitionRouteDecision(
                decision.ThresholdId,
                decision.ApprovalRoute,
                decision.ApprovalAuthorityCode,
                decision.ApprovalAuthorityLabel,
                decision.RequiresCgisApproval,
                decision.RequiresBoard,
                decision.RequiresBpp,
                decision.GovernanceBodyId,
                decision.GovernanceBodyName,
                decision.Amount,
                decision.ProcurementType,
                decision.Notes);
    }
}
