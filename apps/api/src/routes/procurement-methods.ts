import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const procurementMethodsRouter = Router();

// ─────────────────────────────────────────────
// GET /api/procurement-methods/queue
// ─────────────────────────────────────────────
procurementMethodsRouter.get('/api/procurement-methods/queue', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.record_title AS "RecordTitle",
        wi.current_stage_key AS "CurrentStageKey",
        wsc.stage_title AS "CurrentStageTitle",
        wi.amount AS "Amount",
        at.procurement_type AS "ProcurementType",
        at.approval_route AS "ApprovalRoute",
        at.approval_authority_label AS "ApprovalAuthorityLabel",
        pm.method_determined AS "SelectedMethod",
        pm.determined_at AS "LastDeterminedAt",
        me.status AS "ActiveExceptionStatus"
       FROM procurement_workflow.workflow_instances wi
       LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
         ON wsc.stage_key = wi.current_stage_key
       LEFT JOIN procurement_workflow.approval_thresholds at
         ON at.procurement_type = wi.entity_type
         AND wi.amount >= at.min_amount
         AND (at.max_amount IS NULL OR wi.amount <= at.max_amount)
         AND at.status = 'Active'
       LEFT JOIN procurement_workflow.procurement_methods pm
         ON pm.entity_type = wi.entity_type AND pm.entity_id = wi.entity_id
       LEFT JOIN procurement_workflow.method_exceptions me
         ON me.entity_type = wi.entity_type AND me.entity_id = wi.entity_id AND me.status = 'Pending'
       WHERE pm.method_id IS NULL
       ORDER BY wi.amount DESC NULLS LAST`
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching procurement methods queue.' });
  }
});

// ─────────────────────────────────────────────
// LITERAL ROUTES (must come before :param routes)
// ─────────────────────────────────────────────

// GET /api/procurement-methods/exceptions/queue
procurementMethodsRouter.get('/api/procurement-methods/exceptions/queue', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (Status) { conditions.push(`me.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.method_exceptions me
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        me.exception_id AS "ExceptionId",
        me.entity_type AS "EntityType",
        me.entity_id AS "EntityId",
        me.entity_title AS "RecordTitle",
        me.requested_method AS "RequestedMethod",
        me.justification AS "RequestReason",
        me.reason AS "Reason",
        me.status AS "Status",
        me.requested_by AS "RequestedBy",
        me.requested_at AS "RequestedAt",
        me.decided_at AS "DecidedAt",
        wi.current_stage_key AS "CurrentStageKey",
        wsc.stage_title AS "CurrentStageTitle",
        wi.amount AS "Amount",
        pm.method_determined AS "CurrentMethod"
       FROM procurement_workflow.method_exceptions me
       LEFT JOIN procurement_workflow.workflow_instances wi
         ON wi.entity_type = me.entity_type AND wi.entity_id = me.entity_id
       LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
         ON wsc.stage_key = wi.current_stage_key
       LEFT JOIN procurement_workflow.procurement_methods pm
         ON pm.entity_type = me.entity_type AND pm.entity_id = me.entity_id
       ${whereClause}
       ORDER BY me.requested_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Items: result.rows,
      TotalCount: totalCount,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching exception queue.' });
  }
});

// ─────────────────────────────────────────────
// PARAMETERIZED ROUTES (after literal routes)
// ─────────────────────────────────────────────

// GET /api/procurement-methods/:entityType/:entityId
procurementMethodsRouter.get('/api/procurement-methods/:entityType/:entityId', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { entityType, entityId } = req.params;

    const instResult = await pool.query(
      `SELECT
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.record_title AS "RecordTitle",
        wi.current_stage_key AS "CurrentStageKey",
        wsc.stage_title AS "CurrentStageTitle",
        wi.amount AS "Amount"
       FROM procurement_workflow.workflow_instances wi
       LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
         ON wsc.stage_key = wi.current_stage_key
       WHERE wi.entity_type = $1 AND wi.entity_id = $2`,
      [entityType, entityId]
    );

    if (instResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Entity not found.' }); return;
    }

    const inst = instResult.rows[0];

    const thresholdResult = await pool.query(
      `SELECT
        procurement_type AS "ProcurementType",
        approval_route AS "ApprovalRoute",
        approval_authority_label AS "ApprovalAuthorityLabel",
        requires_cgis_approval AS "RequiresCgisApproval",
        requires_board AS "RequiresBoard",
        requires_bpp AS "RequiresBpp"
       FROM procurement_workflow.approval_thresholds
       WHERE procurement_type = $1
         AND $2 >= min_amount
         AND (max_amount IS NULL OR $2 <= max_amount)
         AND status = 'Active'
       ORDER BY min_amount DESC LIMIT 1`,
      [entityType, inst.Amount]
    );

    const threshold = thresholdResult.rows[0] || {};

    const methodResult = await pool.query(
      `SELECT
        method_determined AS "SelectedMethod",
        justification AS "DecisionReason",
        determined_by AS "DeterminedBy",
        determined_at AS "DeterminedAt",
        CASE WHEN status = 'Overridden' THEN true ELSE false END AS "IsExceptionDecision"
       FROM procurement_workflow.procurement_methods
       WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId]
    );

    const exceptionResult = await pool.query(
      `SELECT
        exception_id AS "ExceptionId",
        (SELECT method_determined FROM procurement_workflow.procurement_methods WHERE entity_type = $1 AND entity_id = $2) AS "CurrentMethod",
        requested_method AS "RequestedMethod",
        justification AS "RequestReason",
        status AS "Status"
       FROM procurement_workflow.method_exceptions
       WHERE entity_type = $1 AND entity_id = $2 AND status = 'Pending'
       ORDER BY requested_at DESC LIMIT 1`,
      [entityType, entityId]
    );

    res.json({
      EntityType: inst.EntityType,
      EntityId: inst.EntityId,
      RecordTitle: inst.RecordTitle,
      CurrentStageKey: inst.CurrentStageKey,
      CurrentStageTitle: inst.CurrentStageTitle,
      Amount: inst.Amount,
      ProcurementType: threshold.ProcurementType || null,
      ApprovalRoute: threshold.ApprovalRoute || null,
      ApprovalAuthorityLabel: threshold.ApprovalAuthorityLabel || null,
      RequiresCgisApproval: threshold.RequiresCgisApproval || false,
      RequiresBoard: threshold.RequiresBoard || false,
      RequiresBpp: threshold.RequiresBpp || false,
      CurrentDecision: methodResult.rows[0] || null,
      ActiveException: exceptionResult.rows[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the procurement method.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-methods/determine
// ─────────────────────────────────────────────
procurementMethodsRouter.post('/api/procurement-methods/determine', async (req, res) => {
  const auth = await requirePermission(req, 'method.determine');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { EntityType, EntityId, EntityTitle, MethodDetermined, EstimatedValue, Justification } = req.body;

    if (!EntityType || !EntityId || !MethodDetermined) {
      res.status(400).json({ ErrorMessage: 'EntityType, EntityId, and MethodDetermined are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.procurement_methods
        (entity_type, entity_id, entity_title, method_determined, estimated_value, justification, status, determined_by, determined_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Determined', $7, NOW(), NOW(), NOW())
       ON CONFLICT (entity_type, entity_id)
       DO UPDATE SET
        method_determined = $4,
        estimated_value = $5,
        justification = $6,
        status = 'Determined',
        determined_by = $7,
        determined_at = NOW(),
        updated_at = NOW()
       RETURNING
        method_id AS "MethodId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        method_determined AS "MethodDetermined",
        status AS "Status",
        determined_at AS "DeterminedAt"`,
      [EntityType, EntityId, EntityTitle || '', MethodDetermined, EstimatedValue || 0,
       Justification || '', auth!.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recording method determination.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-methods/request-exception
// ─────────────────────────────────────────────
procurementMethodsRouter.post('/api/procurement-methods/request-exception', async (req, res) => {
  const auth = await requirePermission(req, 'method.exception_request');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { EntityType, EntityId, EntityTitle, RequestedMethod, Justification, Reason } = req.body;

    if (!EntityType || !EntityId || !RequestedMethod || !Justification) {
      res.status(400).json({ ErrorMessage: 'EntityType, EntityId, RequestedMethod, and Justification are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.method_exceptions
        (entity_type, entity_id, entity_title, requested_method, justification, reason, status, requested_by, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, NOW())
       RETURNING
        exception_id AS "ExceptionId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        requested_method AS "RequestedMethod",
        status AS "Status",
        requested_at AS "RequestedAt"`,
      [EntityType, EntityId, EntityTitle || '', RequestedMethod, Justification, Reason || '', auth!.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred requesting exception.' });
  }
});

// POST /api/procurement-methods/exceptions/:action
procurementMethodsRouter.post('/api/procurement-methods/exceptions/:action', async (req, res) => {
  const auth = await requirePermission(req, 'method.exception_approve');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { action } = req.params;
    const { ExceptionId, Note } = req.body;

    if (!ExceptionId) {
      res.status(400).json({ ErrorMessage: 'ExceptionId is required.' }); return;
    }

    let newStatus: string;
    if (action === 'approve') { newStatus = 'Approved'; }
    else if (action === 'reject') { newStatus = 'Rejected'; }
    else if (action === 'return') { newStatus = 'Returned'; }
    else {
      res.status(400).json({ ErrorMessage: 'Action must be approve, reject, or return.' }); return;
    }

    const result = await pool.query(
      `UPDATE procurement_workflow.method_exceptions
       SET status = $1, decided_by = $2, decided_at = NOW(), decision_comments = $3
       WHERE exception_id = $4 AND status = 'Pending'
       RETURNING
        exception_id AS "ExceptionId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        requested_method AS "RequestedMethod",
        status AS "Status",
        decided_at AS "DecidedAt"`,
      [newStatus, auth!.sub, Note || '', ExceptionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Exception not found or already decided.' }); return;
    }

    if (newStatus === 'Approved') {
      const exc = result.rows[0];
      await pool.query(
        `INSERT INTO procurement_workflow.procurement_methods
          (entity_type, entity_id, entity_title, method_determined, status, determined_by, determined_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'Determined', $5, NOW(), NOW(), NOW())
         ON CONFLICT (entity_type, entity_id)
         DO UPDATE SET method_determined = $4, status = 'Determined', determined_by = $5, determined_at = NOW(), updated_at = NOW()`,
        [exc.EntityType, exc.EntityId, exc.EntityTitle || '', exc.RequestedMethod, auth!.sub]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred processing the exception decision.' });
  }
});
