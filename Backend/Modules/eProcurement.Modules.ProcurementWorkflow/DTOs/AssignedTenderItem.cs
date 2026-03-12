namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record AssignedTenderItem(
    string ReportCode,
    Guid TenderId,
    string TenderTitle,
    string CommitteeLead,
    string EvaluationStatus,
    string TenderStatus,
    string ProcurementCategory,
    DateTime? SubmissionDeadline,
    DateTime? OpeningDate,
    DateTime SubmittedAt,
    bool IsLocked);
