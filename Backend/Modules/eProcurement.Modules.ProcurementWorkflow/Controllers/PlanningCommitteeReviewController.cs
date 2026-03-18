using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/planning-committee")]
public class PlanningCommitteeReviewController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<PlanningCommitteeReviewController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public PlanningCommitteeReviewController(
        IConfiguration config,
        ILogger<PlanningCommitteeReviewController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpGet("plans/{planId:guid}/reviews")]
    public async Task<IActionResult> GetReviews(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.get_member_reviews_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            await cmd.ExecuteNonQueryAsync(ct);
            var cursorName = (string)cmd.Parameters["p_result"].Value!;
            await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
            await using var reader = await fetch.ExecuteReaderAsync(ct);

            var reviews = new List<MemberReviewResponse>();
            while (await reader.ReadAsync(ct))
            {
                reviews.Add(new MemberReviewResponse(
                    reader.GetGuid(reader.GetOrdinal("review_id")),
                    reader.GetGuid(reader.GetOrdinal("plan_id")),
                    reader.GetString(reader.GetOrdinal("reviewer_role")),
                    reader.GetString(reader.GetOrdinal("reviewer_user_id")),
                    reader.GetString(reader.GetOrdinal("decision")),
                    reader.IsDBNull(reader.GetOrdinal("remarks")) ? null : reader.GetString(reader.GetOrdinal("remarks")),
                    reader.GetDateTime(reader.GetOrdinal("created_at")),
                    reader.GetDateTime(reader.GetOrdinal("updated_at"))
                ));
            }

            await tx.CommitAsync(ct);
            return Ok(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member reviews for plan {PlanId}", planId);
            return Problem("Internal server error retrieving reviews.");
        }
    }

    [HttpPost("submit-member-review")]
    public async Task<IActionResult> SubmitMemberReview([FromBody] MemberReviewSubmitRequest request, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.submit_member_review_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, request.PlanId);
            cmd.Parameters.AddWithValue("p_reviewer_role", NpgsqlDbType.Varchar, request.ReviewerRole);
            cmd.Parameters.AddWithValue("p_reviewer_user_id", NpgsqlDbType.Varchar, request.ReviewerUserId);
            cmd.Parameters.AddWithValue("p_decision", NpgsqlDbType.Varchar, request.Decision);
            cmd.Parameters.AddWithValue("p_remarks", NpgsqlDbType.Text, (object?)request.Remarks ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            await cmd.ExecuteNonQueryAsync(ct);
            var cursorName = (string)cmd.Parameters["p_result"].Value!;
            await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
            await using var reader = await fetch.ExecuteReaderAsync(ct);

            if (await reader.ReadAsync(ct))
            {
                var response = new MemberReviewResponse(
                    reader.GetGuid(reader.GetOrdinal("review_id")),
                    reader.GetGuid(reader.GetOrdinal("plan_id")),
                    reader.GetString(reader.GetOrdinal("reviewer_role")),
                    reader.GetString(reader.GetOrdinal("reviewer_user_id")),
                    reader.GetString(reader.GetOrdinal("decision")),
                    reader.IsDBNull(reader.GetOrdinal("remarks")) ? null : reader.GetString(reader.GetOrdinal("remarks")),
                    reader.GetDateTime(reader.GetOrdinal("created_at")),
                    reader.GetDateTime(reader.GetOrdinal("created_at")) // Initial update matches created
                );

                await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                    "procurement_plan",
                    request.PlanId,
                    "planning_committee_review",
                    "Submitted",
                    $"Member Review: {request.Decision}",
                    null,
                    null,
                    null,
                    null,
                    null,
                    request.Remarks ?? "Member review submitted.",
                    request.ReviewerUserId), ct);

                await tx.CommitAsync(ct);
                return Ok(response);
            }

            return Problem("Failed to submit member review.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting member review for plan {PlanId}", request.PlanId);
            return Problem("Internal server error submitting review.");
        }
    }

    [HttpPost("submit-committee-decision")]
    public async Task<IActionResult> SubmitCommitteeDecision([FromBody] CommitteeDecisionSubmitRequest request, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.submit_committee_decision_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, request.PlanId);
            cmd.Parameters.AddWithValue("p_chairman_user_id", NpgsqlDbType.Varchar, request.ChairmanUserId);
            cmd.Parameters.AddWithValue("p_secretary_user_id", NpgsqlDbType.Varchar, request.SecretaryUserId);
            cmd.Parameters.AddWithValue("p_overall_decision", NpgsqlDbType.Varchar, request.OverallDecision);
            cmd.Parameters.AddWithValue("p_committee_remarks", NpgsqlDbType.Text, (object?)request.CommitteeRemarks ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_meeting_date", NpgsqlDbType.Date, (object?)request.MeetingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            await cmd.ExecuteNonQueryAsync(ct);
            var cursorName = (string)cmd.Parameters["p_result"].Value!;
            await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
            await using var reader = await fetch.ExecuteReaderAsync(ct);

            if (await reader.ReadAsync(ct))
            {
                var response = new CommitteeDecisionResponse(
                    reader.GetGuid(reader.GetOrdinal("decision_id")),
                    reader.GetGuid(reader.GetOrdinal("plan_id")),
                    reader.GetString(reader.GetOrdinal("overall_decision")),
                    reader.IsDBNull(reader.GetOrdinal("committee_remarks")) ? null : reader.GetString(reader.GetOrdinal("committee_remarks")),
                    reader.GetDateTime(reader.GetOrdinal("meeting_date")),
                    reader.GetDateTime(reader.GetOrdinal("created_at"))
                );

                string nextStage = request.OverallDecision switch
                {
                    "Recommended" => "budget_confirmation",
                    "Returned" => "department_need_capture",
                    _ => "app_approval" // Final rejection is a terminal-ish state in APP
                };

                await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                    "procurement_plan",
                    request.PlanId,
                    nextStage,
                    request.OverallDecision == "Recommended" ? "Submitted" : request.OverallDecision == "Returned" ? "Draft" : "Rejected",
                    $"Committee Decision: {request.OverallDecision}",
                    null,
                    null,
                    null,
                    null,
                    null,
                    request.CommitteeRemarks ?? "Committee decision recorded.",
                    request.ChairmanUserId), ct);

                await tx.CommitAsync(ct);
                return Ok(response);
            }

            return Problem("Failed to submit committee decision.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting committee decision for plan {PlanId}", request.PlanId);
            return Problem("Internal server error submitting decision.");
        }
    }
}
