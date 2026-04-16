using System.Data;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class NeedsCollectionController
{
    private async Task<List<NeedAssessmentSummary>> GetNeedAssessmentSummariesAsync(NpgsqlConnection conn, Guid? unitId, CancellationToken ct)
    {
        var sql = @"
            SELECT na.need_assessment_id, na.unit_id, ou.unit_name, na.title, na.fiscal_year, 
                   na.total_estimated_cost, na.status, na.created_at, na.created_by
            FROM procurement_workflow.need_assessments na
            JOIN identity.organizational_units ou ON na.unit_id = ou.unit_id
            WHERE (@p_unit_id IS NULL OR na.unit_id = @p_unit_id)
            ORDER BY na.created_at DESC";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, (object?)unitId ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<NeedAssessmentSummary>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new NeedAssessmentSummary(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetInt32(4),
                reader.GetDecimal(5),
                reader.GetString(6),
                reader.GetDateTime(7),
                reader.GetString(8)
            ));
        }
        return results;
    }

    private async Task<NeedAssessmentDetail?> GetNeedAssessmentDetailAsync(NpgsqlConnection conn, Guid id, CancellationToken ct)
    {
        var sql = @"
            SELECT na.need_assessment_id, na.unit_id, ou.unit_name, na.title, na.fiscal_year, 
                   na.total_estimated_cost, na.status, na.remarks, na.submitted_at, 
                   na.endorsed_at, na.endorsed_by, na.created_at, na.created_by, na.updated_at
            FROM procurement_workflow.need_assessments na
            JOIN identity.organizational_units ou ON na.unit_id = ou.unit_id
            WHERE na.need_assessment_id = @p_id";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        var detail = new NeedAssessmentDetail(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetInt32(4),
            reader.GetDecimal(5),
            reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetString(7),
            reader.IsDBNull(8) ? null : reader.GetDateTime(8),
            reader.IsDBNull(9) ? null : reader.GetDateTime(9),
            reader.IsDBNull(10) ? null : reader.GetString(10),
            new List<NeedAssessmentItemDetail>(),
            reader.GetDateTime(11),
            reader.GetString(12),
            reader.GetDateTime(13)
        );
        
        await reader.CloseAsync();

        var itemSql = @"
            SELECT item_id, description, quantity, unit, estimated_unit_cost, estimated_total_cost, priority, procurement_type
            FROM procurement_workflow.need_assessment_items
            WHERE need_assessment_id = @p_id";
        
        await using var itemCmd = new NpgsqlCommand(itemSql, conn);
        itemCmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, id);
        
        await using var itemReader = await itemCmd.ExecuteReaderAsync(ct);
        while (await itemReader.ReadAsync(ct))
        {
            detail.Items.Add(new NeedAssessmentItemDetail(
                itemReader.GetGuid(0),
                itemReader.GetString(1),
                itemReader.GetDecimal(2),
                itemReader.GetString(3),
                itemReader.GetDecimal(4),
                itemReader.GetDecimal(5),
                itemReader.GetString(6),
                itemReader.GetString(7)
            ));
        }

        return detail;
    }

    private async Task<Guid> UpsertNeedAssessmentAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid? id, Guid unitId, string title, int fiscalYear, string status, string? remarks, string actor, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("procurement_workflow.upsert_need_assessment_sp", conn, tx);
        cmd.CommandType = CommandType.StoredProcedure;
        cmd.Parameters.AddWithValue("p_need_assessment_id", NpgsqlDbType.Uuid, (object?)id ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, unitId);
        cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, title);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, status);
        cmd.Parameters.AddWithValue("p_remarks", NpgsqlDbType.Text, (object?)remarks ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_actor", NpgsqlDbType.Varchar, actor);
        
        var resultParam = new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output };
        cmd.Parameters.Add(resultParam);

        await cmd.ExecuteNonQueryAsync(ct);
        
        await using var fetchCmd = new NpgsqlCommand($"FETCH ALL IN \"{resultParam.Value}\"", conn, tx);
        await using var reader = await fetchCmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct)) return reader.GetGuid(0);
        throw new InvalidOperationException("Failed to upsert need assessment.");
    }

    private async Task CreateNeedAssessmentItemAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid assessmentId, NeedAssessmentItemDetail item, CancellationToken ct)
    {
        var sql = @"
            INSERT INTO procurement_workflow.need_assessment_items (need_assessment_id, description, quantity, unit, estimated_unit_cost, priority, procurement_type)
            VALUES (@p_assessment_id, @p_description, @p_quantity, @p_unit, @p_unit_cost, @p_priority, @p_type)";
        
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_assessment_id", NpgsqlDbType.Uuid, assessmentId);
        cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, item.Description);
        cmd.Parameters.AddWithValue("p_quantity", NpgsqlDbType.Numeric, item.Quantity);
        cmd.Parameters.AddWithValue("p_unit", NpgsqlDbType.Varchar, item.Unit);
        cmd.Parameters.AddWithValue("p_unit_cost", NpgsqlDbType.Numeric, item.EstimatedUnitCost);
        cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, item.Priority);
        cmd.Parameters.AddWithValue("p_type", NpgsqlDbType.Varchar, item.ProcurementType);
        
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task DeleteNeedAssessmentItemsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid assessmentId, CancellationToken ct)
    {
        var sql = "DELETE FROM procurement_workflow.need_assessment_items WHERE need_assessment_id = @p_id";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, assessmentId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task UpdateNeedAssessmentStatusAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid id, string status, string? remarks, string actor, CancellationToken ct)
    {
        var sql = @"
            UPDATE procurement_workflow.need_assessments
            SET status = @p_status,
                remarks = COALESCE(@p_remarks, remarks),
                submitted_at = CASE WHEN @p_status = 'Submitted' THEN NOW() ELSE submitted_at END,
                endorsed_at = CASE WHEN @p_status = 'Endorsed' THEN NOW() ELSE endorsed_at END,
                endorsed_by = CASE WHEN @p_status = 'Endorsed' THEN @p_actor ELSE endorsed_by END,
                updated_by = @p_actor,
                updated_at = NOW()
            WHERE need_assessment_id = @p_id";
        
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, id);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, status);
        cmd.Parameters.AddWithValue("p_remarks", NpgsqlDbType.Text, (object?)remarks ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_actor", NpgsqlDbType.Varchar, actor);
        
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<List<NeedAssessmentAuthorizedUser>> GetNeedAssessmentAuthorizedUsersAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string moduleId = "needs-collection";
        var sql = @"
            WITH module_roles AS (
                -- Roles with explicit enabled grant
                SELECT role_id, 'Role-Based' as access_type
                FROM identity.internal_module_grants
                WHERE module_id = @p_module_id AND is_enabled = TRUE AND role_id IS NOT NULL
            ),
            user_grants AS (
                -- Users with explicit grants (can be enabled or disabled)
                SELECT internal_user_id, is_enabled, 'Direct Grant' as access_type
                FROM identity.internal_module_grants
                WHERE module_id = @p_module_id AND internal_user_id IS NOT NULL
            )
            SELECT 
                u.internal_user_id,
                u.email,
                u.first_name || ' ' || u.surname as full_name,
                r.role_name,
                ou.unit_name,
                COALESCE(ug.access_type, mr.access_type) as access_type
            FROM identity.internal_users u
            JOIN identity.roles r ON u.role_id = r.role_id
            JOIN identity.organizational_units ou ON u.unit_id = ou.unit_id
            LEFT JOIN module_roles mr ON u.role_id = mr.role_id
            LEFT JOIN user_grants ug ON u.internal_user_id = ug.internal_user_id
            WHERE 
                (mr.role_id IS NOT NULL OR (ug.internal_user_id IS NOT NULL AND ug.is_enabled = TRUE))
                AND (ug.internal_user_id IS NULL OR ug.is_enabled = TRUE) -- Exclude if direct grant is FALSE
            ORDER BY u.email ASC";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_module_id", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<NeedAssessmentAuthorizedUser>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new NeedAssessmentAuthorizedUser(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5)
            ));
        }
        return results;
    }
}
