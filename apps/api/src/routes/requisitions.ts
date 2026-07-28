import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const requisitionsRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/requisitions
// ─────────────────────────────────────────────
requisitionsRouter.get('/api/requisitions', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Department = (req.query.Department ?? req.query.department) as string | undefined;
    const Query = (req.query.Query ?? req.query.query) as string | undefined;
    const SortBy = (req.query.SortBy ?? req.query.sortBy) as string | undefined;
    const SortOrder = (req.query.SortOrder ?? req.query.sortOrder) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const Priority = (req.query.priority) as string | undefined;
    const DateFrom = (req.query.dateFrom) as string | undefined;
    const DateTo = (req.query.dateTo) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.get_requisitions_sp($1, $2, $3, $4, $5, $6, $7)`,
      [Status || '', Department || '', Query || '', SortBy || 'created_at',
       SortOrder || 'DESC', pageNum, pageSizeNum]
    );

    res.json({
      Requisitions: result.rows,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching requisitions.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/requisitions
// ─────────────────────────────────────────────
requisitionsRouter.post('/api/requisitions', async (req, res) => {
  const auth = await requirePermission(req, 'requisition.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Title, Description, DepartmentId, Justification, LineItems, Priority } = req.body;

    if (!Title) {
      res.status(400).json({ ErrorMessage: 'Title is required.' }); return;
    }

    const lineItemsJson = Array.isArray(LineItems) ? JSON.stringify(LineItems) : '[]';

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.create_requisition($1, $2, $3, $4, $5, $6)`,
      [Title, Description || '', DepartmentId || null, Justification || '',
       lineItemsJson, auth!.sub]
    );

    const req_ = result.rows[0];
    if (!req_ || req_.error_message) {
      res.status(400).json({ ErrorMessage: req_?.error_message || 'Failed to create requisition.' }); return;
    }

    res.status(201).json({
      RequisitionId: req_.requisition_id,
      RequisitionNumber: req_.requisition_number,
      Title: req_.title,
      Status: req_.status,
      CreatedAt: req_.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the requisition.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/requisitions/:requisitionId
// ─────────────────────────────────────────────
requisitionsRouter.get('/api/requisitions/:requisitionId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const result = await pool.query(
      `SELECT * FROM procurement_workflow.get_requisition_detail_sp($1)`, [requisitionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Requisition not found.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the requisition.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/requisitions/:requisitionId
// ─────────────────────────────────────────────
requisitionsRouter.put('/api/requisitions/:requisitionId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { Title, Description, DepartmentId, Justification, LineItems, Priority, Status } = req.body;

    const lineItemsJson = Array.isArray(LineItems) ? JSON.stringify(LineItems) : undefined;

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.update_requisition($1, $2, $3, $4, $5, $6, $7)`,
      [requisitionId, Title || '', Description || '', DepartmentId || null,
       Justification || '', lineItemsJson || null, payload.sub]
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the requisition.' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/requisitions/:requisitionId
// ─────────────────────────────────────────────
requisitionsRouter.delete('/api/requisitions/:requisitionId', async (req, res) => {
  const auth = await requirePermission(req, 'requisition.delete');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const result = await pool.query(
      `SELECT * FROM procurement_workflow.delete_requisition($1)`, [requisitionId]
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Delete failed.' }); return;
    }

    res.json({ Status: 'Deleted', RequisitionId: requisitionId });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred deleting the requisition.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/requisitions/:requisitionId/unlink-app
// ─────────────────────────────────────────────
requisitionsRouter.post('/api/requisitions/:requisitionId/unlink-app', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { ItemId } = req.body;

    if (!ItemId) {
      res.status(400).json({ ErrorMessage: 'ItemId is required.' }); return;
    }

    const result = await pool.query(
      `UPDATE procurement_workflow.requisition_items
       SET yearly_app_item_id = NULL
       WHERE requisition_id = $1 AND item_id = $2
       RETURNING item_id AS "ItemId"`,
      [requisitionId, ItemId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Requisition item not found.' }); return;
    }

    res.json({ Status: 'Unlinked', RequisitionId: requisitionId, ItemId: result.rows[0].ItemId });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred unlinking the APP item.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/requisitions/:requisitionId/department-head-review
// ─────────────────────────────────────────────
requisitionsRouter.post('/api/requisitions/:requisitionId/department-head-review', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    const newStatus = Decision === 'Approved' ? 'Dept Head Approved' :
                      Decision === 'Returned' ? 'Returned' : 'Rejected';

    const result = await pool.query(
      `UPDATE procurement_workflow.requisitions
       SET status = $1, updated_at = NOW()
       WHERE requisition_id = $2
       RETURNING
        requisition_id AS "RequisitionId",
        requisition_number AS "RequisitionNumber",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [newStatus, requisitionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Requisition not found.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.requisition_review_history
        (requisition_id, reviewer_id, decision, comments, reviewed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [requisitionId, payload.sub, Decision, Comments || '']
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred processing the department head review.' });
  }
});
