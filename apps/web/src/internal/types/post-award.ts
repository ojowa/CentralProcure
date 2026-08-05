export interface ContractAwardItem {
    AwardEntityId: string;
    AwardId: string;
    TenderTitle: string;
    VendorName: string;
    AwardValue: number;
    Status: string;
    AwardDate: string;
    ContractStart: string;
    ContractEnd: string;
    FundingSource: string;
    Notes: string;
}

export interface ContractSummary {
    ContractId: string;
    ContractCode: string;
    TenderTitle: string;
    VendorName: string;
    ContractValue: number;
    Status: string;
    StartDate: string;
    EndDate: string;
    Progress: number;
    ContractManager: string;
    Notes?: string | null;
}

export interface ContractManagementItem extends ContractSummary {}

export interface ContractMilestone {
    MilestoneId: string;
    ContractCode: string;
    MilestoneTitle: string;
    StatusAfter: string;
    ProgressAfter: number;
    Notes: string;
    ContractManager: string;
    RecordedBy: string;
    RecordedAt: string;
}

export interface ContractMilestoneItem extends ContractMilestone {}

export interface ContractMilestoneCreateRequest {
    MilestoneTitle: string;
    Status: string;
    Progress: number;
    Notes: string;
    ContractManager?: string;
    RecordedBy?: string;
}

export interface InspectionItem {
    InspectionId: string;
    InspectionCode: string;
    ContractCode: string;
    TenderTitle: string;
    VendorName: string;
    InspectorName: string | null;
    ScheduledDate: string;
    CompletedDate?: string | null;
    Outcome?: string | null;
    Location?: string | null;
    Notes?: string | null;
    Status: string;
    CreatedAt: string;
}

export interface InspectionUpdateRequest {
    InspectorName?: string | null;
    ScheduledDate?: string | null;
    CompletedDate?: string | null;
    Outcome?: string | null;
    Notes?: string | null;
    Status?: string | null;
}

export interface PaymentTrackingItem {
    ContractId: string;
    ContractCode: string;
    TenderTitle: string;
    VendorName: string;
    ContractValue: number;
    ContractStatus: string;
    ContractProgress: number;
    CurrentStageKey?: string | null;
    CurrentStageTitle?: string | null;
    WorkflowStatus?: string | null;
    InspectionCode?: string | null;
    InspectionStatus?: string | null;
    InspectionOutcome?: string | null;
    InspectionCompletedDate?: string | null;
    FinalAcceptanceCompleted: boolean;
    FinalPaymentRecorded: boolean;
    IsPaid: boolean;
    CloseoutEligible: boolean;
    PaymentStage: string;
    CloseoutId?: string | null;
    CloseoutReference?: string | null;
    CloseoutStatus?: string | null;
    ArchivedAt?: string | null;
}

export interface PaymentRecordRequest {
    ContractId: string;
    PaymentReference: string;
    PayeeName: string;
    Amount: number;
    PaymentDate?: string | null;
    PaymentMethod?: string | null;
    CloseoutEligible?: boolean | null;
    Notes?: string | null;
}

export interface PaymentRecordResponse {
    PaymentId: string;
    ContractId: string;
    PaymentReference: string;
    PayeeName: string;
    Amount: number;
    PaymentDate: string;
    PaymentMethod: string;
    CloseoutEligible: boolean;
    Status: string;
    CreatedAt: string;
}

export interface AuditCloseoutItem {
    CloseoutId: string;
    ContractCode: string;
    ContractTitle?: string | null;
    CloseoutCode: string;
    Description: string;
    Status: string;
    InitiatedBy?: string | null;
    InitiatedAt: string;
    CompletedAt?: string | null;
    ArchiveLocation?: string | null;
    FinalAcceptanceCompleted?: boolean;
    FinalPaymentCompleted?: boolean;
    ArchivedBy?: string | null;
    ArchivedAt?: string | null;
    CreatedAt: string;
}

export interface AuditCloseoutCreateRequest {
    ContractCode: string;
    CloseoutCode: string;
    Description?: string;
    ArchiveLocation?: string | null;
    FinalAcceptanceCompleted?: boolean;
    FinalPaymentCompleted?: boolean;
    ArchivedBy?: string | null;
}
