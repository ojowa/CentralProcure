using System.Security.Claims;
using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.Governance.Controllers;

[ApiController]
[Authorize]
[Route("api/monitoring")]
public sealed class MonitoringController : BaseModuleController
{
    public MonitoringController(IConfiguration config, ILogger<MonitoringController> logger)
        : base(config, logger)
    {
    }

    [HttpGet]
    public async Task<IActionResult> GetOverview(CancellationToken ct)
    {
        var roleKey = NormalizeRoleKey(User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role));
        if (!string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "ict_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
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

            var metrics = await LoadMetricsAsync(conn, tx, ct);
            var stageLoad = await LoadStageLoadAsync(conn, tx, ct);
            var alerts = BuildAlerts(metrics);
            var services = BuildServices(metrics);
            var integrations = BuildIntegrations(metrics);

            await tx.CommitAsync(ct);

            return Ok(new MonitoringOverviewResponse(
                DateTime.UtcNow,
                alerts.Count,
                alerts.Count(item => string.Equals(item.Severity, "critical", StringComparison.OrdinalIgnoreCase)),
                alerts.Count(item => string.Equals(item.Severity, "warning", StringComparison.OrdinalIgnoreCase)),
                services,
                integrations,
                alerts,
                stageLoad));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving monitoring overview.");
            return Problem("Internal server error retrieving monitoring overview.");
        }
    }

    private static async Task<MonitoringMetrics> LoadMetricsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct)
    {
        const string sql = """
SELECT
    (SELECT COUNT(*) FROM procurement_workflow.workflow_instances) AS workflow_count,
    (SELECT COUNT(*) FROM procurement_workflow.workflow_instances wi
        LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
        WHERE sc.stage_key IS NULL) AS orphaned_workflow_count,
    (SELECT COUNT(*) FROM procurement_workflow.workflow_instances
        WHERE current_stage_key = 'accounting_officer_review'
          AND updated_at < NOW() - INTERVAL '7 days') AS stale_cgis_count,
    (SELECT COUNT(*) FROM procurement_workflow.workflow_instances
        WHERE current_stage_key = 'administrative_review'
          AND updated_at < NOW() - INTERVAL '14 days') AS stale_complaint_count,
    (SELECT COUNT(*) FROM vendor_sourcing.bid_opening_sessions) AS bid_session_count,
    (SELECT COUNT(*) FROM vendor_sourcing.bid_opening_sessions
        WHERE status = 'Scheduled'
          AND scheduled_at < NOW()) AS overdue_bid_opening_count,
    (SELECT COUNT(*) FROM procurement_workflow.bpp_no_objections) AS bpp_case_count,
    (SELECT COUNT(*) FROM procurement_workflow.bpp_no_objections
        WHERE COALESCE(status, '') NOT IN ('Issued', 'Rejected')
          AND COALESCE(updated_at, created_at, requested_at) < NOW() - INTERVAL '14 days') AS pending_bpp_count,
    (SELECT COUNT(*) FROM identity.vendors) AS vendor_count,
    (SELECT COUNT(*) FROM identity.vendors
        WHERE vendor_status = 'Pending Approval'
          AND COALESCE(updated_at, created_at, registration_date) < NOW() - INTERVAL '7 days') AS pending_vendor_approval_count,
    (SELECT COUNT(*) FROM post_award.contracts) AS contract_count,
    (SELECT COUNT(*) FROM post_award.contracts
        WHERE status = 'Active'
          AND end_date < CURRENT_DATE) AS expired_active_contract_count,
    (SELECT COUNT(*) FROM post_award.inspections) AS inspection_count,
    (SELECT COUNT(*) FROM post_award.inspections
        WHERE status = 'Scheduled'
          AND scheduled_date < CURRENT_DATE) AS overdue_inspection_count,
    (SELECT COUNT(*) FROM identity.internal_users WHERE is_active = TRUE) AS active_user_count,
    (SELECT COUNT(*) FROM identity.roles WHERE role_name = 'CGIS') AS cgis_role_count,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - scheduled_at))::int, 0) FROM vendor_sourcing.bid_opening_sessions
        WHERE status = 'Scheduled'
          AND scheduled_at < NOW()) AS oldest_bid_opening_age_days,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - COALESCE(updated_at, created_at, requested_at)))::int, 0) FROM procurement_workflow.bpp_no_objections
        WHERE COALESCE(status, '') NOT IN ('Issued', 'Rejected')
          AND COALESCE(updated_at, created_at, requested_at) < NOW() - INTERVAL '14 days') AS oldest_bpp_age_days,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - COALESCE(updated_at, created_at, registration_date)))::int, 0) FROM identity.vendors
        WHERE vendor_status = 'Pending Approval'
          AND COALESCE(updated_at, created_at, registration_date) < NOW() - INTERVAL '7 days') AS oldest_vendor_age_days,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - updated_at))::int, 0) FROM procurement_workflow.workflow_instances
        WHERE current_stage_key = 'accounting_officer_review'
          AND updated_at < NOW() - INTERVAL '7 days') AS oldest_cgis_age_days,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - updated_at))::int, 0) FROM procurement_workflow.workflow_instances
        WHERE current_stage_key = 'administrative_review'
          AND updated_at < NOW() - INTERVAL '14 days') AS oldest_complaint_age_days,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - scheduled_date))::int, 0) FROM post_award.inspections
        WHERE status = 'Scheduled'
          AND scheduled_date < CURRENT_DATE) AS oldest_inspection_age_days,
    (SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW() - end_date))::int, 0) FROM post_award.contracts
        WHERE status = 'Active'
          AND end_date < CURRENT_DATE) AS oldest_contract_age_days;
""";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);

        return new MonitoringMetrics(
            reader.GetInt32(reader.GetOrdinal("workflow_count")),
            reader.GetInt32(reader.GetOrdinal("orphaned_workflow_count")),
            reader.GetInt32(reader.GetOrdinal("stale_cgis_count")),
            reader.GetInt32(reader.GetOrdinal("stale_complaint_count")),
            reader.GetInt32(reader.GetOrdinal("bid_session_count")),
            reader.GetInt32(reader.GetOrdinal("overdue_bid_opening_count")),
            reader.GetInt32(reader.GetOrdinal("bpp_case_count")),
            reader.GetInt32(reader.GetOrdinal("pending_bpp_count")),
            reader.GetInt32(reader.GetOrdinal("vendor_count")),
            reader.GetInt32(reader.GetOrdinal("pending_vendor_approval_count")),
            reader.GetInt32(reader.GetOrdinal("contract_count")),
            reader.GetInt32(reader.GetOrdinal("expired_active_contract_count")),
            reader.GetInt32(reader.GetOrdinal("inspection_count")),
            reader.GetInt32(reader.GetOrdinal("overdue_inspection_count")),
            reader.GetInt32(reader.GetOrdinal("active_user_count")),
            reader.GetInt32(reader.GetOrdinal("cgis_role_count")),
            reader.GetInt32(reader.GetOrdinal("oldest_bid_opening_age_days")),
            reader.GetInt32(reader.GetOrdinal("oldest_bpp_age_days")),
            reader.GetInt32(reader.GetOrdinal("oldest_vendor_age_days")),
            reader.GetInt32(reader.GetOrdinal("oldest_cgis_age_days")),
            reader.GetInt32(reader.GetOrdinal("oldest_complaint_age_days")),
            reader.GetInt32(reader.GetOrdinal("oldest_inspection_age_days")),
            reader.GetInt32(reader.GetOrdinal("oldest_contract_age_days")));
    }

    private static async Task<IReadOnlyList<MonitoringStageLoadItem>> LoadStageLoadAsync(NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct)
    {
        const string sql = """
SELECT wi.current_stage_key, COALESCE(sc.stage_title, wi.current_stage_key) AS stage_title, COUNT(*) AS active_count
FROM procurement_workflow.workflow_instances wi
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
GROUP BY wi.current_stage_key, COALESCE(sc.stage_title, wi.current_stage_key)
ORDER BY COUNT(*) DESC, stage_title ASC
LIMIT 8;
""";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<MonitoringStageLoadItem>();

        while (await reader.ReadAsync(ct))
        {
            results.Add(new MonitoringStageLoadItem(
                reader.GetString(reader.GetOrdinal("current_stage_key")),
                reader.GetString(reader.GetOrdinal("stage_title")),
                reader.GetInt32(reader.GetOrdinal("active_count"))));
        }

        return results;
    }

    private static IReadOnlyList<MonitoringStatusItem> BuildServices(MonitoringMetrics metrics) =>
    [
        BuildStatus("governance_api", "Governance API", "healthy", "Monitoring endpoint and governance module are responding.", 1),
        BuildStatus("primary_database", "Primary Database", "healthy", $"Connected and reading {metrics.WorkflowCount} workflow runtime records.", metrics.WorkflowCount),
        BuildStatus("workflow_runtime", "Workflow Runtime", metrics.OrphanedWorkflowCount > 0 ? "degraded" : "healthy", metrics.OrphanedWorkflowCount > 0 ? "Some workflow instances point to missing stage catalog entries." : "Workflow instances resolve cleanly to the stage catalog.", metrics.OrphanedWorkflowCount),
        BuildStatus("identity", "Identity and Access", metrics.CgisRoleCount == 0 ? "critical" : "healthy", metrics.CgisRoleCount == 0 ? "CGIS role is missing from the identity catalog." : $"Identity catalog is available with {metrics.ActiveUserCount} active internal users.", metrics.ActiveUserCount),
        BuildStatus("vendor_sourcing", "Vendor Sourcing", metrics.OverdueBidOpeningCount > 0 ? "degraded" : "healthy", metrics.OverdueBidOpeningCount > 0 ? "Some bid opening sessions are still scheduled past their opening time." : $"Tender operations are reachable. {metrics.BidSessionCount} bid opening sessions are tracked.", metrics.BidSessionCount),
        BuildStatus("post_award", "Post-Award", metrics.ExpiredActiveContractCount > 0 || metrics.OverdueInspectionCount > 0 ? "degraded" : "healthy", metrics.ExpiredActiveContractCount > 0 ? "Active contracts have passed their end date." : $"Post-award records are readable. {metrics.ContractCount} contracts and {metrics.InspectionCount} inspections are tracked.", metrics.ContractCount + metrics.InspectionCount)
    ];

    private static IReadOnlyList<MonitoringStatusItem> BuildIntegrations(MonitoringMetrics metrics) =>
    [
        BuildStatus("cgis_queue", "CGIS Approval Queue", metrics.StaleCgisCount > 0 ? "warning" : "healthy", metrics.StaleCgisCount > 0 ? "Some procurement plans have remained at CGIS approval for more than 7 days." : "No overdue cases are currently stuck at CGIS approval.", metrics.StaleCgisCount),
        BuildStatus("vendor_registration", "Vendor Registration Approval", metrics.PendingVendorApprovalCount > 0 ? "warning" : "healthy", metrics.PendingVendorApprovalCount > 0 ? "Vendor registrations are pending approval beyond the operational target window." : "No overdue vendor registration approvals detected.", metrics.PendingVendorApprovalCount),
        BuildStatus("bpp_no_objection", "BPP No Objection", metrics.PendingBppCount > 0 ? "warning" : "healthy", metrics.PendingBppCount > 0 ? "BPP prior-review records are pending beyond 14 days." : "No overdue BPP no-objection records detected.", metrics.PendingBppCount),
        BuildStatus("administrative_review", "Administrative Review", metrics.StaleComplaintCount > 0 ? "warning" : "healthy", metrics.StaleComplaintCount > 0 ? "Complaint cases remain unresolved beyond 14 days." : "No overdue administrative review cases detected.", metrics.StaleComplaintCount)
    ];

    private static List<MonitoringAlertItem> BuildAlerts(MonitoringMetrics metrics)
    {
        var alerts = new List<MonitoringAlertItem>();

        AddAlert(alerts, metrics.OrphanedWorkflowCount > 0, "critical", "Workflow Runtime", "Orphaned workflow instances", "Workflow instances reference stage keys that are not present in the stage catalog.", metrics.OrphanedWorkflowCount, null);
        AddAlert(alerts, metrics.CgisRoleCount == 0, "critical", "Identity", "CGIS role missing", "The live identity role catalog does not contain the CGIS role.", 1, null);
        AddAlert(alerts, metrics.OverdueBidOpeningCount > 0, "warning", "Vendor Sourcing", "Overdue bid opening sessions", "Scheduled bid opening sessions have passed their scheduled time without being opened.", metrics.OverdueBidOpeningCount, metrics.OldestBidOpeningAgeDays);
        AddAlert(alerts, metrics.PendingBppCount > 0, "warning", "BPP Escalation", "Stale BPP no-objection records", "BPP prior-review cases are pending beyond the expected resolution window.", metrics.PendingBppCount, metrics.OldestBppAgeDays);
        AddAlert(alerts, metrics.PendingVendorApprovalCount > 0, "warning", "Vendor Registration", "Overdue vendor approvals", "Vendor registrations remain pending approval beyond 7 days.", metrics.PendingVendorApprovalCount, metrics.OldestVendorAgeDays);
        AddAlert(alerts, metrics.StaleCgisCount > 0, "warning", "CGIS Approval", "Stale CGIS approvals", "Departmental plans have remained at CGIS approval longer than 7 days.", metrics.StaleCgisCount, metrics.OldestCgisAgeDays);
        AddAlert(alerts, metrics.StaleComplaintCount > 0, "warning", "Administrative Review", "Stale complaint cases", "Administrative review cases have not progressed in over 14 days.", metrics.StaleComplaintCount, metrics.OldestComplaintAgeDays);
        AddAlert(alerts, metrics.OverdueInspectionCount > 0, "warning", "Inspection", "Overdue inspections", "Scheduled inspections are still open after their scheduled date.", metrics.OverdueInspectionCount, metrics.OldestInspectionAgeDays);
        AddAlert(alerts, metrics.ExpiredActiveContractCount > 0, "warning", "Contract Management", "Expired active contracts", "Contracts are still marked active after their end date.", metrics.ExpiredActiveContractCount, metrics.OldestContractAgeDays);

        return alerts;
    }

    private static void AddAlert(List<MonitoringAlertItem> alerts, bool condition, string severity, string source, string title, string detail, int affectedCount, int? oldestAgeDays)
    {
        if (!condition)
        {
            return;
        }

        alerts.Add(new MonitoringAlertItem(severity, source, title, detail, affectedCount, oldestAgeDays));
    }

    private static MonitoringStatusItem BuildStatus(string key, string label, string status, string summary, int count) =>
        new(key, label, status, summary, count);

    private static string? NormalizeRoleKey(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        var normalized = role.Trim().Replace("-", "_").Replace(" ", "_");
        normalized = System.Text.RegularExpressions.Regex.Replace(normalized, "([a-z0-9])([A-Z])", "$1_$2").ToLowerInvariant();
        return normalized switch
        {
            "system_administrator" => "ict_admin",
            _ => normalized
        };
    }

    private sealed record MonitoringMetrics(
        int WorkflowCount,
        int OrphanedWorkflowCount,
        int StaleCgisCount,
        int StaleComplaintCount,
        int BidSessionCount,
        int OverdueBidOpeningCount,
        int BppCaseCount,
        int PendingBppCount,
        int VendorCount,
        int PendingVendorApprovalCount,
        int ContractCount,
        int ExpiredActiveContractCount,
        int InspectionCount,
        int OverdueInspectionCount,
        int ActiveUserCount,
        int CgisRoleCount,
        int OldestBidOpeningAgeDays,
        int OldestBppAgeDays,
        int OldestVendorAgeDays,
        int OldestCgisAgeDays,
        int OldestComplaintAgeDays,
        int OldestInspectionAgeDays,
        int OldestContractAgeDays);
}
