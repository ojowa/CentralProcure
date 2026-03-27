namespace eProcurement.Modules.Governance.DTOs;

public record MonitoringStatusItem(
    string Key,
    string Label,
    string Status,
    string Summary,
    int Count);

public record MonitoringAlertItem(
    string Severity,
    string Source,
    string Title,
    string Detail,
    int AffectedCount,
    int? OldestAgeDays);

public record MonitoringStageLoadItem(
    string StageKey,
    string StageTitle,
    int ActiveCount);

public record MonitoringOverviewResponse(
    DateTime GeneratedAtUtc,
    int TotalAlerts,
    int CriticalAlerts,
    int WarningAlerts,
    IReadOnlyList<MonitoringStatusItem> Services,
    IReadOnlyList<MonitoringStatusItem> Integrations,
    IReadOnlyList<MonitoringAlertItem> Alerts,
    IReadOnlyList<MonitoringStageLoadItem> StageLoad);
