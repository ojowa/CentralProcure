export type RoleKey =
  | 'admin'
  | 'requisitioning_officer'
  | 'department_head'
  | 'comptroller_procurement'
  | 'procurement_manager'
  | 'planning_statistics_officer'
  | 'financial_unit_officer'
  | 'procurement_secretary'
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
  catalogActions?: string[];
  allowedRoles?: RoleKey[];
}

export type VendorApprovalStatus = 'Pending Approval' | 'Active' | 'Rejected';

export interface VendorApprovalSummary {
  VendorId: string;
  CompanyName: string;
  RegistrationNumber: string;
  TaxId: string;
  ContactPerson: string;
  PhoneNumber?: string | null;
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
    Username: string;
    FirstName: string;
    MiddleName: string;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
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
    Username: string;
    FirstName: string;
    MiddleName?: string;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
    Email: string;
    Password: string;
    Role: string;
}

// Response models
export interface InternalLoginResponse {
    Email: string;
    Status: string;
    Token?: string;
    Role?: RoleKey;
    InternalUserId?: string;
    ErrorMessage?: string;
}

export interface InternalRegistrationResponse {
    InternalUserId: string;
    Email: string;
    Role: string;
    UnitId?: string | null;
    UnitName?: string | null;
}

export interface InternalRoleRecord {
    RoleId: string;
    RoleName: string;
    Description?: string | null;
    IsActive: boolean;
}

export interface InternalUserProfile {
    InternalUserId: string;
    Email: string;
    Username: string;
    FirstName: string;
    MiddleName?: string | null;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
    UnitName: string;
    RoleName: string;
    Status: string;
    LastLogin?: string | null;
    CreatedAt: string;
}

export interface InternalUserProfileUpdateRequest {
    Username: string;
    FirstName: string;
    MiddleName?: string;
    Surname: string;
}

export interface InternalOrganizationalUnitRecord {
    UnitId: string;
    UnitName: string;
    UnitCode: string;
    UnitType: string;
    ParentUnitId?: string | null;
    ParentUnitName?: string | null;
    SortOrder: number;
    IsAssignable: boolean;
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
    CurrentStageKey?: string | null;
    CurrentStageTitle?: string | null;
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
    CurrentStage?: string | null;
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

export interface BudgetFilters {
  fiscalYear: string;
  department: string;
  stage: string;
  query: string;
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
    Total: number;
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
    FiscalYear: number;
    Department: string;
    BudgetCode: string;
    Amount: number;
    Status?: string | null;
    Notes?: string | null;
}

export interface BudgetAppropriationResponse {
    AppropriationId: string;
    FiscalYear: number;
    Department: string;
    BudgetCode: string;
    Amount: number;
    Status: string;
    Notes?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BudgetAppropriationListResponse {
    Items: BudgetAppropriationResponse[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface BudgetReleaseCreateRequest {
    AppropriationId: string;
    Amount: number;
    ReleaseDate?: string | null;
    Notes?: string | null;
}

export interface BudgetReleaseResponse {
    ReleaseId: string;
    AppropriationId: string;
    FiscalYear: number;
    Department: string;
    BudgetCode: string;
    AppropriationAmount: number;
    Amount: number;
    ReleaseDate: string;
    Notes?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BudgetReleaseListResponse {
    Items: BudgetReleaseResponse[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface BudgetCommitmentCreateRequest {
    AppropriationId: string;
    Amount: number;
    CommittedAt?: string | null;
}

export interface BudgetCommitmentResponse {
  CommitmentId: string;
  AppropriationId: string | null;
  RequisitionId: string | null;
  RequisitionTitle: string | null;
  RequisitionStatus: string | null;
  FiscalYear: number;
  Department: string;
  BudgetCode: string;
    AppropriationAmount: number;
    Amount: number;
    CommittedAt: string;
    Status: string;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BudgetCommitmentListResponse {
    Items: BudgetCommitmentResponse[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface BudgetRequisitionQueueItem {
    RequisitionId: string;
    Title: string;
    Department: string;
    BudgetCode?: string | null;
    AppItemId?: string | null;
    TotalEstimate: number;
    RequiredBy?: string | null;
    Status: string;
    CurrentStageKey: string;
    CurrentStageTitle: string;
    WorkflowStatus?: string | null;
    Available: number;
    Committed: number;
    Variance: number;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BudgetRequisitionListResponse {
    Items: BudgetRequisitionQueueItem[];
    Page: number;
    PageSize: number;
    Total: number;
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
    ApprovalAuthorityCode: string;
    ApprovalAuthorityLabel: string;
    RequiresCgisApproval: boolean;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    GovernanceBodyId?: string | null;
    GovernanceBodyName?: string | null;
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
    ApprovalAuthorityCode: string;
    ApprovalAuthorityLabel: string;
    RequiresCgisApproval: boolean;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    GovernanceBodyId?: string | null;
    GovernanceBodyName?: string | null;
    Status: string;
    Notes?: string | null;
    UpdatedAt?: string | null;
}

export interface WorkflowConfigurationRole {
    RoleName: string;
    Description?: string | null;
    IsActive: boolean;
}

export interface WorkflowConfigurationGovernanceBody {
    BodyId: string;
    BodyCode: string;
    BodyName: string;
    BodyType: string;
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
    GovernanceBodies: WorkflowConfigurationGovernanceBody[];
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
    ApprovalAuthorityCode: string;
    ApprovalAuthorityLabel: string;
    RequiresCgisApproval: boolean;
    RequiresBoard: boolean;
    RequiresBpp: boolean;
    GovernanceBodyId?: string | null;
    Status?: string | null;
    Notes?: string | null;
}

export interface WorkflowThresholdUpdateRequest {
    ProcurementType?: string | null;
    MinAmount?: number | null;
    MaxAmount?: number | null;
    ApprovalRoute?: string | null;
    ApprovalAuthorityCode?: string | null;
    ApprovalAuthorityLabel?: string | null;
    RequiresCgisApproval?: boolean | null;
    RequiresBoard?: boolean | null;
    RequiresBpp?: boolean | null;
    GovernanceBodyId?: string | null;
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

export interface AdministrativeReviewSummary {
    ComplaintId: string;
    ComplaintReference: string;
    EntityType: string;
    EntityId: string;
    StageKeyAtFiling: string;
    Status: string;
    Subject: string;
    FiledBy?: string | null;
    AssignedTo?: string | null;
    FiledAt: string;
    ResolutionOutcome?: string | null;
    ResolvedAt?: string | null;
    ParentRecordTitle?: string | null;
    ParentCurrentStageKey?: string | null;
    ParentCurrentStageTitle?: string | null;
    ParentCurrentStatus?: string | null;
}

export interface AdministrativeReviewDetail extends AdministrativeReviewSummary {
    Summary: string;
    Details: string;
    ComplaintChannel?: string | null;
    RequestedRemedy?: string | null;
    ReviewedBy?: string | null;
    ResolutionStageKey?: string | null;
    ResolutionNotes?: string | null;
    ReviewedAt?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface AdministrativeReviewCreateRequest {
    EntityType: string;
    EntityId: string;
    Subject: string;
    Summary: string;
    Details: string;
    ComplaintChannel?: string | null;
    RequestedRemedy?: string | null;
    FiledBy?: string | null;
    AssignedTo?: string | null;
}

export interface AdministrativeReviewUpdateRequest {
    Status?: string | null;
    AssignedTo?: string | null;
    ReviewedBy?: string | null;
    ResolutionOutcome?: string | null;
    ResolutionStageKey?: string | null;
    ResolutionNotes?: string | null;
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
    UnitId?: string | null;
    CommitteePlanId?: string | null;
    CommitteePlanTitle?: string | null;
    AppItemId?: string | null;
    AppItemDescription?: string | null;
    FinalCommitteeDecision?: string | null;
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
    AppItemId?: string | null;
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
    UnitId?: string | null;
    ProcurementType?: string | null;
    Priority?: string | null;
    FundingSource?: string | null;
    BudgetCode?: string | null;
    AppItemId?: string | null;
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
    UnitId?: string | null;
    ProcurementType?: string | null;
    Priority?: string | null;
    FundingSource?: string | null;
    BudgetCode?: string | null;
    AppItemId?: string | null;
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

export interface InspectionUpdateRequest {
    Status?: string | null;
    Outcome?: string | null;
    CompletedDate?: string | null;
    InspectorName?: string | null;
    Location?: string | null;
    Notes?: string | null;
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
    ContractCode: string;
    Amount: number;
    Notes?: string | null;
}

export interface PaymentRecordResponse {
    PaymentId: string;
    PaymentReference: string;
    ContractCode: string;
    Amount: number;
    Status: string;
    PaymentDate: string;
}

export interface AuditEventItem {
    HistoryId: string;
    EntityType: string;
    EntityId: string;
    FromStageKey?: string | null;
    ToStageKey: string;
    ToStageTitle: string;
    StageStatus?: string | null;
    TransitionSource: string;
    Actor?: string | null;
    CreatedAt: string;
}

export interface AuditSummaryResponse {
    ActiveWorkflowItems: number;
    AdministrativeReviewsOpen: number;
    CloseoutsArchived: number;
    RecentTransitions: number;
    RecentEvents: AuditEventItem[];
}

export interface AuditHistoryItem {
    HistoryId: string;
    EntityType: string;
    EntityId: string;
    RecordTitle?: string | null;
    CurrentStageKey?: string | null;
    CurrentStageTitle?: string | null;
    FromStageKey?: string | null;
    FromStageTitle?: string | null;
    ToStageKey: string;
    ToStageTitle: string;
    StageStatus?: string | null;
    TransitionSource: string;
    TransitionReason?: string | null;
    Actor?: string | null;
    CreatedAt: string;
}

export interface PlanningCommitteeMemberStatus {
    RoleKey: string;
    StatusLabel: string;
    Decision?: string | null;
    UpdatedBy?: string | null;
    UpdatedAt: string;
}

export interface AuditHistoryListResponse {
    Items: AuditHistoryItem[];
    Page: number;
    PageSize: number;
    Total: number;
}

export interface WorkflowGrantedAction {
    ActionKey: string;
    StageKey: string;
    DisplayName: string;
    TaskDescription: string;
}

export interface WorkflowActionSnapshotResponse {
    EntityType: string;
    EntityId: string;
    CurrentStageKey: string;
    CurrentStageTitle: string;
    RoleKey: string;
    Actions: WorkflowGrantedAction[];
    RouteDecision?: WorkflowRouteDecision | null;
}

export interface WorkflowRuntimeTransitionSummary {
    ToStageKey: string;
    StageTitle: string;
    TransitionCondition: string;
}

export interface WorkflowRuntimeSnapshot {
    InstanceId: string;
    EntityType: string;
    EntityId: string;
    CurrentStageKey: string;
    CurrentStageTitle: string;
    CurrentPhaseKey: string;
    CurrentStatus?: string | null;
    RecordTitle?: string | null;
    ParentEntityType?: string | null;
    ParentEntityId?: string | null;
    Amount?: number | null;
    ProcurementType?: string | null;
    ThresholdId?: string | null;
    LastTransitionReason?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
    NextTransitions: WorkflowRuntimeTransitionSummary[];
}

export interface WorkflowRouteDecision {
    EntityType: string;
    EntityId: string;
    CurrentStageKey: string;
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

export interface WorkflowRuntimeHistoryEntry {
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

export interface AuditTransitionDiagnostic {
    RequestedStageKey: string;
    RequestedStageTitle: string;
    TransitionCondition: string;
    IsAllowed: boolean;
    Message?: string | null;
}

export interface AuditWorkflowDiagnosticsResponse {
    Runtime: WorkflowRuntimeSnapshot;
    RouteDecision?: WorkflowRouteDecision | null;
    RoleKey?: string | null;
    GrantedActions: WorkflowGrantedAction[];
    RecentHistory: WorkflowRuntimeHistoryEntry[];
    TransitionChecks: AuditTransitionDiagnostic[];
}

export interface AuditCloseoutItem {
    CloseoutId: string;
    CloseoutReference: string;
    EntityType: string;
    EntityId: string;
    Status: string;
    RecordTitle?: string | null;
    Summary: string;
    ArchiveLocation?: string | null;
    FinalAcceptanceCompleted: boolean;
    FinalPaymentCompleted: boolean;
    ArchivedBy?: string | null;
    ArchivedAt?: string | null;
    CreatedAt: string;
}

export interface AuditCloseoutCreateRequest {
    EntityType: string;
    EntityId: string;
    Summary: string;
    ArchiveLocation?: string | null;
    FinalAcceptanceCompleted: boolean;
    FinalPaymentCompleted: boolean;
    ArchivedBy?: string | null;
}

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

