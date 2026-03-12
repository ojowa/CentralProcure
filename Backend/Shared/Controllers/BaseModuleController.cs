using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace eProcurement.Shared.Controllers
{
    public abstract class BaseModuleController : ControllerBase
    {
        protected readonly IConfiguration Config;
        protected readonly ILogger Logger;

        protected BaseModuleController(IConfiguration config, ILogger logger)
        {
            Config = config;
            Logger = logger;
        }

        protected string GetConnectionString() => Config.GetConnectionString("Primary") ?? string.Empty;

        protected static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
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

        protected static string? GetNullableString(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
        }

        protected static Guid? GetNullableGuid(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetGuid(ordinal);
        }

        protected static int? GetNullableInt(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetInt32(ordinal);
        }

        protected static decimal? GetNullableDecimal(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetDecimal(ordinal);
        }

        protected static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
        }
    }
}
