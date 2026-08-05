export interface BudgetAvailabilityResponse {
    AppropriationId: string;
    AppropriationCode: string;
    TotalAmount: number;
    ReleasedTotal: number;
    CommittedTotal: number;
    PaidTotal: number;
    UnreleasedBalance: number;
    AvailableForCommitment: number;
    OutstandingCommitments: number;
}

export interface BudgetSummaryResponse {
    Appropriated: number;
    Released: number;
    Committed: number;
    Spent: number;
    Available: number;
}

export interface BudgetDashboardRiskItem {
    PlanId: string;
    PlanTitle: string;
    Department: string;
    BudgetCode: string;
    FiscalYear: number;
    RequestedAmount: number;
    Available: number;
    Variance: number;
}

export interface BudgetDashboardResponse {
    Appropriated: number;
    Released: number;
    Committed: number;
    Spent: number;
    Available: number;
    QueueCount: number;
    AwaitingBudgetReviewCount: number;
    OnHoldCount: number;
    ReadyForApprovalCount: number;
    AtRiskCount: number;
    TopRisks: BudgetDashboardRiskItem[];
}

export interface BudgetConfirmationQueueItem {
    PlanId: string;
    PlanTitle: string;
    Department: string;
    FiscalYear: number;
    PlanStatus: string;
    CurrentStageKey: string;
    CurrentStageTitle: string;
    WorkflowStatus?: string | null;
    TotalBudget: number;
    RequestedAmount: number;
    Appropriated: number;
    Released: number;
    Committed: number;
    Spent: number;
    Available: number;
    Variance: number;
    ItemCount: number;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BudgetConfirmationListResponse {
    Items: BudgetConfirmationQueueItem[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}

export interface BudgetPlanItemSummary {
    PlanItemId: string;
    ItemCode?: string | null;
    Description: string;
    BudgetCode: string;
    ProcurementType?: string | null;
    EstimatedAmount: number;
    Status: string;
    Notes?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BudgetPlanBudgetLine {
    BudgetCode: string;
    RequestedAmount: number;
    Appropriated: number;
    Released: number;
    Committed: number;
    Spent: number;
    Available: number;
    Variance: number;
    ItemCount: number;
}

export interface BudgetDecisionHistoryEntry {
    HistoryId: string;
    FromStageKey?: string | null;
    ToStageKey: string;
    ToStageTitle: string;
    StageStatus?: string | null;
    TransitionSource: string;
    TransitionReason?: string | null;
    Actor?: string | null;
    CreatedAt: string;
}

export interface BudgetConfirmationDetail {
    PlanId: string;
    PlanTitle: string;
    Department: string;
    FiscalYear: number;
    PlanStatus: string;
    CurrentStageKey: string;
    CurrentStageTitle: string;
    WorkflowStatus?: string | null;
    Notes?: string | null;
    TotalBudget: number;
    RequestedAmount: number;
    Appropriated: number;
    Released: number;
    Committed: number;
    Spent: number;
    Available: number;
    Variance: number;
    ItemCount: number;
    CreatedAt: string;
    UpdatedAt: string;
    BudgetLines: BudgetPlanBudgetLine[];
    PlanItems: BudgetPlanItemSummary[];
    History: BudgetDecisionHistoryEntry[];
}

export interface BudgetDecisionRequest {
    Decision: string;
    Note?: string | null;
}

export interface BudgetDecisionResponse {
    PlanId: string;
    Decision: string;
    Message: string;
    CurrentStageKey: string;
    CurrentStageTitle: string;
    WorkflowStatus?: string | null;
    PlanStatus: string;
}

export interface BudgetAppropriationCreateRequest {
    AppropriationCode: string;
    Description?: string | null;
    TotalAmount: number;
    FiscalYear: number;
}

export interface BudgetAppropriationResponse {
    AppropriationId: string;
    AppropriationCode: string;
    Description: string;
    TotalAmount: number;
    FiscalYear: number;
    Status: string;
    CreatedBy: string;
    CreatedAt: string;
}

export interface BudgetAppropriationListResponse {
    Items: BudgetAppropriationResponse[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}

export interface BudgetReleaseCreateRequest {
    AppropriationId: string;
    ReleaseCode: string;
    Description?: string | null;
    Amount: number;
}

export interface BudgetReleaseResponse {
    ReleaseId: string;
    AppropriationId: string;
    AppropriationCode?: string;
    ReleaseCode: string;
    Description: string;
    Amount: number;
    Status: string;
    CreatedBy: string;
    CreatedAt: string;
}

export interface BudgetReleaseListResponse {
    Items: BudgetReleaseResponse[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}

export interface BudgetCommitmentCreateRequest {
    ReleaseId: string;
    CommitmentCode: string;
    Description?: string | null;
    Amount: number;
    Beneficiary?: string | null;
}

export interface BudgetCommitmentResponse {
    CommitmentId: string;
    ReleaseId: string;
    ReleaseCode?: string;
    CommitmentCode: string;
    Description: string;
    Amount: number;
    Beneficiary: string;
    Status: string;
    CreatedBy: string;
    CreatedAt: string;
}

export interface BudgetCommitmentListResponse {
    Items: BudgetCommitmentResponse[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}

export interface ApprovalThresholdDetail {
    ThresholdId: string;
    ProcurementType?: string | null;
    MinAmount: number;
    MaxAmount?: number | null;
    ApprovalRoute: string;
    ApprovalAuthorityCode: string;
    ApprovalAuthorityLabel: string;
    RequiresCgisApproval: boolean;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    GovernanceBodyId?: string | null;
    GovernanceBodyName?: string | null;
    Status: string;
    Notes?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}