export interface WorkflowThresholdResolution {
  threshold_id: string;
  approval_route: string;
  approval_authority_code: string;
  approval_authority_label: string;
  requires_cgis_approval: boolean;
  requires_board: boolean;
  requires_bpp: boolean;
  governance_body_id: string | null;
  governance_body_name: string | null;
  min_amount: number;
  max_amount: number | null;
  notes: string | null;
}

export interface WorkflowTransitionCheckResult {
  is_allowed: boolean;
  current_stage_key: string | null;
  current_stage_title: string | null;
  requested_stage_key: string;
  requested_stage_title: string | null;
  message: string | null;
}

export interface WorkflowRouteDecision {
  entity_type: string;
  entity_id: string;
  current_stage_key: string;
  threshold_id: string | null;
  approval_route: string | null;
  approval_authority_code: string | null;
  approval_authority_label: string | null;
  requires_cgis_approval: boolean;
  requires_board: boolean;
  requires_bpp: boolean;
  governance_body_id: string | null;
  governance_body_name: string | null;
  amount: number | null;
  procurement_type: string | null;
  notes: string | null;
}

export interface WorkflowRuntimeSyncRequest {
  entity_type: string;
  entity_id: string;
  stage_key: string;
  status: string | null;
  record_title: string | null;
  parent_entity_type: string | null;
  parent_entity_id: string | null;
  amount: number | null;
  procurement_type: string | null;
  threshold_id: string | null;
  transition_reason: string | null;
  actor: string | null;
  transition_source: string;
}

export interface WorkflowRuntimeSnapshot {
  instance_id: string;
  entity_type: string;
  entity_id: string;
  current_stage_key: string;
  current_stage_title: string;
  current_phase_key: string;
  current_status: string | null;
  record_title: string | null;
  parent_entity_type: string | null;
  parent_entity_id: string | null;
  amount: number | null;
  procurement_type: string | null;
  threshold_id: string | null;
  last_transition_reason: string | null;
  created_at: string;
  updated_at: string;
  next_transitions: WorkflowRuntimeTransitionSummary[];
}

export interface WorkflowRuntimeTransitionSummary {
  to_stage_key: string;
  stage_title: string;
  transition_condition: string;
}

export interface WorkflowRuntimeHistoryEntry {
  history_id: string;
  from_stage_key: string | null;
  to_stage_key: string;
  to_stage_title: string;
  stage_status: string | null;
  transition_source: string;
  transition_reason: string | null;
  actor: string | null;
  created_at: string;
}

export interface CgisQueueItem {
  instance_id: string;
  entity_type: string;
  entity_id: string;
  record_title: string | null;
  department: string;
  amount: number | null;
  approval_route: string | null;
  approval_authority_label: string | null;
  status: string | null;
  vendor_name: string | null;
  created_at: string;
  days_pending: number;
}

export interface CgisDocument {
  document_type: string;
  file_name: string | null;
  file_url: string | null;
  status: string | null;
  updated_at: string | null;
}

export interface WorkflowAuthority {
  can_edit: boolean;
  can_delete: boolean;
  can_route: boolean;
  can_file_complaint: boolean;
  actions: string[];
}

export interface WorkflowPhaseDisplayItem {
  phase_key: string;
  phase_label: string;
  sequence: number;
  color: string;
  status: string;
}

export interface WorkflowRuntimeDisplay {
  current_stage_key: string;
  current_stage_title: string;
  current_phase_key: string;
  current_phase_label: string;
  phases: WorkflowPhaseDisplayItem[];
}

export interface WorkflowGrantedAction {
  action_key: string;
  stage_key: string;
  display_name: string;
  task_description: string;
}

export interface WorkflowActionGrantSnapshot {
  entity_type: string;
  entity_id: string;
  current_stage_key: string;
  current_stage_title: string;
  role_key: string;
  actions: WorkflowGrantedAction[];
  authority: WorkflowAuthority;
}

export interface WorkflowPhaseResult {
  phase_key: string;
  title: string;
  description: string;
  sequence: number;
}

export interface WorkflowStateResult {
  stage_key: string;
  phase_key: string;
  title: string;
  description: string;
  sequence: number;
  is_terminal: boolean;
  requires_approval: boolean;
  requires_external_review: boolean;
  statute_reference: string;
  assigned_roles: string[];
  action_keys: string[];
}

export interface WorkflowTransitionResult {
  from_stage_key: string;
  to_stage_key: string;
  condition: string;
}

export interface WorkflowRoleTaskResult {
  role_key: string;
  role_label: string;
  stage_key: string;
  task_description: string;
  completion_summary: string;
}

export interface WorkflowBlueprintResult {
  title: string;
  description: string;
  threshold_source: string;
  current_role: string | null;
  database_tables: string[];
  phases: WorkflowPhaseResult[];
  states: WorkflowStateResult[];
  transitions: WorkflowTransitionResult[];
  role_tasks: WorkflowRoleTaskResult[];
  thresholds: WorkflowThresholdBandResult[];
}

export interface WorkflowThresholdBandResult {
  procurement_type: string;
  min_amount: number;
  max_amount: number | null;
  approval_route: string;
  approval_authority_code: string;
  approval_authority_label: string;
  requires_cgis_approval: boolean;
  requires_board: boolean;
  requires_bpp: boolean;
  governance_body_id: string | null;
  governance_body_name: string | null;
  notes: string | null;
}
