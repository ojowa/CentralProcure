using Microsoft.AspNetCore.DataProtection;

namespace eProcurement.Shared.Security;

public sealed class InternalSessionActivityProtector
{
    private const string ProtectorPurpose = "CentralProcure.InternalSessionActivity.v1";

    private readonly IDataProtector _protector;

    public InternalSessionActivityProtector(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector(ProtectorPurpose);
    }

    public string Protect(Guid userId, DateTimeOffset activityAtUtc)
    {
        var payload = $"{userId:D}|{activityAtUtc.ToUnixTimeMilliseconds()}";
        return _protector.Protect(payload);
    }

    public bool TryUnprotect(string protectedValue, out Guid userId, out DateTimeOffset activityAtUtc)
    {
        userId = Guid.Empty;
        activityAtUtc = default;

        if (string.IsNullOrWhiteSpace(protectedValue))
        {
            return false;
        }

        try
        {
            var unprotected = _protector.Unprotect(protectedValue);
            var parts = unprotected.Split('|', 2, StringSplitOptions.TrimEntries);
            if (parts.Length != 2)
            {
                return false;
            }

            if (!Guid.TryParse(parts[0], out userId))
            {
                return false;
            }

            if (!long.TryParse(parts[1], out var activityAtUnixMs))
            {
                return false;
            }

            activityAtUtc = DateTimeOffset.FromUnixTimeMilliseconds(activityAtUnixMs);
            return true;
        }
        catch
        {
            userId = Guid.Empty;
            activityAtUtc = default;
            return false;
        }
    }
}
