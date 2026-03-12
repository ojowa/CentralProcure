using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.PostAward.DTOs;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api")]
public class BidsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<BidsController> _logger;
    private readonly IWebHostEnvironment _environment;

    private const long MaxProposalFileBytes = 10 * 1024 * 1024; // 10 MB
    private static readonly HashSet<string> AllowedProposalExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".doc",
        ".docx"
    };

    public BidsController(IConfiguration config, ILogger<BidsController> logger, IWebHostEnvironment environment)
    {
        _config = config;
        _logger = logger;
        _environment = environment;
    }

    [Authorize]
    [HttpPost("bids")]
    public async Task<IActionResult> SubmitBid([FromForm] SubmitBidForm request, CancellationToken ct)
    {
        var tokenVendorId = GetVendorIdFromClaims();
        if (!tokenVendorId.HasValue || !IsAuthorizedVendor(tokenVendorId.Value))
        {
            return Forbid();
        }

        if (request.VendorId != tokenVendorId.Value)
        {
            _logger.LogWarning("Vendor ID mismatch on bid submit. Token {TokenVendorId}, Request {RequestVendorId}", tokenVendorId, request.VendorId);
            return Forbid();
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if ((request.TechnicalProposalFile is null || request.TechnicalProposalFile.Length == 0) &&
            string.IsNullOrWhiteSpace(request.TechnicalProposal))
        {
            return BadRequest(new { message = "Technical proposal text or file is required." });
        }

        var technicalProposalValue = request.TechnicalProposal ?? string.Empty;
        if (request.TechnicalProposalFile is not null && request.TechnicalProposalFile.Length > 0)
        {
            if (request.TechnicalProposalFile.Length > MaxProposalFileBytes)
            {
                return BadRequest(new { message = "Technical proposal file exceeds 10 MB limit." });
            }

            var safeFileName = Path.GetFileName(request.TechnicalProposalFile.FileName);
            var extension = Path.GetExtension(safeFileName);
            if (string.IsNullOrWhiteSpace(extension) || !AllowedProposalExtensions.Contains(extension))
            {
                return BadRequest(new { message = "Only PDF and Word documents are allowed." });
            }

            var uploadsRoot = Path.Combine(_environment.ContentRootPath, "uploads", "bids");
            Directory.CreateDirectory(uploadsRoot);

            var fileName = $"{tokenVendorId.Value:N}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{extension}";
            var filePath = Path.Combine(uploadsRoot, fileName);
            await using (var stream = System.IO.File.Create(filePath))
            {
                await request.TechnicalProposalFile.CopyToAsync(stream, ct);
            }

            technicalProposalValue = Path.Combine("uploads", "bids", fileName).Replace("\\", "/");
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("vendor_sourcing.submit_bid_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, request.TenderId);
            cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, tokenVendorId.Value);
            cmd.Parameters.AddWithValue("p_bid_amount", NpgsqlDbType.Numeric, request.FinancialBid);
            cmd.Parameters.AddWithValue("p_technical_proposal_url", NpgsqlDbType.Text, technicalProposalValue);
            cmd.Parameters.AddWithValue("p_validity_period_days", NpgsqlDbType.Integer, request.ValidityPeriodDays);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapBidSubmissionResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null
                ? Problem("No bid record returned.")
                : Created($"/api/bids/{result.BidId}", result);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            _logger.LogWarning(ex, "Duplicate bid attempt for vendor {VendorId} on tender {TenderId}.", tokenVendorId, request.TenderId);
            return Conflict(new { message = "You have already submitted a bid for this tender." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting bid.");
            return Problem("Internal server error during bid submission.");
        }
    }

    [Authorize]
    [HttpGet("vendors/{vendorId:guid}/bids")]
    public async Task<IActionResult> GetVendorBids(Guid vendorId, CancellationToken ct)
    {
        if (!IsAuthorizedVendor(vendorId))
        {
            return Forbid();
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("vendor_sourcing.get_submitted_bids_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapSubmittedBid, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting vendor bids for {VendorId}", vendorId);
            return Problem("Internal server error retrieving bids.");
        }
    }

    [Authorize]
    [HttpGet("bids/{bidId:guid}")]
    public async Task<IActionResult> GetBid(Guid bidId, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsAuthorizedVendor(vendorId.Value))
        {
            return Forbid();
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    b.bid_id,
    b.tender_id,
    t.title AS tender_title,
    b.vendor_id,
    b.bid_amount,
    b.technical_proposal_url,
    b.validity_period_days,
    b.submission_date,
    b.status
FROM vendor_sourcing.bids b
JOIN vendor_sourcing.tenders t ON t.tender_id = b.tender_id
WHERE b.bid_id = @bidId AND b.vendor_id = @vendorId;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("bidId", NpgsqlDbType.Uuid, bidId);
            cmd.Parameters.AddWithValue("vendorId", NpgsqlDbType.Uuid, vendorId.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound();
            }

            var result = new BidDetails(
                reader.GetGuid(reader.GetOrdinal("bid_id")),
                reader.GetGuid(reader.GetOrdinal("tender_id")),
                reader.GetString(reader.GetOrdinal("tender_title")),
                reader.GetGuid(reader.GetOrdinal("vendor_id")),
                reader.GetFieldValue<decimal>(reader.GetOrdinal("bid_amount")),
                reader.GetString(reader.GetOrdinal("technical_proposal_url")),
                reader.GetInt32(reader.GetOrdinal("validity_period_days")),
                reader.GetDateTime(reader.GetOrdinal("submission_date")),
                reader.GetString(reader.GetOrdinal("status")));

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bid {BidId} for vendor {VendorId}.", bidId, vendorId);
            return Problem("Internal server error retrieving bid.");
        }
    }

    [Authorize]
    [HttpGet("bids/{bidId:guid}/proposal-file")]
    public async Task<IActionResult> DownloadBidProposal(Guid bidId, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsAuthorizedVendor(vendorId.Value))
        {
            return Forbid();
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT b.technical_proposal_url
FROM vendor_sourcing.bids b
WHERE b.bid_id = @bidId AND b.vendor_id = @vendorId;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("bidId", NpgsqlDbType.Uuid, bidId);
            cmd.Parameters.AddWithValue("vendorId", NpgsqlDbType.Uuid, vendorId.Value);

            var proposalUrl = (string?)await cmd.ExecuteScalarAsync(ct);
            if (string.IsNullOrWhiteSpace(proposalUrl))
            {
                return NotFound(new { message = "No technical proposal file attached." });
            }

            if (!proposalUrl.StartsWith("uploads/bids/", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Technical proposal is stored as text, not a file." });
            }

            var relativePath = proposalUrl.Replace("/", Path.DirectorySeparatorChar.ToString());
            var filePath = Path.Combine(_environment.ContentRootPath, relativePath);
            var fullPath = Path.GetFullPath(filePath);
            var uploadsRoot = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "uploads", "bids"));

            if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "Technical proposal file not found." });
            }

            var provider = new FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(fullPath, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            return PhysicalFile(fullPath, contentType, Path.GetFileName(fullPath), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading technical proposal for bid {BidId} and vendor {VendorId}.", bidId, vendorId);
            return Problem("Internal server error downloading technical proposal.");
        }
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);

        var results = new List<T>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(map(reader));
        }

        return results;
    }

    private static BidSubmissionResult MapBidSubmissionResult(NpgsqlDataReader reader)
    {
        return new BidSubmissionResult(
            reader.GetGuid(reader.GetOrdinal("bid_id")),
            reader.GetGuid(reader.GetOrdinal("tender_id")),
            reader.GetGuid(reader.GetOrdinal("vendor_id")));
    }

    private static SubmittedBid MapSubmittedBid(NpgsqlDataReader reader)
    {
        return new SubmittedBid(
            reader.GetGuid(reader.GetOrdinal("bid_id")),
            reader.GetGuid(reader.GetOrdinal("tender_id")),
            reader.GetGuid(reader.GetOrdinal("vendor_id")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("bid_amount")),
            reader.GetString(reader.GetOrdinal("technical_proposal_url")),
            reader.GetInt32(reader.GetOrdinal("validity_period_days")),
            reader.GetDateTime(reader.GetOrdinal("submission_date")),
            reader.GetString(reader.GetOrdinal("status")));
    }

    private bool IsAuthorizedVendor(Guid vendorId)
    {
        var tokenVendorId = GetVendorIdFromClaims();
        if (!tokenVendorId.HasValue)
        {
            return false;
        }

        var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        return tokenVendorId.Value == vendorId &&
               string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase);
    }

    private Guid? GetVendorIdFromClaims()
    {
        var subject = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out var tokenVendorId) ? tokenVendorId : null;
    }
}
