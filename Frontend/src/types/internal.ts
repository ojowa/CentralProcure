export type RoleKey =
  | 'admin'
  | 'requisitioning_officer'
  | 'department_head'
  | 'procurement_officer'
  | 'procurement_manager'
  | 'planning_statistics_officer'
  | 'financial_unit_officer'
  | 'legal_reviewer'
  | 'technical_evaluator'
  | 'financial_evaluator'
  | 'evaluation_committee'
  | 'tenders_board'
  | 'tenders_board_secretary'
  | 'accounting_officer'
  | 'bpp_liaison'
  | 'bpp_reviewer'
  | 'complaints_review_officer'
  | 'contract_manager'
  | 'inspection_officer'
  | 'payment_officer'
  | 'audit_oversight'
  | 'ict_admin';

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
}

export interface InternalModule {
  id: string;
  title: string;
  section: string;
  description: string;
  microservice: string;
  controlPurpose: string;
  actions?: string[];
  allowedRoles?: RoleKey[];
}

export type VendorApprovalStatus = 'Pending Approval' | 'Active' | 'Rejected';

export interface VendorApprovalSummary {
  VendorId: string;
  CompanyName: string;
  RegistrationNumber: string;
  TaxId: string;
  ContactPerson: string;
  Email: string;
  RegistrationDate: string;
  VendorStatus: string;
  IsActive: boolean;
  ComplianceDocumentsCount: number;
  ApprovedDocumentsCount: number;
  PendingDocumentsCount: number;
  RejectedDocumentsCount: number;
  LastComplianceUpdateAt?: string | null;
}

export interface VendorComplianceReviewItem {
  DocumentId: string;
  DocumentType: string;
  VerificationStatus: string;
  ExpiryDate?: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  VerifiedBy?: string | null;
  VerifiedAt?: string | null;
  FileUrl: string;
}

export interface VendorApprovalDetail extends VendorApprovalSummary {
  CompanyAddress: string;
  LastLogin?: string | null;
  ComplianceDocuments: VendorComplianceReviewItem[];
}

export interface VendorApprovalDecisionRequest {
  Decision: VendorApprovalStatus;
  Notes?: string | null;
}

// Frontend data models for forms
export interface InternalLoginData {
    Email: string;
    Password: string;
}

export interface InternalRegistrationData {
    Email: string;
    Password: string;
    ConfirmPassword: string; // For frontend validation
    Role: string;
}

// Backend request models (hashed password)
export interface InternalLoginRequestBackend {
    Email: string;
    Password: string;
}

export interface InternalRegistrationRequestBackend {
    Email: string;
    Password: string;
    Role: string;
}

// Response models
export interface InternalLoginResponse {
    Email: string;
    Status: string;
    Token: string; // Assuming a token is returned on successful login
    Role?: RoleKey;
    InternalUserId?: string;
    ErrorMessage?: string;
}

export interface InternalRegistrationResponse {
    InternalUserId: string;
    Email: string;
    Role: string;
}

export interface InternalRoleRecord {
    RoleId: string;
    RoleName: string;
    Description?: string | null;
    IsActive: boolean;
}

export interface ProcurementPlanSummary {
    PlanId: string;
    PlanTitle: string;
    Department: string;
    FiscalYear: number;
    Status: string;
    TotalBudget: number;
    CreatedAt: string;
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

export interface ProcurementPlanListResponse {
    Items: ProcurementPlanSummary[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface TenderSummary {
    TenderId: string;
    Title: string;
    Category: string;
    Status: string;
    Budget?: number | null;
    Department?: string | null;
    BudgetCode?: string | null;
    FiscalYear?: number | null;
    PublishDate?: string | null;
    OpeningDate?: string | null;
    ClosingDate?: string | null;
    CreatedAt: string;
}

export interface TenderDetail extends TenderSummary {
    Description: string;
    Specifications?: string | null;
    EligibilityCriteria?: string | null;
    EvaluationCriteria?: string | null;
    UpdatedAt: string;
}

export interface TenderListResponse {
    Items: TenderSummary[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface TenderCreateRequest {
    Title: string;
    Description: string;
    Category: string;
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

export interface BudgetAvailabilityResponse {
    Available: number;
}

export interface BudgetSummaryResponse {
    Appropriated: number;
    Released: number;
    Committed: number;
    Spent: number;
    Available: number;
}

export interface ApprovalThresholdDetail {
    ThresholdId: string;
    ProcurementType?: string | null;
    MinAmount: number;
    MaxAmount?: number | null;
    ApprovalRoute: string;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    Status: string;
    Notes?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface WorkflowBlueprintPhase {
    Id: string;
    Title: string;
    Description: string;
    Sequence: number;
}

export interface WorkflowBlueprintState {
    Id: string;
    PhaseId: string;
    Title: string;
    Description: string;
    Sequence: number;
    IsDecisionGate: boolean;
    IsStart: boolean;
    IsTerminal: boolean;
    PpaReference: string;
    PrimaryOwners: string[];
    Actions: string[];
}

export interface WorkflowBlueprintTransition {
    FromStateId: string;
    ToStateId: string;
    Condition: string;
}

export interface WorkflowBlueprintRoleTask {
    Role: string;
    DisplayName: string;
    StateId: string;
    Task: string;
    ExpectedOutcome: string;
}

export interface WorkflowBlueprintThreshold {
    ProcurementType: string;
    MinAmount: number;
    MaxAmount?: number | null;
    ApprovalRoute: string;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    Notes: string;
}

export interface WorkflowBlueprint {
    Title: string;
    Summary: string;
    ThresholdSource: string;
    CurrentRole?: string | null;
    DatabaseTables: string[];
    Phases: WorkflowBlueprintPhase[];
    States: WorkflowBlueprintState[];
    Transitions: WorkflowBlueprintTransition[];
    RoleTasks: WorkflowBlueprintRoleTask[];
    Thresholds: WorkflowBlueprintThreshold[];
}

export interface WorkflowConfigurationStage {
    StageKey: string;
    PhaseKey: string;
    StageTitle: string;
    StageDescription: string;
    SequenceNo: number;
    IsDecisionGate: boolean;
    IsStart: boolean;
    IsTerminal: boolean;
    PrimaryOwnerRole: string;
    PpaReference?: string | null;
    UpdatedAt?: string | null;
}

export interface WorkflowConfigurationTransition {
    TransitionId: string;
    FromStageKey: string;
    ToStageKey: string;
    TransitionCondition: string;
    CreatedAt?: string | null;
}

export interface WorkflowConfigurationRoleTask {
    RoleTaskId: string;
    RoleKey: string;
    DisplayName: string;
    StageKey: string;
    TaskDescription: string;
    ExpectedOutcome: string;
    CreatedAt?: string | null;
}

export interface WorkflowConfigurationThreshold {
    ThresholdId: string;
    ProcurementType?: string | null;
    MinAmount: number;
    MaxAmount?: number | null;
    ApprovalRoute: string;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    Status: string;
    Notes?: string | null;
    UpdatedAt?: string | null;
}

export interface WorkflowConfigurationRole {
    RoleName: string;
    Description?: string | null;
    IsActive: boolean;
}

export interface WorkflowConfiguration {
    Title: string;
    Summary: string;
    Stages: WorkflowConfigurationStage[];
    Transitions: WorkflowConfigurationTransition[];
    RoleTasks: WorkflowConfigurationRoleTask[];
    Thresholds: WorkflowConfigurationThreshold[];
    Roles: WorkflowConfigurationRole[];
}

export interface WorkflowStageUpdateRequest {
    PhaseKey?: string | null;
    StageTitle?: string | null;
    StageDescription?: string | null;
    SequenceNo?: number | null;
    IsDecisionGate?: boolean | null;
    IsStart?: boolean | null;
    IsTerminal?: boolean | null;
    PrimaryOwnerRole?: string | null;
    PpaReference?: string | null;
}

export interface WorkflowTransitionCreateRequest {
    FromStageKey: string;
    ToStageKey: string;
    TransitionCondition: string;
}

export interface WorkflowRoleTaskCreateRequest {
    RoleKey: string;
    DisplayName: string;
    StageKey: string;
    TaskDescription: string;
    ExpectedOutcome: string;
}

export interface WorkflowThresholdCreateRequest {
    ProcurementType?: string | null;
    MinAmount: number;
    MaxAmount?: number | null;
    ApprovalRoute: string;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    Status?: string | null;
    Notes?: string | null;
}

export interface WorkflowThresholdUpdateRequest {
    ProcurementType?: string | null;
    MinAmount?: number | null;
    MaxAmount?: number | null;
    ApprovalRoute?: string | null;
    RequiresBoard?: boolean | null;
    RequiresBpp?: boolean | null;
    Status?: string | null;
    Notes?: string | null;
}

export interface BidOpeningSessionSummary {
    SessionId: string;
    TenderId: string;
    SessionTitle: string;
    Location?: string | null;
    ScheduledAt: string;
    Status: string;
    OpenedAt?: string | null;
    ClosedAt?: string | null;
    CreatedAt: string;
}

export interface BidOpeningSessionDetail extends BidOpeningSessionSummary {
    Notes?: string | null;
    UpdatedAt: string;
}

export interface BidOpeningSessionListResponse {
    Items: BidOpeningSessionSummary[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface BidOpeningSessionCreateRequest {
    TenderId: string;
    SessionTitle: string;
    Location?: string | null;
    ScheduledAt: string;
    Status?: string | null;
    OpenedAt?: string | null;
    ClosedAt?: string | null;
    Notes?: string | null;
}

export interface BidOpeningSessionUpdateRequest {
    SessionTitle?: string | null;
    Location?: string | null;
    ScheduledAt?: string | null;
    Status?: string | null;
    OpenedAt?: string | null;
    ClosedAt?: string | null;
    Notes?: string | null;
}

export interface BppNoObjectionDetail {
    NoObjectionId: string;
    RequisitionId?: string | null;
    TenderId?: string | null;
    Amount: number;
    ProcurementType?: string | null;
    Status: string;
    RequestedBy?: string | null;
    RequestedAt: string;
    DecisionBy?: string | null;
    DecisionAt?: string | null;
    DecisionNotes?: string | null;
    ReferenceCode?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BppNoObjectionCreateRequest {
    RequisitionId?: string | null;
    TenderId?: string | null;
    Amount: number;
    ProcurementType?: string | null;
    Status?: string | null;
    RequestedBy?: string | null;
    RequestedAt?: string | null;
    ReferenceCode?: string | null;
}

export interface BppNoObjectionUpdateRequest {
    Status?: string | null;
    DecisionBy?: string | null;
    DecisionAt?: string | null;
    DecisionNotes?: string | null;
    ReferenceCode?: string | null;
}

export interface RequisitionLineItem {
    ItemId?: string | null;
    Description: string;
    Unit: string;
    Quantity: number;
    UnitCost: number;
}

export interface RequisitionSummary {
    RequisitionId: string;
    Title: string;
    Department: string;
    Status: string;
    Priority?: string | null;
    FundingSource?: string | null;
    TotalEstimate: number;
    RequiredBy?: string | null;
    CreatedAt: string;
}

export interface RequisitionDetail extends RequisitionSummary {
    ProcurementType?: string | null;
    BudgetCode?: string | null;
    ProjectCode?: string | null;
    DeliveryLocation?: string | null;
    Justification?: string | null;
    RiskNotes?: string | null;
    LineItems: RequisitionLineItem[];
    UpdatedAt: string;
    CurrentStage?: string | null;
}

export interface RequisitionCreateRequest {
    Title: string;
    Department: string;
    ProcurementType?: string | null;
    Priority?: string | null;
    FundingSource?: string | null;
    BudgetCode?: string | null;
    ProjectCode?: string | null;
    RequiredBy?: string | null;
    DeliveryLocation?: string | null;
    Justification?: string | null;
    RiskNotes?: string | null;
    Status?: string | null;
    LineItems: RequisitionLineItem[];
}

export interface RequisitionUpdateRequest {
    Title?: string | null;
    Department?: string | null;
    ProcurementType?: string | null;
    Priority?: string | null;
    FundingSource?: string | null;
    BudgetCode?: string | null;
    ProjectCode?: string | null;
    RequiredBy?: string | null;
    DeliveryLocation?: string | null;
    Justification?: string | null;
    RiskNotes?: string | null;
    Status?: string | null;
    LineItems?: RequisitionLineItem[] | null;
}

export interface ContractAwardItem {
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

export interface ContractManagementItem {
    ContractId: string;
    TenderTitle: string;
    VendorName: string;
    ContractValue: number;
    Status: string;
    StartDate: string;
    EndDate: string;
    Progress: number;
    ContractManager: string;
    Notes: string;
}

export interface ContractMilestoneItem {
    MilestoneId: string;
    ContractId: string;
    MilestoneTitle: string;
    Status: string;
    Progress: number;
    Notes: string;
    ContractManager: string;
    RecordedBy: string;
    RecordedAt: string;
}

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
    ContractCode: string;
    TenderTitle: string;
    VendorName: string;
    Status: string;
    ScheduledDate: string;
    CompletedDate?: string | null;
    InspectorName: string;
    Outcome?: string | null;
    Location: string;
    Notes?: string | null;
}

export interface EvaluationReportItem {
    ReportId: string;
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
    EvaluationStatus: string;
    TenderStatus: string;
    ProcurementCategory: string;
    SubmissionDeadline?: string | null;
    OpeningDate?: string | null;
    SubmittedAt: string;
    IsLocked?: boolean;
}

export interface RequisitionListResponse {
    Items: RequisitionSummary[];
    Page: number;
    PageSize: number;
    Total: number;
}
