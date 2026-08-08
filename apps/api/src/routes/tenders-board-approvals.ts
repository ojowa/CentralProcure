import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const tendersBoardApprovalsRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/tenders-board-approvals/queue
// ─────────────────────────────────────────────
tendersBoardApprovalsRouter.get('/api/tenders-board-approvals/queue', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [`wi.current_stage_key = 'tenders_board_review'`];
    const values: unknown[] = [];
    let idx = 1;

    if (Status) { conditions.push(`wi.current_status = $${idx}`); values.push(Status); idx++; }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.workflow_instances wi
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        wi.instance_id AS "ApprovalId",
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.record_title AS "EntityTitle",
        wi.current_status AS "Status",
        wi.created_at AS "SubmittedAt",
        wi.updated_at AS "DecidedAt"
       FROM procurement_workflow.workflow_instances wi
       ${whereClause}
       ORDER BY wi.created_at DESC
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
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching tenders board queue.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/tenders-board-approvals/approve
// ─────────────────────────────────────────────
tendersBoardApprovalsRouter.post('/api/tenders-board-approvals/approve', async (req, res) => {
  const auth = await requirePermission(req, 'approval.decide');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { ApprovalId, Comments } = req.body;

    if (!ApprovalId) {
      res.status(400).json({ ErrorMessage: 'ApprovalId is required.' }); return;
    }

    const result = await pool.query(
      `UPDATE procurement_workflow.workflow_instances
       SET current_status = 'Board Approved', updated_at = NOW()
       WHERE instance_id = $1 AND current_stage_key = 'tenders_board_review'
       RETURNING
        instance_id AS "ApprovalId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        record_title AS "EntityTitle",
        current_status AS "Status",
        updated_at AS "DecidedAt"`,
      [ApprovalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval not found or already decided.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.workflow_instance_history
        (instance_id, to_stage_key, stage_status, transition_source, transition_reason, actor)
       VALUES ($1, 'tenders_board_review', 'Board Approved', 'board_approval', $2, $3)`,
      [ApprovalId, Comments || 'Board approval', auth!.email || auth!.sub]
    );

    const approval = result.rows[0];

    if (approval.EntityType === 'Plan') {
      await pool.query(
        `UPDATE procurement_workflow.procurement_plans
         SET status = 'Board Approved', updated_at = NOW()
         WHERE plan_id = $1`, [approval.EntityId]
      );
    } else if (approval.EntityType === 'Tender') {
      await pool.query(
        `UPDATE vendor_sourcing.tenders
         SET status = 'Board Approved'
         WHERE tender_id = $1`, [approval.EntityId]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred approving the submission.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/tenders-board-approvals/reject
// ─────────────────────────────────────────────
tendersBoardApprovalsRouter.post('/api/tenders-board-approvals/reject', async (req, res) => {
  const auth = await requirePermission(req, 'approval.decide');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { ApprovalId, Comments } = req.body;

    if (!ApprovalId) {
      res.status(400).json({ ErrorMessage: 'ApprovalId is required.' }); return;
    }

    const result = await pool.query(
      `UPDATE procurement_workflow.workflow_instances
       SET current_status = 'Board Rejected', updated_at = NOW()
       WHERE instance_id = $1 AND current_stage_key = 'tenders_board_review'
       RETURNING
        instance_id AS "ApprovalId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        record_title AS "EntityTitle",
        current_status AS "Status",
        updated_at AS "DecidedAt"`,
      [ApprovalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval not found or already decided.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.workflow_instance_history
        (instance_id, to_stage_key, stage_status, transition_source, transition_reason, actor)
       VALUES ($1, 'tenders_board_review', 'Board Rejected', 'board_approval', $2, $3)`,
      [ApprovalId, Comments || 'Board rejection', auth!.email || auth!.sub]
    );

    const approval = result.rows[0];

    if (approval.EntityType === 'Plan') {
      await pool.query(
        `UPDATE procurement_workflow.procurement_plans
         SET status = 'Board Rejected', updated_at = NOW()
         WHERE plan_id = $1`, [approval.EntityId]
      );
    } else if (approval.EntityType === 'Tender') {
      await pool.query(
        `UPDATE vendor_sourcing.tenders
         SET status = 'Board Rejected'
         WHERE tender_id = $1`, [approval.EntityId]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred rejecting the submission.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/tenders-board-approvals/return
// ─────────────────────────────────────────────
tendersBoardApprovalsRouter.post('/api/tenders-board-approvals/return', async (req, res) => {
  const auth = await requirePermission(req, 'approval.decide');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { ApprovalId, Comments } = req.body;

    if (!ApprovalId) {
      res.status(400).json({ ErrorMessage: 'ApprovalId is required.' }); return;
    }

    const result = await pool.query(
      `UPDATE procurement_workflow.workflow_instances
       SET current_status = 'Returned', updated_at = NOW()
       WHERE instance_id = $1 AND current_stage_key = 'tenders_board_review'
       RETURNING
        instance_id AS "ApprovalId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        record_title AS "EntityTitle",
        current_status AS "Status",
        updated_at AS "DecidedAt"`,
      [ApprovalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval not found or already decided.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.workflow_instance_history
        (instance_id, to_stage_key, stage_status, transition_source, transition_reason, actor)
       VALUES ($1, 'tenders_board_review', 'Returned', 'board_approval', $2, $3)`,
      [ApprovalId, Comments || 'Returned to committee', auth!.email || auth!.sub]
    );

    const approval = result.rows[0];

    if (approval.EntityType === 'Plan') {
      await pool.query(
        `UPDATE procurement_workflow.procurement_plans
         SET status = 'Returned to Committee', updated_at = NOW()
         WHERE plan_id = $1`, [approval.EntityId]
      );
    } else if (approval.EntityType === 'Tender') {
      await pool.query(
        `UPDATE vendor_sourcing.tenders
         SET status = 'Returned'
         WHERE tender_id = $1`, [approval.EntityId]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred returning the submission.' });
  }
});
