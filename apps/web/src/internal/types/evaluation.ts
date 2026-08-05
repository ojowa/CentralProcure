export interface EvaluationReportItem {
    ReportId: string;
    ReportCode: string;
    TenderId: string;
    TenderTitle: string;
    CommitteeLead: string;
    Recommendation: string;
    ScoreSummary: string;
    Status: string;
    SubmittedAt: string;
    Notes: string;
}

export interface AssignedTenderItem {
    ReportCode: string;
    TenderId: string;
    TenderTitle: string;
    CommitteeLead: string;
    AssignmentRole: string;
    EvaluationStatus: string;
    TenderStatus: string;
    ProcurementCategory: string;
    SubmissionDeadline?: string | null;
    OpeningDate?: string | null;
    SubmittedAt: string;
    IsLocked?: boolean;
}

export type TenderEvaluationAssignmentRole =
  | 'technical_evaluator'
  | 'financial_evaluator'
  | 'evaluation_committee';

export interface TenderEvaluationAssignmentItem {
    TenderId: string;
    TenderTitle: string;
    TenderStatus: string;
    AssignmentRole: TenderEvaluationAssignmentRole;
    InternalUserId?: string | null;
    Email?: string | null;
    Username?: string | null;
    RoleName?: string | null;
    UnitName?: string | null;
    AssignedBy?: string | null;
    AssignedAt?: string | null;
}

export interface TenderEvaluationAssignmentUpdateRequest {
    AssignmentRole: TenderEvaluationAssignmentRole;
    InternalUserId?: string | null;
}