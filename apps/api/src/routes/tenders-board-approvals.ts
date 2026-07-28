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

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (Status) { conditions.push(`tba.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.tenders_board_approvals tba
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        tba.approval_id AS "ApprovalId",
        tba.entity_type AS "EntityType",
        tba.entity_id AS "EntityId",
        tba.entity_title AS "EntityTitle",
        tba.status AS "Status",
        tba.submitted_by AS "SubmittedBy",
        tba.submitted_at AS "SubmittedAt",
        tba.decided_at AS "DecidedAt"
       FROM procurement_workflow.tenders_board_approvals tba
       ${whereClause}
       ORDER BY tba.submitted_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Approvals: result.rows,
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
      `UPDATE procurement_workflow.tenders_board_approvals
       SET status = 'Approved', decided_by = $1, decided_at = NOW(), decision_comments = $2
       WHERE approval_id = $3 AND status = 'Pending'
       RETURNING
        approval_id AS "ApprovalId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        entity_title AS "EntityTitle",
        status AS "Status",
        decided_at AS "DecidedAt"`,
      [auth!.sub, Comments || '', ApprovalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval not found or already decided.' }); return;
    }

    const approval = result.rows[0];

    if (approval.EntityType === 'Requisition') {
      await pool.query(
        `UPDATE procurement_workflow.requisitions
         SET status = 'Board Approved', updated_at = NOW()
         WHERE requisition_id = $1`, [approval.EntityId]
      );
    } else if (approval.EntityType === 'Plan') {
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
      `UPDATE procurement_workflow.tenders_board_approvals
       SET status = 'Rejected', decided_by = $1, decided_at = NOW(), decision_comments = $2
       WHERE approval_id = $3 AND status = 'Pending'
       RETURNING
        approval_id AS "ApprovalId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        entity_title AS "EntityTitle",
        status AS "Status",
        decided_at AS "DecidedAt"`,
      [auth!.sub, Comments || '', ApprovalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval not found or already decided.' }); return;
    }

    const approval = result.rows[0];

    if (approval.EntityType === 'Requisition') {
      await pool.query(
        `UPDATE procurement_workflow.requisitions
         SET status = 'Board Rejected', updated_at = NOW()
         WHERE requisition_id = $1`, [approval.EntityId]
      );
    } else if (approval.EntityType === 'Plan') {
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
      `UPDATE procurement_workflow.tenders_board_approvals
       SET status = 'Returned', decided_by = $1, decided_at = NOW(), decision_comments = $2
       WHERE approval_id = $3 AND status = 'Pending'
       RETURNING
        approval_id AS "ApprovalId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        entity_title AS "EntityTitle",
        status AS "Status",
        decided_at AS "DecidedAt"`,
      [auth!.sub, Comments || '', ApprovalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval not found or already decided.' }); return;
    }

    const approval = result.rows[0];

    if (approval.EntityType === 'Requisition') {
      await pool.query(
        `UPDATE procurement_workflow.requisitions
         SET status = 'Returned to Committee', updated_at = NOW()
         WHERE requisition_id = $1`, [approval.EntityId]
      );
    } else if (approval.EntityType === 'Plan') {
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
