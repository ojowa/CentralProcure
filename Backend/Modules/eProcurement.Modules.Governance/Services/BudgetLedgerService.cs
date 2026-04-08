using System.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.Governance.Services;

public class BudgetLedgerService : IBudgetLedgerService
{
    private readonly IConfiguration _config;
    private readonly ILogger<BudgetLedgerService> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    private const int MaxDepartmentLength = 150;
    private const int MaxBudgetCodeLength = 60;

    public BudgetLedgerService(
        IConfiguration config,
        ILogger<BudgetLedgerService> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    public async Task<BudgetAppropriationResponse> CreateAppropriationAsync(BudgetAppropriationCreateRequest request, CancellationToken ct)
    {
        var department = request.Department?.Trim();
        var budgetCode = request.BudgetCode?.Trim();
        var normalizedStatus = string.Equals(request.Status, "Closed", StringComparison.OrdinalIgnoreCase) ? "Closed" : "Active";
        var notes = request.Notes?.Trim();

        const string sql = @"
            INSERT INTO procurement_workflow.budget_appropriations (fiscal_year, department, budget_code, amount, status, notes)
            VALUES (@p_fiscal_year, @p_department, @p_budget_code, @p_amount, @p_status, @p_notes)
            RETURNING appropriation_id, fiscal_year, department, budget_code, amount, status, notes, created_at, updated_at;";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, request.FiscalYear);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department!);
        cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, budgetCode!);
        cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, normalizedStatus);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)notes ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Budget appropriation could not be created.");

        return MapBudgetAppropriation(reader);
    }

    public async Task<BudgetAppropriationListResponse> GetAppropriationsAsync(int? fiscalYear, string? department, string? budgetCode, string? status, int page, int pageSize, CancellationToken ct)
    {
        var baseSql = @"
            FROM procurement_workflow.budget_appropriations
            WHERE (@p_fiscal_year IS NULL OR fiscal_year = @p_fiscal_year)
              AND (@p_department IS NULL OR department ILIKE '%' || @p_department || '%')
              AND (@p_budget_code IS NULL OR budget_code ILIKE '%' || @p_budget_code || '%')
              AND (@p_status IS NULL OR status = @p_status)";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);

        var countCmd = new NpgsqlCommand("SELECT COUNT(*)" + baseSql, conn);
        AddAppropriationFilters(countCmd, fiscalYear, department, budgetCode, status);
        var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

        var itemCmd = new NpgsqlCommand("SELECT appropriation_id, fiscal_year, department, budget_code, amount, status, notes, created_at, updated_at" + baseSql + " ORDER BY created_at DESC OFFSET @p_offset LIMIT @p_limit;", conn);
        AddAppropriationFilters(itemCmd, fiscalYear, department, budgetCode, status);
        itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
        itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

        var items = new List<BudgetAppropriationResponse>();
        await using var reader = await itemCmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) items.Add(MapBudgetAppropriation(reader));

        return new BudgetAppropriationListResponse(items, page, pageSize, total);
    }

    public async Task<BudgetAppropriationResponse> CloseAppropriationAsync(Guid id, CancellationToken ct)
    {
        const string sql = @"
            UPDATE procurement_workflow.budget_appropriations SET status = 'Closed', updated_at = NOW()
            WHERE appropriation_id = @p_appropriation_id AND status = 'Active'
            RETURNING appropriation_id, fiscal_year, department, budget_code, amount, status, notes, created_at, updated_at;";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Active appropriation not found or already closed.");

        return MapBudgetAppropriation(reader);
    }

    public async Task<BudgetReleaseResponse> CreateReleaseAsync(BudgetReleaseCreateRequest request, CancellationToken ct)
    {
        const string sql = @"
            WITH appropriation AS (SELECT appropriation_id, fiscal_year, department, budget_code, amount FROM procurement_workflow.budget_appropriations WHERE appropriation_id = @p_appropriation_id AND status = 'Active'),
            released AS (SELECT COALESCE(SUM(amount), 0) AS total_released FROM procurement_workflow.budget_releases WHERE appropriation_id = @p_appropriation_id),
            insert_release AS (
                INSERT INTO procurement_workflow.budget_releases (appropriation_id, amount, release_date, notes)
                SELECT @p_appropriation_id, @p_amount, @p_release_date, @p_notes FROM appropriation a CROSS JOIN released r WHERE (r.total_released + @p_amount) <= a.amount
                RETURNING release_id, appropriation_id, amount, release_date, notes, created_at, updated_at
            )
            SELECT ir.release_id, ir.appropriation_id, a.fiscal_year, a.department, a.budget_code, a.amount AS appropriation_amount, ir.amount, ir.release_date, ir.notes, ir.created_at, ir.updated_at
            FROM insert_release ir JOIN appropriation a ON a.appropriation_id = ir.appropriation_id;";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, request.AppropriationId);
        cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
        cmd.Parameters.AddWithValue("p_release_date", NpgsqlDbType.Timestamp, request.ReleaseDate ?? DateTime.UtcNow);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes?.Trim() ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Release could not be recorded. Ensure the appropriation is active and the release does not exceed the appropriated amount.");

        return new BudgetReleaseResponse(
            reader.GetGuid(reader.GetOrdinal("release_id")), reader.GetGuid(reader.GetOrdinal("appropriation_id")), reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("department")), reader.GetString(reader.GetOrdinal("budget_code")), reader.GetDecimal(reader.GetOrdinal("appropriation_amount")),
            reader.GetDecimal(reader.GetOrdinal("amount")), reader.GetDateTime(reader.GetOrdinal("release_date")), reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")),
            reader.GetDateTime(reader.GetOrdinal("created_at")), reader.GetDateTime(reader.GetOrdinal("updated_at")));
    }

    public async Task<BudgetReleaseListResponse> GetReleasesAsync(Guid? appropriationId, int page, int pageSize, CancellationToken ct)
    {
        var baseSql = @"
            FROM procurement_workflow.budget_releases r JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = r.appropriation_id
            WHERE (@p_appropriation_id IS NULL OR r.appropriation_id = @p_appropriation_id)";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);

        var countCmd = new NpgsqlCommand("SELECT COUNT(*)" + baseSql, conn);
        countCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
        var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

        var itemSql = "SELECT r.release_id, r.appropriation_id, a.fiscal_year, a.department, a.budget_code, a.amount AS appropriation_amount, r.amount, r.release_date, r.notes, r.created_at, r.updated_at" + baseSql + " ORDER BY r.release_date DESC, r.created_at DESC OFFSET @p_offset LIMIT @p_limit;";
        var itemCmd = new NpgsqlCommand(itemSql, conn);
        itemCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
        itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
        itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

        var items = new List<BudgetReleaseResponse>();
        await using var reader = await itemCmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            items.Add(new BudgetReleaseResponse(
                reader.GetGuid(reader.GetOrdinal("release_id")), reader.GetGuid(reader.GetOrdinal("appropriation_id")), reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("department")), reader.GetString(reader.GetOrdinal("budget_code")), reader.GetDecimal(reader.GetOrdinal("appropriation_amount")),
                reader.GetDecimal(reader.GetOrdinal("amount")), reader.GetDateTime(reader.GetOrdinal("release_date")), reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")),
                reader.GetDateTime(reader.GetOrdinal("created_at")), reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }
        return new BudgetReleaseListResponse(items, page, pageSize, total);
    }

    public async Task<BudgetCommitmentResponse> CreateCommitmentAsync(BudgetCommitmentCreateRequest request, CancellationToken ct)
    {
        const string sql = @"
            WITH appropriation AS (SELECT appropriation_id, fiscal_year, department, budget_code, amount FROM procurement_workflow.budget_appropriations WHERE appropriation_id = @p_appropriation_id AND status = 'Active'),
            committed AS (SELECT COALESCE(SUM(amount), 0) AS total_committed FROM procurement_workflow.budget_commitments WHERE appropriation_id = @p_appropriation_id),
            insert_commitment AS (
                INSERT INTO procurement_workflow.budget_commitments (appropriation_id, fiscal_year, department, budget_code, amount, status, committed_at)
                SELECT @p_appropriation_id, a.fiscal_year, a.department, a.budget_code, @p_amount, 'Committed', @p_committed_at FROM appropriation a CROSS JOIN committed c WHERE (c.total_committed + @p_amount) <= a.amount
                RETURNING commitment_id, appropriation_id, fiscal_year, department, budget_code, amount, status, committed_at, created_at, updated_at
            )
            SELECT ic.commitment_id, ic.appropriation_id, ic.fiscal_year, ic.department, ic.budget_code, a.amount AS appropriation_amount, ic.amount, ic.committed_at, ic.status, ic.created_at, ic.updated_at
            FROM insert_commitment ic JOIN appropriation a ON a.appropriation_id = ic.appropriation_id;";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, request.AppropriationId);
        cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
        cmd.Parameters.AddWithValue("p_committed_at", NpgsqlDbType.Timestamp, request.CommittedAt ?? DateTime.UtcNow);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Commitment could not be recorded. Ensure the appropriation is active and the total commitments do not exceed the appropriation amount.");

        return new BudgetCommitmentResponse(
            reader.GetGuid(reader.GetOrdinal("commitment_id")), reader.GetGuid(reader.GetOrdinal("appropriation_id")), null, null, null,
            reader.GetInt32(reader.GetOrdinal("fiscal_year")), reader.GetString(reader.GetOrdinal("department")), reader.GetString(reader.GetOrdinal("budget_code")),
            reader.GetDecimal(reader.GetOrdinal("appropriation_amount")), reader.GetDecimal(reader.GetOrdinal("amount")), reader.GetDateTime(reader.GetOrdinal("committed_at")),
            reader.GetString(reader.GetOrdinal("status")), reader.GetDateTime(reader.GetOrdinal("created_at")), reader.GetDateTime(reader.GetOrdinal("updated_at")));
    }

    public async Task<BudgetCommitmentListResponse> GetCommitmentsAsync(Guid? appropriationId, string? status, int page, int pageSize, CancellationToken ct)
    {
        const string baseSql = @"
            FROM procurement_workflow.budget_commitments c
            LEFT JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = c.appropriation_id
            LEFT JOIN procurement_workflow.requisitions r ON r.requisition_id = c.requisition_id
            WHERE (@p_appropriation_id IS NULL OR c.appropriation_id = @p_appropriation_id)
              AND (@p_status IS NULL OR c.status = @p_status)";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);

        var countCmd = new NpgsqlCommand("SELECT COUNT(*)" + baseSql, conn);
        countCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
        countCmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

        var itemSql = @"SELECT c.commitment_id, c.appropriation_id, c.requisition_id, r.title AS requisition_title, r.status AS requisition_status,
                        c.fiscal_year, c.department, c.budget_code, COALESCE(a.amount, 0) AS appropriation_amount, c.amount, c.status, c.committed_at, c.created_at, c.updated_at " + baseSql + " ORDER BY c.committed_at DESC, c.created_at DESC OFFSET @p_offset LIMIT @p_limit;";
        var itemCmd = new NpgsqlCommand(itemSql, conn);
        itemCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
        itemCmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
        itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

        var items = new List<BudgetCommitmentResponse>();
        await using var reader = await itemCmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            items.Add(new BudgetCommitmentResponse(
                reader.GetGuid(reader.GetOrdinal("commitment_id")), reader.IsDBNull(reader.GetOrdinal("appropriation_id")) ? null : reader.GetGuid(reader.GetOrdinal("appropriation_id")),
                reader.IsDBNull(reader.GetOrdinal("requisition_id")) ? null : reader.GetGuid(reader.GetOrdinal("requisition_id")),
                reader.IsDBNull(reader.GetOrdinal("requisition_title")) ? null : reader.GetString(reader.GetOrdinal("requisition_title")),
                reader.IsDBNull(reader.GetOrdinal("requisition_status")) ? null : reader.GetString(reader.GetOrdinal("requisition_status")),
                reader.GetInt32(reader.GetOrdinal("fiscal_year")), reader.GetString(reader.GetOrdinal("department")), reader.GetString(reader.GetOrdinal("budget_code")),
                reader.GetDecimal(reader.GetOrdinal("appropriation_amount")), reader.GetDecimal(reader.GetOrdinal("amount")), reader.GetDateTime(reader.GetOrdinal("committed_at")),
                reader.GetString(reader.GetOrdinal("status")), reader.GetDateTime(reader.GetOrdinal("created_at")), reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }
        return new BudgetCommitmentListResponse(items, page, pageSize, total);
    }

    public async Task<BudgetCommitmentResponse> CancelCommitmentAsync(Guid id, CancellationToken ct)
    {
        const string sql = @"
            UPDATE procurement_workflow.budget_commitments SET status = 'Cancelled', updated_at = NOW()
            WHERE commitment_id = @p_commitment_id AND status IN ('Reserved', 'Committed')
            RETURNING commitment_id, appropriation_id, requisition_id, fiscal_year, department, budget_code, amount, status, committed_at, created_at, updated_at;";

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_commitment_id", NpgsqlDbType.Uuid, id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Commitment could not be cancelled.");

        var commitmentId = reader.GetGuid(reader.GetOrdinal("commitment_id"));
        var appropriationId = reader.IsDBNull(reader.GetOrdinal("appropriation_id")) ? (Guid?)null : reader.GetGuid(reader.GetOrdinal("appropriation_id"));
        var requisitionId = reader.IsDBNull(reader.GetOrdinal("requisition_id")) ? (Guid?)null : reader.GetGuid(reader.GetOrdinal("requisition_id"));
        var fiscalYear = reader.GetInt32(reader.GetOrdinal("fiscal_year"));
        var department = reader.GetString(reader.GetOrdinal("department"));
        var budgetCode = reader.GetString(reader.GetOrdinal("budget_code"));
        var amount = reader.GetDecimal(reader.GetOrdinal("amount"));
        var committedAt = reader.GetDateTime(reader.GetOrdinal("committed_at"));
        var status = reader.GetString(reader.GetOrdinal("status"));
        var createdAt = reader.GetDateTime(reader.GetOrdinal("created_at"));
        var updatedAt = reader.GetDateTime(reader.GetOrdinal("updated_at"));
        await reader.CloseAsync();

        decimal appAmount = 0;
        if (appropriationId.HasValue)
        {
            const string appSql = "SELECT amount FROM procurement_workflow.budget_appropriations WHERE appropriation_id = @p_id;";
            await using var appCmd = new NpgsqlCommand(appSql, conn);
            appCmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, appropriationId.Value);
            appAmount = Convert.ToDecimal(await appCmd.ExecuteScalarAsync(ct) ?? 0);
        }

        string? reqTitle = null, reqStatus = null;
        if (requisitionId.HasValue)
        {
            const string reqSql = "SELECT title, status FROM procurement_workflow.requisitions WHERE requisition_id = @p_req_id;";
            await using var reqCmd = new NpgsqlCommand(reqSql, conn);
            reqCmd.Parameters.AddWithValue("p_req_id", NpgsqlDbType.Uuid, requisitionId.Value);
            await using var reqReader = await reqCmd.ExecuteReaderAsync(ct);
            if (await reqReader.ReadAsync(ct)) { reqTitle = reqReader.GetString(0); reqStatus = reqReader.GetString(1); }
        }

        return new BudgetCommitmentResponse(commitmentId, appropriationId, requisitionId, reqTitle, reqStatus, fiscalYear, department, budgetCode, appAmount, amount, committedAt, status, createdAt, updatedAt);
    }

    public Task<BudgetDashboardResponse> GetDashboardAsync(int fiscalYear, CancellationToken ct) => throw new NotImplementedException();
    public Task<BudgetSummaryResponse> GetBudgetSummaryAsync(string budgetCode, string department, int fiscalYear, CancellationToken ct) => throw new NotImplementedException();
    public Task<BudgetConfirmationListResponse> GetConfirmationQueueAsync(string? department, int? fiscalYear, string? status, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
    public Task<BudgetConfirmationDetail> GetConfirmationDetailAsync(Guid planId, CancellationToken ct) => throw new NotImplementedException();
    public Task<BudgetDecisionResponse> SubmitDecisionAsync(Guid planId, BudgetDecisionRequest request, string actor, CancellationToken ct) => throw new NotImplementedException();
    public Task<BudgetRequisitionListResponse> GetRequisitionQueueAsync(string? department, string? status, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();

    private static void AddAppropriationFilters(NpgsqlCommand cmd, int? fiscalYear, string? department, string? budgetCode, string? status)
    {
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)budgetCode?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
    }

    private static BudgetAppropriationResponse MapBudgetAppropriation(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("appropriation_id")), reader.GetInt32(reader.GetOrdinal("fiscal_year")), reader.GetString(reader.GetOrdinal("department")),
            reader.GetString(reader.GetOrdinal("budget_code")), reader.GetDecimal(reader.GetOrdinal("amount")), reader.GetString(reader.GetOrdinal("status")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")), reader.GetDateTime(reader.GetOrdinal("created_at")), reader.GetDateTime(reader.GetOrdinal("updated_at")));
}
