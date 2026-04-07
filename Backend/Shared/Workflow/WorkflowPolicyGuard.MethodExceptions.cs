using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed partial class WorkflowPolicyGuard
{
    private static async Task<string?> EvaluateMethodExceptionPauseAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        string currentStageKey,
        string requestedStageKey,
        CancellationToken ct)
    {
        const string sql = @"
SELECT status
FROM procurement_workflow.procurement_method_change_exceptions
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
  AND status IN ('PendingReview', 'ReturnedForClarification')
ORDER BY requested_at DESC
LIMIT 1;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is not string status)
        {
            return null;
        }

        if (string.Equals(currentStageKey, requestedStageKey, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return string.Equals(status, "ReturnedForClarification", StringComparison.OrdinalIgnoreCase)
            ? "This procurement is paused pending clarification of a CGIS method-change exception."
            : "This procurement is paused pending CGIS decision on a late method-change exception.";
    }
}
