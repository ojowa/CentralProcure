import type { PoolClient } from 'pg';
import { pool } from '../../db.js';
import type {
  WorkflowGrantedAction,
  WorkflowAuthority,
  WorkflowActionGrantSnapshot,
} from './types.js';
import type { TokenPayload } from '../jwt.js';

const StageActionMap: Record<string, string[]> = {
  department_need_capture: ['requisition.create', 'requisition.update'],
  department_head_endorsement: ['requisition.update'],
  budget_allocation_and_confirmation: ['requisition.update', 'budget.confirm'],
  comptroller_procurement_review: ['requisition.update'],
  planning_committee_review: ['planning_committee.review'],
  app_approval: ['procurement_plan.approve'],
  procurement_initiation: ['requisition.create', 'requisition.update'],
  threshold_resolution: ['threshold.resolve', 'approval.review'],
  method_validation: ['tender.manage', 'tender.publish'],
  solicitation: [
    'tender.manage',
    'tender.publish',
    'administrative_review.create',
    'bid_opening.manage',
    'bid_opening.view_detail',
  ],
  bid_opening: ['bid_opening.manage', 'bid_opening.view_detail', 'evaluation.actions'],
  evaluation: ['evaluation.actions', 'administrative_review.create'],
  tenders_board_review: ['approval.review', 'approval.decide'],
  accounting_officer_review: [
    'cgis.approve',
    'cgis.reject',
    'cgis.return',
    'cgis.escalate',
    'bpp.create',
  ],
  bpp_no_objection: ['bpp.create', 'bpp.review', 'bpp.decide'],
  award_and_publication: ['contract_award.publish', 'administrative_review.create'],
  contract_execution: ['contract_management.manage'],
  inspection_and_payment: ['inspection.update', 'payment_tracking.view', 'closeout.create'],
  closeout_and_audit: ['closeout.create', 'audit_dashboard.view', 'audit_trail.view'],
  administrative_review: [
    'administrative_review.view',
    'administrative_review.update',
    'administrative_review.resolve',
  ],
};

const StageModuleActionMap: Record<string, string[]> = {
  department_need_capture: ['requisition.create', 'requisition.view', 'requisition.track'],
  department_head_endorsement: ['requisition.view', 'requisition.track'],
  budget_allocation_and_confirmation: [
    'requisition.view',
    'requisition.track',
    'planning_committee.view',
  ],
  comptroller_procurement_review: [
    'requisition.view',
    'requisition.track',
    'planning_committee.view',
  ],
  planning_committee_review: ['planning_committee.view'],
  app_approval: ['procurement_plan.manage', 'requisition.view', 'requisition.track'],
  procurement_initiation: ['requisition.create', 'requisition.view', 'requisition.track'],
  threshold_resolution: ['approval.review'],
  method_validation: ['tender.manage'],
  solicitation: [
    'tender.manage',
    'administrative_review.create',
    'bid_opening.manage',
    'bid_opening.view_detail',
  ],
  bid_opening: ['bid_opening.manage', 'bid_opening.view_detail'],
  evaluation: ['evaluation.actions', 'evaluation_report.view', 'administrative_review.create'],
  tenders_board_review: ['approval.review', 'approval.decide'],
  accounting_officer_review: [
    'cgis.approve',
    'cgis.reject',
    'cgis.return',
    'cgis.escalate',
    'high_value_tenders.review',
    'bpp.create',
  ],
  bpp_no_objection: ['bpp.create', 'bpp.review'],
  award_and_publication: [
    'contract_award.publish',
    'contract_award.view',
    'administrative_review.create',
  ],
  contract_execution: ['contract_management.manage'],
  inspection_and_payment: [
    'inspection.view',
    'inspection.update',
    'payment_tracking.view',
    'closeout.create',
  ],
  closeout_and_audit: ['audit_dashboard.view', 'audit_trail.view', 'compliance_reports.view'],
  administrative_review: [
    'administrative_review.view',
    'administrative_review.update',
    'administrative_review.resolve',
  ],
};

function normalizeRoleKey(role: string | null | undefined): string | null {
  if (!role || !role.trim()) return null;

  const trimmed = role.trim();
  const withUnderscores = trimmed.replace(/-/g, '_').replace(/ /g, '_');
  const snakeCase = withUnderscores.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  const lower = snakeCase.toLowerCase();

  const aliasMap: Record<string, string> = {
    system_administrator: 'ict_admin',
    tenders_board_member: 'tenders_board',
    audit_officer: 'audit_oversight',
    department_user: 'requisitioning_officer',
    procurement_planning_committee: 'planning_statistics_officer',
    bpp_liaison: 'bpp_liaison',
    bpp_reviewer: 'bpp_reviewer',
    procurementsecretary: 'procurement_secretary',
    comptrollerprocurement: 'comptroller_procurement',
    cgis: 'accounting_officer',
  };

  return aliasMap[lower] ?? lower;
}

export function resolveRoleKey(user: TokenPayload): string | null {
  const rawRole = user.role ?? null;
  return normalizeRoleKey(rawRole);
}

async function getRuntimeStageAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
): Promise<{ entity_type: string; entity_id: string; stage_key: string; stage_title: string } | null> {
  const sql = `
SELECT
    wi.entity_type,
    wi.entity_id,
    wi.current_stage_key,
    sc.stage_title
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
  ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = $1
  AND wi.entity_id = $2;`;

  const result = await client.query(sql, [entityType.trim().toLowerCase(), entityId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    stage_key: row.current_stage_key,
    stage_title: row.stage_title,
  };
}

async function getGrantedActionsForStageAsync(
  client: PoolClient,
  roleKey: string,
  stageKey: string,
): Promise<WorkflowGrantedAction[]> {
  const sql = `
SELECT display_name, task_description
FROM procurement_workflow.workflow_role_tasks
WHERE role_key = $1
  AND stage_key = $2
ORDER BY created_at ASC;`;

  const result = await client.query(sql, [roleKey, stageKey]);
  const actionKeys = StageActionMap[stageKey] ?? [];
  const results: WorkflowGrantedAction[] = [];

  for (const row of result.rows) {
    for (const actionKey of actionKeys) {
      results.push({
        action_key: actionKey,
        stage_key: stageKey,
        display_name: row.display_name,
        task_description: row.task_description,
      });
    }
  }

  const seen = new Set<string>();
  return results
    .filter((a) => {
      const key = a.action_key.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.action_key.localeCompare(b.action_key));
}

export async function hasRequiredActionAsync(
  user: TokenPayload,
  entityType: string,
  entityId: string,
  requiredAction: string,
): Promise<boolean> {
  if (!pool) return false;

  const roleKey = resolveRoleKey(user);
  if (!roleKey) return false;

  const client = await pool.connect();
  try {
    const current = await getRuntimeStageAsync(client, entityType, entityId);
    if (!current) return false;

    const actions = await getGrantedActionsForStageAsync(client, roleKey, current.stage_key);
    return actions.some((a) => a.action_key.toLowerCase() === requiredAction.toLowerCase());
  } finally {
    client.release();
  }
}

export async function getRoleModuleActionsAsync(
  role: string | null,
): Promise<string[]> {
  if (!pool) return [];

  const roleKey = normalizeRoleKey(role);
  if (!roleKey) return [];

  const client = await pool.connect();
  try {
    const sql = `
SELECT DISTINCT stage_key
FROM procurement_workflow.workflow_role_tasks
WHERE role_key = $1;`;

    const result = await client.query(sql, [roleKey]);
    const actions = new Set<string>();

    for (const row of result.rows) {
      const stageActions = StageModuleActionMap[row.stage_key];
      if (stageActions) {
        for (const action of stageActions) {
          actions.add(action);
        }
      }
    }

    return Array.from(actions).sort((a, b) => a.localeCompare(b));
  } finally {
    client.release();
  }
}

export function buildAuthority(
  entityType: string,
  currentStageKey: string,
  roleKey: string,
  actions: WorkflowGrantedAction[],
): WorkflowAuthority {
  const allowedActionKeys = Array.from(
    new Set(actions.map((a) => a.action_key.toLowerCase())),
  ).sort((a, b) => a.localeCompare(b));

  const canEdit = allowedActionKeys.includes('requisition.update');
  const canDelete =
    entityType.toLowerCase() === 'requisition' &&
    roleKey.toLowerCase() === 'admin';
  const canRoute =
    entityType.toLowerCase() === 'requisition' &&
    canEdit &&
    currentStageKey.toLowerCase() === 'comptroller_procurement_review';
  const canFileComplaint = allowedActionKeys.includes('administrative_review.create');

  return {
    can_edit: canEdit,
    can_delete: canDelete,
    can_route: canRoute,
    can_file_complaint: canFileComplaint,
    actions: allowedActionKeys,
  };
}

export async function getSnapshotAsync(
  user: TokenPayload,
  entityType: string,
  entityId: string,
): Promise<WorkflowActionGrantSnapshot | null> {
  if (!pool) return null;

  const roleKey = resolveRoleKey(user);
  if (!roleKey) return null;

  const client = await pool.connect();
  try {
    const current = await getRuntimeStageAsync(client, entityType, entityId);
    if (!current) return null;

    const actions = await getGrantedActionsForStageAsync(client, roleKey, current.stage_key);

    return {
      entity_type: current.entity_type,
      entity_id: current.entity_id,
      current_stage_key: current.stage_key,
      current_stage_title: current.stage_title,
      role_key: roleKey,
      actions,
      authority: buildAuthority(entityType, current.stage_key, roleKey, actions),
    };
  } finally {
    client.release();
  }
}
