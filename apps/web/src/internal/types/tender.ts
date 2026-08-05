export interface TenderSummary {
    TenderId: string;
    Title: string;
    Description?: string | null;
    Category?: string;
    EstimatedValue?: number | null;
    Status: string;
    Department?: string;
    BudgetCode?: string;
    FiscalYear?: number;
    PublishedAt?: string | null;
    OpeningDate?: string | null;
    ClosingDate?: string | null;
    CreatedAt: string;
}
export interface TenderDetail extends TenderSummary {
    Requirements?: string | null;
    EligibilityCriteria?: string | null;
    EvaluationCriteria?: string | null;
    UpdatedAt?: string;
    CurrentStage?: string | null;
}

export interface CgisQueueItem {
    InstanceId: string;
    EntityType: string;
    EntityId: string;
    RecordTitle: string | null;
    Department: string | null;
    Amount: number | null;
    ApprovalRoute: string | null;
    ApprovalAuthorityLabel: string | null;
    Status: string | null;
    VendorName: string | null;
    CreatedAt: string;
    DaysPending: number;
}

export interface TendersBoardQueueItem {
    InstanceId: string;
    TenderId: string;
    TenderTitle: string;
    Department?: string | null;
    Amount?: number | null;
    ProcurementType?: string | null;
    ApprovalRoute?: string | null;
    ApprovalAuthorityLabel?: string | null;
    RequiresBpp: boolean;
    Status?: string | null;
    VendorName?: string | null;
    ReportCode?: string | null;
    Recommendation?: string | null;
    ScoreSummary?: string | null;
    ReportSubmittedAt?: string | null;
    CreatedAt: string;
    DaysPending: number;
}

export interface TenderListResponse {
    Items: TenderSummary[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}

export interface TenderCreateRequest {
    Title: string;
    Description: string;
    EstimatedValue?: number | null;
    Status?: string | null;
    ClosingDate?: string | null;
    Requirements?: string | null;
    EvaluationCriteria?: string | null;
    Category?: string | null;
    ProcurementType?: string | null;
    FundingSource?: string | null;
    ApprovalLevel?: string | null;
    UnitId?: string | null;
    DepartmentId?: string | null;
    ProjectId?: string | null;
}

export interface TenderUpdateRequest {
    Title?: string | null;
    Description?: string | null;
    Category?: string | null;
    Status?: string | null;
    Budget?: number | null;
    Department?: string | null;
    BudgetCode?: string | null;
    FiscalYear?: number | null;
    Specifications?: string | null;
    EligibilityCriteria?: string | null;
    EvaluationCriteria?: string | null;
    PublishDate?: string | null;
    OpeningDate?: string | null;
    ClosingDate?: string | null;
}

export interface TenderPublishRequest {
    PublishDate?: string | null;
    OpeningDate?: string | null;
    ClosingDate?: string | null;
}