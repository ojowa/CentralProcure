import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { syncAsync } from '../lib/workflow/runtime-tracker.js';

export const workflowRouter = Router();

// GET /api/workflow-actions/:entityType/:entityId
workflowRouter.get('/api/workflow-actions/:entityType/:entityId', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { entityType, entityId } = req.params;

    const instanceResult = await pool.query(
      `SELECT
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.current_stage_key AS "CurrentStageKey",
        wsc.stage_title AS "CurrentStageTitle",
        wi.record_title AS "RecordTitle"
      FROM procurement_workflow.workflow_instances wi
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
        ON wsc.stage_key = wi.current_stage_key
      WHERE wi.entity_type = $1 AND wi.entity_id = $2`,
      [entityType, entityId]
    );

    if (instanceResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Workflow instance not found.' });
      return;
    }

    const instance = instanceResult.rows[0];

    const transitionsResult = await pool.query(
      `SELECT
        t.to_stage_key AS "ToStageKey",
        wsc.stage_title AS "StageTitle",
        t.transition_condition AS "TransitionCondition"
      FROM procurement_workflow.workflow_stage_transitions t
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
        ON wsc.stage_key = t.to_stage_key
      WHERE t.from_stage_key = $1
      ORDER BY wsc.sort_order`,
      [instance.CurrentStageKey]
    );

    const transitions = transitionsResult.rows.map((r) => ({
      ToStageKey: r.ToStageKey,
      StageTitle: r.StageTitle,
      TransitionCondition: r.TransitionCondition,
    }));

    res.json({
      EntityType: instance.EntityType,
      EntityId: instance.EntityId,
      CurrentStageKey: instance.CurrentStageKey,
      CurrentStageTitle: instance.CurrentStageTitle,
      RecordTitle: instance.RecordTitle,
      AvailableTransitions: transitions,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow actions.' });
  }
});

// POST /api/workflow-runtime/:entityType/:entityId
workflowRouter.post('/api/workflow-runtime/:entityType/:entityId', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { entityType, entityId } = req.params;
    const {
      StageKey,
      Status,
      RecordTitle,
      ParentEntityType,
      ParentEntityId,
      Amount,
      ProcurementType,
      ThresholdId,
      TransitionReason,
      Actor,
      TransitionSource
    } = req.body;

    if (!StageKey) {
      res.status(400).json({ ErrorMessage: 'StageKey is required.' });
      return;
    }

    await syncAsync({
      entity_type: entityType,
      entity_id: entityId,
      stage_key: StageKey,
      status: Status ?? null,
      record_title: RecordTitle ?? null,
      parent_entity_type: ParentEntityType ?? null,
      parent_entity_id: ParentEntityId ?? null,
      amount: Amount ?? null,
      procurement_type: ProcurementType ?? null,
      threshold_id: ThresholdId ?? null,
      transition_reason: TransitionReason ?? null,
      actor: Actor ?? payload.email ?? payload.sub,
      transition_source: TransitionSource ?? 'api_sync'
    });

    res.json({ Status: 'Synced', EntityType: entityType, EntityId: entityId, StageKey: StageKey });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred syncing workflow runtime.' });
  }
});

// GET /api/workflow-runtime/:entityType/:entityId
workflowRouter.get('/api/workflow-runtime/:entityType/:entityId', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { entityType, entityId } = req.params;

    const result = await pool.query(
      `SELECT
        wi.instance_id AS "InstanceId",
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.current_stage_key AS "CurrentStageKey",
        wsc.stage_title AS "CurrentStageTitle",
        wsc.phase_key AS "CurrentPhaseKey",
        wi.current_status AS "CurrentStatus",
        wi.record_title AS "RecordTitle",
        wi.parent_entity_type AS "ParentEntityType",
        wi.parent_entity_id AS "ParentEntityId",
        wi.amount AS "Amount",
        wi.procurement_type AS "ProcurementType",
        wi.threshold_id AS "ThresholdId",
        wi.last_transition_reason AS "LastTransitionReason",
        wi.created_at AS "CreatedAt",
        wi.updated_at AS "UpdatedAt"
      FROM procurement_workflow.workflow_instances wi
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
        ON wsc.stage_key = wi.current_stage_key
      WHERE wi.entity_type = $1 AND wi.entity_id = $2`,
      [entityType, entityId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Workflow instance not found.' });
      return;
    }

    const instance = result.rows[0];

    const transitionsResult = await pool.query(
      `SELECT
        t.to_stage_key AS "ToStageKey",
        wsc.stage_title AS "StageTitle",
        t.transition_condition AS "TransitionCondition"
      FROM procurement_workflow.workflow_stage_transitions t
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
        ON wsc.stage_key = t.to_stage_key
      WHERE t.from_stage_key = $1
      ORDER BY wsc.sort_order`,
      [instance.CurrentStageKey]
    );

    const nextTransitions = transitionsResult.rows.map((r) => ({
      ToStageKey: r.ToStageKey,
      StageTitle: r.StageTitle,
      TransitionCondition: r.TransitionCondition,
    }));

    res.json({
      ...instance,
      NextTransitions: nextTransitions,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow runtime.' });
  }
});

// GET /api/workflow-runtime/:entityType/:entityId/history
workflowRouter.get('/api/workflow-runtime/:entityType/:entityId/history', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { entityType, entityId } = req.params;

    const result = await pool.query(
      `SELECT
        wh.history_id AS "HistoryId",
        wh.from_stage_key AS "FromStageKey",
        wsc_from.stage_title AS "FromStageTitle",
        wh.to_stage_key AS "ToStageKey",
        wsc_to.stage_title AS "ToStageTitle",
        wh.stage_status AS "StageStatus",
        wh.transition_source AS "TransitionSource",
        wh.transition_reason AS "TransitionReason",
        wh.actor AS "Actor",
        wh.created_at AS "CreatedAt"
      FROM procurement_workflow.workflow_instance_history wh
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc_from
        ON wsc_from.stage_key = wh.from_stage_key
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc_to
        ON wsc_to.stage_key = wh.to_stage_key
      WHERE wh.entity_type = $1 AND wh.entity_id = $2
      ORDER BY wh.created_at DESC`,
      [entityType, entityId]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow history.' });
  }
});

// GET /api/workflow-runtime/cgis-queue
workflowRouter.get('/api/workflow-runtime/cgis-queue', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
        wi.instance_id AS "InstanceId",
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.record_title AS "RecordTitle",
        wi.amount AS "Amount",
        wi.threshold_id AS "ThresholdId",
        at.approval_route AS "ApprovalRoute",
        at.approval_authority_label AS "ApprovalAuthorityLabel",
        wi.current_status AS "Status",
        wi.created_at AS "CreatedAt",
        EXTRACT(DAY FROM NOW() - wi.created_at)::int AS "DaysPending"
      FROM procurement_workflow.workflow_instances wi
      LEFT JOIN post_award.approval_thresholds at ON at.threshold_id = wi.threshold_id
      WHERE wi.current_stage_key IN ('cgis_approval', 'bg_management_approval')
        AND wi.current_status != 'Completed'
      ORDER BY wi.amount DESC, wi.created_at ASC`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching CGIS queue.' });
  }
});

// GET /api/workflow-blueprint
workflowRouter.get('/api/workflow-blueprint', async (_req, res) => {
  try {
    if (!pool) {
      res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
      return;
    }

    const phasesResult = await pool.query(
      `SELECT phase_key AS "PhaseKey", phase_title AS "PhaseTitle", color AS "Color"
       FROM procurement_workflow.workflow_phases
       ORDER BY sort_order`
    );

    const statesResult = await pool.query(
      `SELECT
        stage_key AS "StageKey",
        stage_title AS "StageTitle",
        phase_key AS "PhaseKey",
        module AS "Module",
        is_initial AS "IsInitial",
        is_terminal AS "IsTerminal",
        sort_order AS "SortOrder"
      FROM procurement_workflow.workflow_stage_catalog
      ORDER BY sort_order`
    );

    const transitionsResult = await pool.query(
      `SELECT
        from_stage_key AS "FromStageKey",
        to_stage_key AS "ToStageKey",
        transition_condition AS "TransitionCondition",
        requires_approval AS "RequiresApproval"
      FROM procurement_workflow.workflow_stage_transitions
      ORDER BY from_stage_key, to_stage_key`
    );

    res.json({
      Phases: phasesResult.rows,
      States: statesResult.rows,
      Transitions: transitionsResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow blueprint.' });
  }
});

// GET /api/config/workflows
workflowRouter.get('/api/config/workflows', async (_req, res) => {
  try {
    if (!pool) {
      res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
      return;
    }

    const result = await pool.query(
      `SELECT
        stage_key AS "StageKey",
        stage_title AS "StageTitle",
        phase_key AS "PhaseKey",
        module AS "Module",
        is_initial AS "IsInitial",
        is_terminal AS "IsTerminal",
        sort_order AS "SortOrder"
      FROM procurement_workflow.workflow_stage_catalog
      ORDER BY sort_order`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow config.' });
  }
});
