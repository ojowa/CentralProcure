namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record EvaluationReportItem(
    string ReportId,
    Guid TenderId,
    string TenderTitle,
    string CommitteeLead,
    string Recommendation,
    string ScoreSummary,
    string Status,
    DateTime SubmittedAt,
    string Notes
);
