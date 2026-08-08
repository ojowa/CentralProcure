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

export interface WorkflowAuthority {
    IsEditable: boolean;
    CanEdit: boolean;
    CanDelete: boolean;
    CanRoute: boolean;
    CanFileComplaint: boolean;
    AllowedActionKeys: string[];
    CurrentStageKey?: string | null;
    CurrentStageTitle?: string | null;
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
    Authority?: WorkflowAuthority | null;
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
    Display?: {
        CurrentStageKey: string;
        CurrentStageTitle: string;
        CurrentPhaseKey: string;
        CurrentPhaseLabel: string;
        Phases: Array<{
            PhaseKey: string;
            PhaseLabel: string;
            Sequence: number;
            Color: string;
            Status: string;
        }>;
    } | null;
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
