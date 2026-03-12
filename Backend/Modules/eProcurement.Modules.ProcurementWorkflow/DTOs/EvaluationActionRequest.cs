namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public sealed class EvaluationActionRequest
{
    public string ActionType { get; set; } = string.Empty;
    public string? ReportCode { get; set; }
    public Guid TenderId { get; set; }
    public string? Notes { get; set; }
    public string? Reason { get; set; }
    public string? Justification { get; set; }
    public string? Recommendation { get; set; }
    public string? ThresholdNote { get; set; }
    public string? RequestedBy { get; set; }
}
