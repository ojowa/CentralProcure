using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class RequisitionsController
{
    private async Task<List<RequisitionSummary>> EnrichSummariesWithAuthorityAsync(
        string connectionString,
        List<RequisitionSummary> requisitions,
        CancellationToken ct)
    {
        if (requisitions.Count == 0)
        {
            return requisitions;
        }

        var authorities = await Task.WhenAll(
            requisitions.Select(requisition => GetRequisitionAuthorityAsync(
                connectionString,
                requisition.RequisitionId,
                requisition.Status,
                ct)));

        return requisitions
            .Zip(authorities, (requisition, authority) => requisition with { Authority = authority })
            .ToList();
    }

    private async Task<RequisitionDetail> EnrichDetailWithAuthorityAsync(
        string connectionString,
        RequisitionDetail requisition,
        CancellationToken ct)
    {
        var authority = await GetRequisitionAuthorityAsync(connectionString, requisition.RequisitionId, requisition.Status, ct);
        return requisition with { Authority = authority };
    }

    private async Task<RequisitionAuthority> GetRequisitionAuthorityAsync(
        string connectionString,
        Guid requisitionId,
        string status,
        CancellationToken ct)
    {
        var snapshot = await _workflowActionGrantService.GetSnapshotAsync(connectionString, User, "requisition", requisitionId, ct);
        if (snapshot is not null)
        {
            return new RequisitionAuthority(
                snapshot.Authority.IsEditable,
                snapshot.Authority.CanEdit,
                snapshot.Authority.CanDelete,
                snapshot.Authority.CanRoute,
                snapshot.Authority.CanFileComplaint,
                snapshot.Authority.AllowedActionKeys,
                snapshot.CurrentStageKey,
                snapshot.CurrentStageTitle);
        }

        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        return new RequisitionAuthority(
            false,
            false,
            string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase),
            false,
            false,
            Array.Empty<string>(),
            ResolveWorkflowStage(status),
            null);
    }
}
