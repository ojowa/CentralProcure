using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

internal static class TenderEvaluationAssignmentRegistry
{
    internal static readonly string[] Roles = ["technical_evaluator", "financial_evaluator", "evaluation_committee"];
    private const string EvaluationModuleId = "assigned-tenders";

    public static async Task EnsureTableAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, CancellationToken ct)
    {
        const string sql = """
CREATE TABLE IF NOT EXISTS procurement_workflow.tender_evaluation_assignments (
    tender_id uuid NOT NULL,
    assignment_role character varying NOT NULL,
    internal_user_id uuid NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    assigned_by character varying NULL,
    assigned_at timestamp without time zone NULL,
    created_at timestamp without time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_tender_evaluation_assignments PRIMARY KEY (tender_id, assignment_role),
    CONSTRAINT ck_tender_evaluation_assignments_role CHECK (assignment_role IN ('technical_evaluator', 'financial_evaluator', 'evaluation_committee'))
);
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public static async Task EnsureModuleGrantAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid internalUserId, Guid? updatedBy, CancellationToken ct)
    {
        const string updateSql = """
UPDATE identity.internal_module_grants
SET is_enabled = TRUE,
    updated_by = @p_updated_by,
    updated_at = NOW()
WHERE internal_user_id = @p_internal_user_id
  AND module_id = @p_module_id;
""";
        await using var updateCmd = new NpgsqlCommand(updateSql, conn, tx);
        updateCmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        updateCmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, EvaluationModuleId);
        updateCmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, (object?)updatedBy ?? DBNull.Value);
        if (await updateCmd.ExecuteNonQueryAsync(ct) > 0)
        {
            return;
        }

        const string insertSql = """
INSERT INTO identity.internal_module_grants (
    grant_id, role_id, internal_user_id, module_id, is_enabled, updated_by, created_at, updated_at
)
VALUES (
    gen_random_uuid(), NULL, @p_internal_user_id, @p_module_id, TRUE, @p_updated_by, NOW(), NOW()
);
""";
        await using var insertCmd = new NpgsqlCommand(insertSql, conn, tx);
        insertCmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        insertCmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, EvaluationModuleId);
        insertCmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, (object?)updatedBy ?? DBNull.Value);
        await insertCmd.ExecuteNonQueryAsync(ct);
    }
}
