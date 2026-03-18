using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class AuditController
{
    [HttpPost("closeouts")]
    public async Task<IActionResult> CreateCloseout([FromBody] AuditCloseoutCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateCloseoutRequest(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var entityType = request.EntityType.Trim().ToLowerInvariant();
            var workflowInstance = await GetWorkflowInstanceAsync(conn, tx, entityType, request.EntityId, ct);
            if (workflowInstance is null)
            {
                return NotFound("The referenced workflow record was not found.");
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                entityType,
                request.EntityId,
                "closeout.create",
                ct);

            if (!hasAction)
            {
                return Forbid();
            }

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                conn,
                tx,
                entityType,
                request.EntityId,
                "closeout_and_audit",
                ct);

            if (!transition.IsAllowed)
            {
                return BadRequest(transition.Message);
            }

            if (!request.FinalAcceptanceCompleted || !request.FinalPaymentCompleted)
            {
                return BadRequest("FinalAcceptanceCompleted and FinalPaymentCompleted must both be true before closeout.");
            }

            if (entityType == "contract")
            {
                const string checkPaidSql = "SELECT is_paid FROM post_award.contracts WHERE contract_id = @p_contract_id;";
                await using var checkPaidCmd = new NpgsqlCommand(checkPaidSql, conn, tx);
                checkPaidCmd.Parameters.AddWithValue("p_contract_id", request.EntityId);
                var isPaid = await checkPaidCmd.ExecuteScalarAsync(ct);
                if (isPaid is not bool paid || !paid)
                {
                    return BadRequest("Contract must be recorded as Paid before closeout.");
                }
            }

            var closeout = await InsertCloseoutAsync(conn, tx, request, workflowInstance.RecordTitle, ct);

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    workflowInstance.EntityType,
                    workflowInstance.EntityId,
                    "closeout_and_audit",
                    closeout.Status,
                    workflowInstance.RecordTitle,
                    workflowInstance.ParentEntityType,
                    workflowInstance.ParentEntityId,
                    workflowInstance.Amount,
                    workflowInstance.ProcurementType,
                    workflowInstance.ThresholdId,
                    $"Closeout {closeout.CloseoutReference} archived.",
                    closeout.ArchivedBy,
                    "closeout"),
                ct);

            await tx.CommitAsync(ct);
            return Created($"/api/audit/closeouts/{closeout.CloseoutId}", closeout);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            Logger.LogWarning(ex, "Duplicate closeout attempted for {EntityType} {EntityId}.", request.EntityType, request.EntityId);
            return Conflict("A closeout record already exists for this workflow entity.");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating closeout for {EntityType} {EntityId}.", request.EntityType, request.EntityId);
            return Problem("Internal server error creating closeout.");
        }
    }
}
