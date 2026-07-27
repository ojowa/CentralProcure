import { pool } from '../../db.js';
import type {
  WorkflowRuntimeSyncRequest,
  WorkflowRuntimeSnapshot,
  WorkflowRuntimeTransitionSummary,
  WorkflowRuntimeHistoryEntry,
  CgisQueueItem,
  CgisDocument,
} from './types.js';

interface CurrentInstanceState {
  instance_id: string;
  current_stage_key: string;
  current_status: string | null;
}

function normalizeEntityType(value: string): string {
  if (!value || !value.trim()) {
    throw new Error('entityType is required.');
  }
  return value.trim().toLowerCase();
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

function normalizeRequest(request: WorkflowRuntimeSyncRequest): WorkflowRuntimeSyncRequest {
  return {
    ...request,
    entity_type: normalizeEntityType(request.entity_type),
    stage_key: request.stage_key.trim(),
    status: normalizeNullable(request.status),
    record_title: normalizeNullable(request.record_title),
    parent_entity_type: normalizeNullable(request.parent_entity_type),
    procurement_type: normalizeNullable(request.procurement_type),
    transition_reason: normalizeNullable(request.transition_reason),
    actor: normalizeNullable(request.actor),
    transition_source:
      !request.transition_source || !request.transition_source.trim()
        ? 'controller_sync'
        : request.transition_source.trim(),
  };
}

function addSyncParameters(
  params: unknown[],
  request: WorkflowRuntimeSyncRequest,
): unknown[] {
  params.push(
    request.entity_type,
    request.entity_id,
    request.stage_key,
    request.status,
    request.record_title,
    request.parent_entity_type,
    request.parent_entity_id,
    request.amount ?? null,
    request.procurement_type,
    request.threshold_id,
    request.transition_reason,
  );
  return params;
}

async function getCurrentInstanceAsync(
  client: import('pg').PoolClient,
  entityType: string,
  entityId: string,
): Promise<CurrentInstanceState | null> {
  const sql = `
SELECT instance_id, current_stage_key, current_status
FROM procurement_workflow.workflow_instances
WHERE entity_type = $1
  AND entity_id = $2
FOR UPDATE;`;

  const result = await client.query(sql, [entityType, entityId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    instance_id: row.instance_id,
    current_stage_key: row.current_stage_key,
    current_status: row.current_status ?? null,
  };
}

async function insertInstanceAsync(
  client: import('pg').PoolClient,
  request: WorkflowRuntimeSyncRequest,
): Promise<string> {
  const sql = `
INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    threshold_id,
    last_transition_reason
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING instance_id;`;

  const params: unknown[] = [];
  addSyncParameters(params, request);

  const result = await client.query(sql, params);
  const instanceId = result.rows[0]?.instance_id as string | undefined;

  if (!instanceId) {
    throw new Error('Workflow instance creation failed.');
  }

  return instanceId;
}

async function updateInstanceAsync(
  client: import('pg').PoolClient,
  instanceId: string,
  request: WorkflowRuntimeSyncRequest,
): Promise<void> {
  const sql = `
UPDATE procurement_workflow.workflow_instances
SET
    current_stage_key = $3,
    current_status = $4,
    record_title = $5,
    parent_entity_type = $6,
    parent_entity_id = $7,
    amount = $8,
    procurement_type = $9,
    threshold_id = $10,
    last_transition_reason = $11,
    updated_at = CURRENT_TIMESTAMP
WHERE instance_id = $1
  AND entity_type = $2;`;

  const params: unknown[] = [instanceId, request.entity_type];
  addSyncParameters(params, request);

  await client.query(sql, params);
}

async function insertHistoryAsync(
  client: import('pg').PoolClient,
  instanceId: string,
  fromStageKey: string | null,
  request: WorkflowRuntimeSyncRequest,
): Promise<void> {
  const sql = `
INSERT INTO procurement_workflow.workflow_instance_history (
    instance_id,
    from_stage_key,
    to_stage_key,
    stage_status,
    transition_source,
    transition_reason,
    actor
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7
);`;

  await client.query(sql, [
    instanceId,
    fromStageKey,
    request.stage_key,
    request.status,
    request.transition_source,
    request.transition_reason,
    request.actor,
  ]);
}

async function getTransitionsAsync(
  client: import('pg').PoolClient,
  stageKey: string,
): Promise<WorkflowRuntimeTransitionSummary[]> {
  const sql = `
SELECT
    t.to_stage_key,
    sc.stage_title,
    t.transition_condition
FROM procurement_workflow.workflow_stage_transitions t
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = t.to_stage_key
WHERE t.from_stage_key = $1
ORDER BY sc.sequence_no;`;

  const result = await client.query(sql, [stageKey]);
  return result.rows.map((row) => ({
    to_stage_key: row.to_stage_key,
    stage_title: row.stage_title,
    transition_condition: row.transition_condition,
  }));
}

export async function syncAsync(
  request: WorkflowRuntimeSyncRequest,
): Promise<void> {
  if (!pool) throw new Error('Database pool is not configured.');

  const normalizedRequest = normalizeRequest(request);
  const client = await pool.connect();
  try {
    const existing = await getCurrentInstanceAsync(
      client,
      normalizedRequest.entity_type,
      normalizedRequest.entity_id,
    );

    if (!existing) {
      const instanceId = await insertInstanceAsync(client, normalizedRequest);
      await insertHistoryAsync(client, instanceId, null, normalizedRequest);
      return;
    }

    const stageChanged =
      existing.current_stage_key.toLowerCase() !== normalizedRequest.stage_key.toLowerCase();
    const statusChanged =
      (existing.current_status ?? '') !== (normalizedRequest.status ?? '');

    await updateInstanceAsync(client, existing.instance_id, normalizedRequest);

    if (stageChanged || statusChanged) {
      await insertHistoryAsync(
        client,
        existing.instance_id,
        existing.current_stage_key,
        normalizedRequest,
      );
    }
  } finally {
    client.release();
  }
}

export async function getAsync(
  entityType: string,
  entityId: string,
): Promise<WorkflowRuntimeSnapshot | null> {
  if (!pool) return null;

  const client = await pool.connect();
  try {
    const normalizedEntityType = normalizeEntityType(entityType);

    const snapshotSql = `
SELECT
    wi.instance_id,
    wi.entity_type,
    wi.entity_id,
    wi.current_stage_key,
    sc.stage_title,
    sc.phase_key,
    wi.current_status,
    wi.record_title,
    wi.parent_entity_type,
    wi.parent_entity_id,
    wi.amount,
    wi.procurement_type,
    wi.threshold_id,
    wi.last_transition_reason,
    wi.created_at,
    wi.updated_at
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = $1
  AND wi.entity_id = $2;`;

    const result = await client.query(snapshotSql, [normalizedEntityType, entityId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const currentStageKey: string = row.current_stage_key;

    const nextTransitions = await getTransitionsAsync(client, currentStageKey);

    return {
      instance_id: row.instance_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      current_stage_key: currentStageKey,
      current_stage_title: row.stage_title,
      current_phase_key: row.phase_key,
      current_status: row.current_status ?? null,
      record_title: row.record_title ?? null,
      parent_entity_type: row.parent_entity_type ?? null,
      parent_entity_id: row.parent_entity_id ?? null,
      amount: row.amount != null ? Number(row.amount) : null,
      procurement_type: row.procurement_type ?? null,
      threshold_id: row.threshold_id ?? null,
      last_transition_reason: row.last_transition_reason ?? null,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
      next_transitions: nextTransitions,
    };
  } finally {
    client.release();
  }
}

export async function getHistoryAsync(
  entityType: string,
  entityId: string,
): Promise<WorkflowRuntimeHistoryEntry[]> {
  if (!pool) return [];

  const client = await pool.connect();
  try {
    const normalizedEntityType = normalizeEntityType(entityType);

    const sql = `
SELECT
    h.history_id,
    h.from_stage_key,
    h.to_stage_key,
    sc.stage_title,
    h.stage_status,
    h.transition_source,
    h.transition_reason,
    h.actor,
    h.created_at
FROM procurement_workflow.workflow_instance_history h
JOIN procurement_workflow.workflow_instances wi
    ON wi.instance_id = h.instance_id
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = h.to_stage_key
WHERE wi.entity_type = $1
  AND wi.entity_id = $2
ORDER BY h.created_at DESC;`;

    const result = await client.query(sql, [normalizedEntityType, entityId]);
    return result.rows.map((row) => ({
      history_id: row.history_id,
      from_stage_key: row.from_stage_key ?? null,
      to_stage_key: row.to_stage_key,
      to_stage_title: row.stage_title,
      stage_status: row.stage_status ?? null,
      transition_source: row.transition_source,
      transition_reason: row.transition_reason ?? null,
      actor: row.actor ?? null,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
    }));
  } finally {
    client.release();
  }
}

export async function getCgisQueueAsync(): Promise<CgisQueueItem[]> {
  if (!pool) return [];

  const client = await pool.connect();
  try {
    const sql = `
SELECT
    wi.instance_id,
    wi.entity_type,
    wi.entity_id,
    wi.record_title,
    COALESCE(r.department, t.department, 'N/A') as department,
    wi.amount,
    at.approval_route,
    at.approval_authority_label,
    wi.current_status as status,
    v.company_name as vendor_name,
    wi.created_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - wi.created_at))::int as days_pending
FROM procurement_workflow.workflow_instances wi
LEFT JOIN procurement_workflow.approval_thresholds at ON at.threshold_id = wi.threshold_id
LEFT JOIN procurement_workflow.requisitions r ON wi.entity_type = 'requisition' AND r.requisition_id = wi.entity_id
LEFT JOIN vendor_sourcing.tenders t ON wi.entity_type = 'tender' AND t.tender_id = wi.entity_id
LEFT JOIN vendor_sourcing.bids b ON wi.entity_type = 'tender' AND b.tender_id = wi.entity_id AND b.status = 'Recommended'
LEFT JOIN identity.vendors v ON b.vendor_id = v.vendor_id
WHERE wi.current_stage_key = 'accounting_officer_review'
ORDER BY wi.created_at DESC;`;

    const result = await client.query(sql);
    return result.rows.map((row) => ({
      instance_id: row.instance_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      record_title: row.record_title ?? null,
      department: row.department,
      amount: row.amount != null ? Number(row.amount) : null,
      approval_route: row.approval_route ?? null,
      approval_authority_label: row.approval_authority_label ?? null,
      status: row.status ?? null,
      vendor_name: row.vendor_name ?? null,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      days_pending: row.days_pending,
    }));
  } finally {
    client.release();
  }
}

export async function getCgisDocumentsAsync(
  entityType: string,
  entityId: string,
): Promise<CgisDocument[]> {
  if (!pool) return [];

  const client = await pool.connect();
  try {
    const results: CgisDocument[] = [];

    if (entityType.toLowerCase() !== 'tender') {
      return results;
    }

    const sql = `
WITH recommended_bid AS (
    SELECT vendor_id, technical_proposal_url, updated_at
    FROM vendor_sourcing.bids
    WHERE tender_id = $1 AND status = 'Recommended'
    LIMIT 1
)
SELECT 'Technical Proposal' as doc_type, 'Proposal.pdf' as file_name, technical_proposal_url as file_url, 'Submitted' as status, updated_at
FROM recommended_bid
WHERE technical_proposal_url IS NOT NULL
UNION ALL
SELECT vcd.document_type, vcd.document_type || '.pdf' as file_name, vcd.document_url as file_url, vcd.verification_status as status, vcd.updated_at
FROM recommended_bid rb
JOIN identity.compliance_documents vcd ON vcd.vendor_id = rb.vendor_id;`;

    const result = await client.query(sql, [entityId]);
    return result.rows.map((row) => ({
      document_type: row.doc_type,
      file_name: row.file_name ?? null,
      file_url: row.file_url ?? null,
      status: row.status ?? null,
      updated_at: row.updated_at?.toISOString?.() ?? null,
    }));
  } finally {
    client.release();
  }
}
