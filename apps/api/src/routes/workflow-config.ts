import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const workflowConfigRouter = Router();

const requireAuth = (req: any) => extractPayloadFromRequest(req.headers.authorization);

// GET /api/config/workflows — already exists in workflow.ts, SKIP

// GET /api/config/workflows/thresholds
workflowConfigRouter.get('/api/config/workflows/thresholds', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const result = await pool.query(
      `SELECT threshold_id AS "ThresholdId",
              threshold_name AS "ThresholdName",
              procurement_type AS "ProcurementType",
              min_amount AS "MinAmount",
              max_amount AS "MaxAmount",
              approval_route AS "ApprovalRoute",
              approval_authority_code AS "ApprovalAuthorityCode",
              approval_authority_label AS "ApprovalAuthorityLabel",
              requires_cgis_approval AS "RequiresCgisApproval",
              requires_board AS "RequiresBoard",
              requires_bpp AS "RequiresBpp",
              governance_body_id AS "GovernanceBodyId",
              governance_body_name AS "GovernanceBodyName",
              status AS "Status",
              notes AS "Notes",
              created_at AS "CreatedAt",
              updated_at AS "UpdatedAt"
       FROM procurement_workflow.approval_thresholds
       ORDER BY min_amount ASC`
    );
    res.json({ Thresholds: result.rows });
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// POST /api/config/workflows/thresholds
workflowConfigRouter.post('/api/config/workflows/thresholds', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const {
      ThresholdName, ProcurementType, MinAmount, MaxAmount, ApprovalRoute,
      ApprovalAuthorityCode, ApprovalAuthorityLabel, RequiresCgisApproval,
      RequiresBoard, RequiresBpp, GovernanceBodyId, GovernanceBodyName,
      Status, Notes
    } = req.body;
    const result = await pool.query(
      `INSERT INTO procurement_workflow.approval_thresholds
        (threshold_name, procurement_type, min_amount, max_amount, approval_route,
         approval_authority_code, approval_authority_label, requires_cgis_approval,
         requires_board, requires_bpp, governance_body_id, governance_body_name,
         status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING threshold_id AS "ThresholdId",
                 threshold_name AS "ThresholdName",
                 procurement_type AS "ProcurementType",
                 min_amount AS "MinAmount",
                 max_amount AS "MaxAmount",
                 approval_route AS "ApprovalRoute",
                 approval_authority_code AS "ApprovalAuthorityCode",
                 approval_authority_label AS "ApprovalAuthorityLabel",
                 requires_cgis_approval AS "RequiresCgisApproval",
                 requires_board AS "RequiresBoard",
                 requires_bpp AS "RequiresBpp",
                 governance_body_id AS "GovernanceBodyId",
                 governance_body_name AS "GovernanceBodyName",
                 status AS "Status",
                 notes AS "Notes",
                 created_at AS "CreatedAt",
                 updated_at AS "UpdatedAt"`,
      [
        ThresholdName, ProcurementType, MinAmount, MaxAmount, ApprovalRoute,
        ApprovalAuthorityCode, ApprovalAuthorityLabel, RequiresCgisApproval || false,
        RequiresBoard || false, RequiresBpp || false, GovernanceBodyId || null,
        GovernanceBodyName || null, Status || 'Active', Notes || ''
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// PUT /api/config/workflows/thresholds/:id
workflowConfigRouter.put('/api/config/workflows/thresholds/:id', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { id } = req.params;
    const {
      ThresholdName, ProcurementType, MinAmount, MaxAmount, ApprovalRoute,
      ApprovalAuthorityCode, ApprovalAuthorityLabel, RequiresCgisApproval,
      RequiresBoard, RequiresBpp, GovernanceBodyId, GovernanceBodyName,
      Status, Notes
    } = req.body;
    const result = await pool.query(
      `UPDATE procurement_workflow.approval_thresholds SET
        threshold_name = COALESCE($1, threshold_name),
        procurement_type = COALESCE($2, procurement_type),
        min_amount = COALESCE($3, min_amount),
        max_amount = COALESCE($4, max_amount),
        approval_route = COALESCE($5, approval_route),
        approval_authority_code = COALESCE($6, approval_authority_code),
        approval_authority_label = COALESCE($7, approval_authority_label),
        requires_cgis_approval = COALESCE($8, requires_cgis_approval),
        requires_board = COALESCE($9, requires_board),
        requires_bpp = COALESCE($10, requires_bpp),
        governance_body_id = COALESCE($11, governance_body_id),
        governance_body_name = COALESCE($12, governance_body_name),
        status = COALESCE($13, status),
        notes = COALESCE($14, notes),
        updated_at = NOW()
       WHERE threshold_id = $15
       RETURNING threshold_id AS "ThresholdId",
                 threshold_name AS "ThresholdName",
                 procurement_type AS "ProcurementType",
                 min_amount AS "MinAmount",
                 max_amount AS "MaxAmount",
                 approval_route AS "ApprovalRoute",
                 approval_authority_code AS "ApprovalAuthorityCode",
                 approval_authority_label AS "ApprovalAuthorityLabel",
                 requires_cgis_approval AS "RequiresCgisApproval",
                 requires_board AS "RequiresBoard",
                 requires_bpp AS "RequiresBpp",
                 governance_body_id AS "GovernanceBodyId",
                 governance_body_name AS "GovernanceBodyName",
                 status AS "Status",
                 notes AS "Notes",
                 created_at AS "CreatedAt",
                 updated_at AS "UpdatedAt"`,
      [
        ThresholdName || null, ProcurementType || null, MinAmount ?? null,
        MaxAmount ?? null, ApprovalRoute || null, ApprovalAuthorityCode || null,
        ApprovalAuthorityLabel || null, RequiresCgisApproval ?? null,
        RequiresBoard ?? null, RequiresBpp ?? null, GovernanceBodyId || null,
        GovernanceBodyName || null, Status || null, Notes || null, id
      ]
    );
    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Threshold not found.' }); return; }
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// DELETE /api/config/workflows/thresholds/:id
workflowConfigRouter.delete('/api/config/workflows/thresholds/:id', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM procurement_workflow.approval_thresholds WHERE threshold_id = $1 RETURNING threshold_id AS "ThresholdId"',
      [id]
    );
    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Threshold not found.' }); return; }
    res.json({ Status: 'Deleted', ThresholdId: result.rows[0].ThresholdId });
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// PUT /api/config/workflows/stages/:stageKey
workflowConfigRouter.put('/api/config/workflows/stages/:stageKey', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { stageKey } = req.params;
    const { StageTitle, Module } = req.body;
    const result = await pool.query(
      `UPDATE procurement_workflow.workflow_stage_catalog SET
        stage_title = COALESCE($1, stage_title),
        module = COALESCE($2, module)
       WHERE stage_key = $3
       RETURNING stage_key AS "StageKey",
                 stage_title AS "StageTitle",
                 phase_key AS "PhaseKey",
                 module AS "Module",
                 is_initial AS "IsInitial",
                 is_terminal AS "IsTerminal",
                 sort_order AS "SortOrder"`,
      [StageTitle || null, Module || null, stageKey]
    );
    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Stage not found.' }); return; }
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// POST /api/config/workflows/transitions
workflowConfigRouter.post('/api/config/workflows/transitions', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { FromStageKey, ToStageKey, TransitionCondition, RequiresApproval } = req.body;
    if (!FromStageKey || !ToStageKey) { res.status(400).json({ ErrorMessage: 'FromStageKey and ToStageKey are required.' }); return; }
    const result = await pool.query(
      `INSERT INTO procurement_workflow.workflow_stage_transitions
        (from_stage_key, to_stage_key, transition_condition, requires_approval)
       VALUES ($1, $2, $3, $4)
       RETURNING from_stage_key AS "FromStageKey",
                 to_stage_key AS "ToStageKey",
                 transition_condition AS "TransitionCondition",
                 requires_approval AS "RequiresApproval"`,
      [FromStageKey, ToStageKey, TransitionCondition || '', RequiresApproval || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// DELETE /api/config/workflows/transitions/:id — id is "fromStageKey-toStageKey" composite
workflowConfigRouter.delete('/api/config/workflows/transitions/:id', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { id } = req.params;
    const parts = id.split('-to-');
    if (parts.length !== 2) { res.status(400).json({ ErrorMessage: 'Invalid transition ID format. Expected "fromStageKey-to-toStageKey".' }); return; }
    const result = await pool.query(
      `DELETE FROM procurement_workflow.workflow_stage_transitions
       WHERE from_stage_key = $1 AND to_stage_key = $2
       RETURNING from_stage_key AS "FromStageKey"`,
      [parts[0], parts[1]]
    );
    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Transition not found.' }); return; }
    res.json({ Status: 'Deleted', TransitionId: id });
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// POST /api/config/workflows/role-tasks
workflowConfigRouter.post('/api/config/workflows/role-tasks', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { RoleKey, StageKey, TaskDescription, IsRequired } = req.body;
    if (!RoleKey || !StageKey) { res.status(400).json({ ErrorMessage: 'RoleKey and StageKey are required.' }); return; }
    const result = await pool.query(
      `INSERT INTO procurement_workflow.workflow_role_tasks
        (role_key, stage_key, task_description, is_required)
       VALUES ($1, $2, $3, $4)
       RETURNING role_task_id AS "RoleTaskId",
                 role_key AS "RoleKey",
                 stage_key AS "StageKey",
                 task_description AS "TaskDescription",
                 is_required AS "IsRequired"`,
      [RoleKey, StageKey, TaskDescription || '', IsRequired || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// DELETE /api/config/workflows/role-tasks/:id
workflowConfigRouter.delete('/api/config/workflows/role-tasks/:id', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_workflow_config');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM procurement_workflow.workflow_role_tasks WHERE role_task_id = $1 RETURNING role_task_id AS "RoleTaskId"',
      [id]
    );
    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Role task not found.' }); return; }
    res.json({ Status: 'Deleted', RoleTaskId: result.rows[0].RoleTaskId });
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});
