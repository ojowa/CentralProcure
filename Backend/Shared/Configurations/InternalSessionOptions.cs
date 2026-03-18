namespace eProcurement.Shared.Configurations;

public sealed class InternalSessionOptions
{
    public const string SectionName = "InternalSession";
    public const string DefaultActivityCookieName = "internalSessionActivity";

    public int IdleTimeoutMinutes { get; set; } = 15;
    public string ActivityCookieName { get; set; } = DefaultActivityCookieName;
}
