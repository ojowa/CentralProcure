import type {
  WorkflowRuntimeSnapshot,
  WorkflowRouteDecision,
  WorkflowGrantedAction,
  WorkflowRuntimeHistoryEntry
} from './workflow';

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
    TotalContracts: number;
    ActiveContracts: number;
    CompletedContracts: number;
    TotalInspections: number;
    CompletedInspections: number;
    TotalPayments: number;
    TotalPaid: number;
    TotalCloseouts: number;
    PendingCloseouts: number;
    RecentEvents?: AuditEventItem[];
}

export interface AuditHistoryItem {
    AuditId: string;
    EntityType: string;
    EntityId: string;
    Action: string;
    PerformedBy?: string | null;
    OldValues?: any;
    NewValues?: any;
    Notes?: string | null;
    CreatedAt: string;
}

export interface AuditHistoryListResponse {
    Items: AuditHistoryItem[];
    Page: number;
    PageSize: number;
    TotalCount: number;
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
