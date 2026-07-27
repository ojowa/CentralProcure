import type { PoolClient } from 'pg';
import { pool } from '../../db.js';
import type {
  WorkflowThresholdResolution,
  WorkflowTransitionCheckResult,
  WorkflowRouteDecision,
} from './types.js';

interface StageState {
  stage_key: string;
  stage_title: string;
}

interface WorkflowInstanceState {
  entity_type: string;
  entity_id: string;
  current_stage_key: string;
  threshold_id: string | null;
  amount: number | null;
  procurement_type: string | null;
}

const METHOD_DECISION_REQUIRED_STAGES = new Set([
  'solicitation',
  'bid_opening',
  'evaluation',
  'accounting_officer_review',
  'award_and_publication',
]);

function normalizeRequired(value: string | undefined | null, paramName: string): string {
  if (!value || !value.trim()) {
    throw new Error(`${paramName} is required.`);
  }
  return value.trim().toLowerCase();
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

async function getCurrentStageAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
): Promise<StageState | null> {
  const sql = `
SELECT wi.current_stage_key, sc.stage_title
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = $1
  AND wi.entity_id = $2;`;

  const result = await client.query(sql, [entityType, entityId]);
  if (result.rows.length === 0) return null;

  return {
    stage_key: result.rows[0].current_stage_key,
    stage_title: result.rows[0].stage_title,
  };
}

async function getStageTitleAsync(
  client: PoolClient,
  stageKey: string,
): Promise<string | null> {
  const sql = `
SELECT stage_title
FROM procurement_workflow.workflow_stage_catalog
WHERE stage_key = $1;`;

  const result = await client.query(sql, [stageKey]);
  return result.rows.length > 0 ? result.rows[0].stage_title : null;
}

async function isReachableAsync(
  client: PoolClient,
  fromStageKey: string,
  toStageKey: string,
): Promise<boolean> {
  const sql = `
WITH RECURSIVE reachable(stage_key, path) AS (
    SELECT $1::varchar, ARRAY[$1::varchar]
    UNION ALL
    SELECT t.to_stage_key, r.path || t.to_stage_key
    FROM reachable r
    JOIN procurement_workflow.workflow_stage_transitions t
        ON t.from_stage_key = r.stage_key
    WHERE NOT t.to_stage_key = ANY(r.path)
)
SELECT 1
FROM reachable
WHERE stage_key = $2
LIMIT 1;`;

  const result = await client.query(sql, [fromStageKey, toStageKey]);
  return result.rows.length > 0;
}

async function getCurrentInstanceAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
): Promise<WorkflowInstanceState | null> {
  const sql = `
SELECT
    entity_type,
    entity_id,
    current_stage_key,
    threshold_id,
    amount,
    procurement_type
FROM procurement_workflow.workflow_instances
WHERE entity_type = $1
  AND entity_id = $2;`;

  const result = await client.query(sql, [entityType, entityId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    current_stage_key: row.current_stage_key,
    threshold_id: row.threshold_id ?? null,
    amount: row.amount != null ? Number(row.amount) : null,
    procurement_type: row.procurement_type ?? null,
  };
}

async function getThresholdByIdAsync(
  client: PoolClient,
  thresholdId: string,
): Promise<WorkflowThresholdResolution | null> {
  const sql = `
SELECT
    threshold_id,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    body.body_name AS governance_body_name,
    min_amount,
    max_amount,
    notes
FROM procurement_workflow.approval_thresholds
LEFT JOIN procurement_workflow.governance_bodies body
    ON body.body_id = procurement_workflow.approval_thresholds.governance_body_id
WHERE threshold_id = $1;`;

  const result = await client.query(sql, [thresholdId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    threshold_id: row.threshold_id,
    approval_route: row.approval_route,
    approval_authority_code: row.approval_authority_code,
    approval_authority_label: row.approval_authority_label,
    requires_cgis_approval: row.requires_cgis_approval,
    requires_board: row.requires_board,
    requires_bpp: row.requires_bpp,
    governance_body_id: row.governance_body_id ?? null,
    governance_body_name: row.governance_body_name ?? null,
    min_amount: Number(row.min_amount),
    max_amount: row.max_amount != null ? Number(row.max_amount) : null,
    notes: row.notes ?? null,
  };
}

async function evaluateMethodExceptionPauseAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
  currentStageKey: string,
  requestedStageKey: string,
): Promise<string | null> {
  const sql = `
SELECT status
FROM procurement_workflow.procurement_method_change_exceptions
WHERE entity_type = $1
  AND entity_id = $2
  AND status IN ('PendingReview', 'ReturnedForClarification')
ORDER BY requested_at DESC
LIMIT 1;`;

  const result = await client.query(sql, [entityType, entityId]);
  if (result.rows.length === 0) return null;

  const status: string = result.rows[0].status;

  if (currentStageKey.toLowerCase() === requestedStageKey.toLowerCase()) {
    return null;
  }

  return status.toLowerCase() === 'returnedforclarification'
    ? 'This procurement is paused pending clarification of a CGIS method-change exception.'
    : 'This procurement is paused pending CGIS decision on a late method-change exception.';
}

async function evaluateMethodDeterminationRequirementAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
  requestedStageKey: string,
): Promise<string | null> {
  if (
    entityType.toLowerCase() !== 'tender' ||
    !METHOD_DECISION_REQUIRED_STAGES.has(requestedStageKey.toLowerCase())
  ) {
    return null;
  }

  const current = await getCurrentInstanceAsync(client, entityType, entityId);
  if (current === null) return null;

  let threshold: WorkflowThresholdResolution | null = null;
  if (current.threshold_id) {
    threshold = await getThresholdByIdAsync(client, current.threshold_id);
  }
  if (!threshold) {
    threshold = await resolveThresholdStaticAsync(
      client,
      current.procurement_type,
      current.amount,
    );
  }

  if (!threshold || !threshold.requires_cgis_approval) return null;

  const currentMethod = await getCurrentMethodDecisionAsync(client, entityType, entityId);
  if (!currentMethod) {
    return 'A procurement method must be recorded by Comptroller Procurement before this low-value case can proceed.';
  }

  if (
    currentMethod.toLowerCase() === 'simplifiedquotation' &&
    requestedStageKey.toLowerCase() === 'bid_opening'
  ) {
    return 'Simplified quotation cases cannot move to bid opening. Proceed from solicitation to comparative review/evaluation instead.';
  }

  return null;
}

async function getCurrentMethodDecisionAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  const sql = `
SELECT selected_method
FROM procurement_workflow.procurement_method_decisions
WHERE entity_type = $1
  AND entity_id = $2
  AND superseded_by_decision_id IS NULL
ORDER BY determined_at DESC
LIMIT 1;`;

  const result = await client.query(sql, [entityType, entityId]);
  return result.rows.length > 0 ? result.rows[0].selected_method : null;
}

async function resolveThresholdStaticAsync(
  client: PoolClient,
  procurementType: string | null,
  amount: number | null,
): Promise<WorkflowThresholdResolution | null> {
  if (amount == null) return null;

  const sql = `
SELECT
    threshold_id,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    body.body_name AS governance_body_name,
    min_amount,
    max_amount,
    notes
FROM procurement_workflow.approval_thresholds
LEFT JOIN procurement_workflow.governance_bodies body
    ON body.body_id = procurement_workflow.approval_thresholds.governance_body_id
WHERE status = 'Active'
  AND min_amount <= $1
  AND (max_amount IS NULL OR max_amount >= $1)
  AND (
        $2::varchar IS NULL
        OR procurement_type IS NULL
        OR lower(procurement_type) = lower($2)
      )
ORDER BY
    CASE
        WHEN $2::varchar IS NOT NULL AND procurement_type IS NOT NULL AND lower(procurement_type) = lower($2) THEN 0
        WHEN procurement_type IS NULL THEN 1
        ELSE 2
    END,
    min_amount DESC
LIMIT 1;`;

  const result = await client.query(sql, [amount, normalizeNullable(procurementType)]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    threshold_id: row.threshold_id,
    approval_route: row.approval_route,
    approval_authority_code: row.approval_authority_code,
    approval_authority_label: row.approval_authority_label,
    requires_cgis_approval: row.requires_cgis_approval,
    requires_board: row.requires_board,
    requires_bpp: row.requires_bpp,
    governance_body_id: row.governance_body_id ?? null,
    governance_body_name: row.governance_body_name ?? null,
    min_amount: Number(row.min_amount),
    max_amount: row.max_amount != null ? Number(row.max_amount) : null,
    notes: row.notes ?? null,
  };
}

async function evaluateRouteConstraintAsync(
  client: PoolClient,
  entityType: string,
  entityId: string,
  currentStageKey: string,
  requestedStageKey: string,
): Promise<string | null> {
  const decision = await resolveRouteDecisionAsyncInternal(client, entityType, entityId);
  if (!decision) return null;

  if (currentStageKey.toLowerCase() === 'tenders_board_review') {
    if (requestedStageKey.toLowerCase() === 'accounting_officer_review') {
      return 'CGIS approval applies only to low-value routes and cannot follow Tenders Board review.';
    }
    if (
      requestedStageKey.toLowerCase() === 'award_and_publication' &&
      decision.requires_bpp
    ) {
      return 'The live threshold route requires BPP no-objection before award publication.';
    }
    if (
      requestedStageKey.toLowerCase() === 'bpp_no_objection' &&
      !decision.requires_bpp
    ) {
      return 'The live threshold route does not require BPP no-objection for this record.';
    }
  }

  if (currentStageKey.toLowerCase() === 'accounting_officer_review') {
    if (
      requestedStageKey.toLowerCase() === 'bpp_no_objection' &&
      !decision.requires_bpp
    ) {
      return 'The live threshold route does not require BPP no-objection for this record.';
    }
    if (
      requestedStageKey.toLowerCase() === 'award_and_publication' &&
      decision.requires_bpp
    ) {
      return 'The live threshold route requires BPP no-objection before award publication.';
    }
  }

  if (currentStageKey.toLowerCase() === 'evaluation') {
    if (
      requestedStageKey.toLowerCase() === 'accounting_officer_review' &&
      !decision.requires_cgis_approval
    ) {
      return 'The live threshold route does not require CGIS approval for this record.';
    }
    if (
      requestedStageKey.toLowerCase() === 'tenders_board_review' &&
      !decision.requires_board
    ) {
      return 'The live threshold route does not require Tenders Board review for this record.';
    }
  }

  return null;
}

export async function evaluateTransitionAsync(
  entityType: string,
  entityId: string,
  requestedStageKey: string,
): Promise<WorkflowTransitionCheckResult> {
  const normalizedEntityType = normalizeRequired(entityType, 'entityType');
  const normalizedRequestedStageKey = normalizeRequired(requestedStageKey, 'requestedStageKey');

  const client = await pool!.connect();
  try {
    const current = await getCurrentStageAsync(client, normalizedEntityType, entityId);
    const requestedTitle = await getStageTitleAsync(client, normalizedRequestedStageKey);

    if (!requestedTitle) {
      return {
        is_allowed: false,
        current_stage_key: current?.stage_key ?? null,
        current_stage_title: current?.stage_title ?? null,
        requested_stage_key: normalizedRequestedStageKey,
        requested_stage_title: null,
        message: `Workflow stage '${normalizedRequestedStageKey}' is not defined.`,
      };
    }

    if (!current) {
      return {
        is_allowed: true,
        current_stage_key: null,
        current_stage_title: null,
        requested_stage_key: normalizedRequestedStageKey,
        requested_stage_title: requestedTitle,
        message: null,
      };
    }

    if (current.stage_key.toLowerCase() === normalizedRequestedStageKey.toLowerCase()) {
      return {
        is_allowed: true,
        current_stage_key: current.stage_key,
        current_stage_title: current.stage_title,
        requested_stage_key: normalizedRequestedStageKey,
        requested_stage_title: requestedTitle,
        message: null,
      };
    }

    const exceptionPauseMessage = await evaluateMethodExceptionPauseAsync(
      client,
      normalizedEntityType,
      entityId,
      current.stage_key,
      normalizedRequestedStageKey,
    );

    if (exceptionPauseMessage) {
      return {
        is_allowed: false,
        current_stage_key: current.stage_key,
        current_stage_title: current.stage_title,
        requested_stage_key: normalizedRequestedStageKey,
        requested_stage_title: requestedTitle,
        message: exceptionPauseMessage,
      };
    }

    const methodDecisionError = await evaluateMethodDeterminationRequirementAsync(
      client,
      normalizedEntityType,
      entityId,
      normalizedRequestedStageKey,
    );

    if (methodDecisionError) {
      return {
        is_allowed: false,
        current_stage_key: current.stage_key,
        current_stage_title: current.stage_title,
        requested_stage_key: normalizedRequestedStageKey,
        requested_stage_title: requestedTitle,
        message: methodDecisionError,
      };
    }

    const isReachable = await isReachableAsync(
      client,
      current.stage_key,
      normalizedRequestedStageKey,
    );

    if (isReachable) {
      const routeConstraintError = await evaluateRouteConstraintAsync(
        client,
        normalizedEntityType,
        entityId,
        current.stage_key,
        normalizedRequestedStageKey,
      );

      if (routeConstraintError) {
        return {
          is_allowed: false,
          current_stage_key: current.stage_key,
          current_stage_title: current.stage_title,
          requested_stage_key: normalizedRequestedStageKey,
          requested_stage_title: requestedTitle,
          message: routeConstraintError,
        };
      }
    }

    if (isReachable) {
      return {
        is_allowed: true,
        current_stage_key: current.stage_key,
        current_stage_title: current.stage_title,
        requested_stage_key: normalizedRequestedStageKey,
        requested_stage_title: requestedTitle,
        message: null,
      };
    }

    return {
      is_allowed: false,
      current_stage_key: current.stage_key,
      current_stage_title: current.stage_title,
      requested_stage_key: normalizedRequestedStageKey,
      requested_stage_title: requestedTitle,
      message: `Illegal workflow transition from '${current.stage_title}' to '${requestedTitle}'.`,
    };
  } finally {
    client.release();
  }
}

export async function resolveThresholdAsync(
  procurementType: string | null,
  amount: number | null,
): Promise<WorkflowThresholdResolution | null> {
  if (amount == null) return null;

  const client = await pool!.connect();
  try {
    return await resolveThresholdStaticAsync(client, procurementType, amount);
  } finally {
    client.release();
  }
}

export async function resolveRouteDecisionAsync(
  entityType: string,
  entityId: string,
): Promise<WorkflowRouteDecision | null> {
  const normalizedEntityType = normalizeRequired(entityType, 'entityType');

  const client = await pool!.connect();
  try {
    return await resolveRouteDecisionAsyncInternal(client, normalizedEntityType, entityId);
  } finally {
    client.release();
  }
}

async function resolveRouteDecisionAsyncInternal(
  client: PoolClient,
  entityType: string,
  entityId: string,
): Promise<WorkflowRouteDecision | null> {
  const current = await getCurrentInstanceAsync(client, entityType, entityId);
  if (!current) return null;

  let threshold: WorkflowThresholdResolution | null = null;
  if (current.threshold_id) {
    threshold = await getThresholdByIdAsync(client, current.threshold_id);
  }
  if (!threshold) {
    threshold = await resolveThresholdStaticAsync(
      client,
      current.procurement_type,
      current.amount,
    );
  }

  return {
    entity_type: current.entity_type,
    entity_id: current.entity_id,
    current_stage_key: current.current_stage_key,
    threshold_id: threshold?.threshold_id ?? current.threshold_id,
    approval_route: threshold?.approval_route ?? null,
    approval_authority_code: threshold?.approval_authority_code ?? null,
    approval_authority_label: threshold?.approval_authority_label ?? null,
    requires_cgis_approval: threshold?.requires_cgis_approval ?? false,
    requires_board: threshold?.requires_board ?? false,
    requires_bpp: threshold?.requires_bpp ?? false,
    governance_body_id: threshold?.governance_body_id ?? null,
    governance_body_name: threshold?.governance_body_name ?? null,
    amount: current.amount,
    procurement_type: current.procurement_type,
    notes: threshold?.notes ?? null,
  };
}
