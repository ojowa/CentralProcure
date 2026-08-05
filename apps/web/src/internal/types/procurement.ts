export interface ProcurementPlanSummary {
    PlanId: string;
    PlanTitle: string;
    Department: string;
    FiscalYear: number;
    Status: string;
    TotalBudget: number;
    CreatedAt: string;
    CurrentStageKey?: string | null;
    CurrentStageTitle?: string | null;
    YearlyAppId?: string | null;
    YearlyAppTitle?: string | null;
}

export interface ProcurementPlanDetail extends ProcurementPlanSummary {
    Notes?: string | null;
    SubmittedAt?: string | null;
    ApprovedAt?: string | null;
    UpdatedAt: string;
}

export interface ProcurementPlanItemDetail {
    PlanItemId: string;
    PlanId: string;
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

export interface ProcurementPlanCreateRequest {
    PlanTitle: string;
    Department: string;
    FiscalYear: number;
    TotalBudget: number;
    Notes?: string | null;
    Status?: string | null;
}

export interface ProcurementPlanUpdateRequest {
    PlanTitle?: string | null;
    Department?: string | null;
    FiscalYear?: number | null;
    Status?: string | null;
    TotalBudget?: number | null;
    Notes?: string | null;
    SubmittedAt?: string | null;
    ApprovedAt?: string | null;
}

export interface ProcurementPlanApprovalDecisionRequest {
    Decision: 'approve' | 'return' | 'reject';
    Note?: string | null;
}

export interface ProcurementPlanApprovalDecisionResponse {
    PlanId: string;
    Decision: string;
    Message: string;
    StageKey: string;
    StageTitle: string;
    WorkflowStatus: string;
    PlanStatus: string;
    ApprovedAt?: string | null;
}

export interface ProcurementInitiationResponse {
    PlanId: string;
    Message: string;
    StageKey: string;
    StageTitle: string;
    WorkflowStatus: string;
    ThresholdId?: string | null;
    ApprovalRoute?: string | null;
    ApprovalAuthorityCode?: string | null;
    ApprovalAuthorityLabel?: string | null;
    RequiresCgisApproval: boolean;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    GovernanceBodyId?: string | null;
    GovernanceBodyName?: string | null;
    Amount?: number | null;
    ProcurementType?: string | null;
    Notes?: string | null;
}

export interface ProcurementPlanListResponse {
    Items: ProcurementPlanSummary[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}