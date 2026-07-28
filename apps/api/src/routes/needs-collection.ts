import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const needsCollectionRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/needs-collection
// ─────────────────────────────────────────────
needsCollectionRouter.get('/api/needs-collection', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Status, DepartmentId, Year, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (Status) { conditions.push(`nc.status = $${idx}`); values.push(Status); idx++; }
    if (DepartmentId) { conditions.push(`nc.department_id = $${idx}`); values.push(DepartmentId); idx++; }
    if (Year) { conditions.push(`nc.year = $${idx}`); values.push(Year); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.needs_collection nc
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        nc.needs_id AS "NeedsId",
        nc.title AS "Title",
        nc.description AS "Description",
        nc.year AS "Year",
        nc.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
        nc.status AS "Status",
        nc.created_by AS "CreatedBy",
        nc.created_at AS "CreatedAt",
        nc.updated_at AS "UpdatedAt"
       FROM procurement_workflow.needs_collection nc
       LEFT JOIN identity.organizational_units d ON nc.department_id = d.unit_id
       ${whereClause}
       ORDER BY nc.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Needs: result.rows,
      TotalCount: totalCount,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching needs collection.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/needs-collection/:id
// ─────────────────────────────────────────────
needsCollectionRouter.get('/api/needs-collection/:id', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        nc.needs_id AS "NeedsId",
        nc.title AS "Title",
        nc.description AS "Description",
        nc.year AS "Year",
        nc.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
        nc.status AS "Status",
        nc.justification AS "Justification",
        nc.created_by AS "CreatedBy",
        nc.created_at AS "CreatedAt",
        nc.updated_at AS "UpdatedAt"
       FROM procurement_workflow.needs_collection nc
       LEFT JOIN identity.organizational_units d ON nc.department_id = d.unit_id
       WHERE nc.needs_id = $1`, [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Needs collection not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT * FROM procurement_workflow.needs_collection_items WHERE needs_id = $1 ORDER BY item_id`, [id]
    );

    res.json({
      ...result.rows[0],
      Items: itemsResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching needs collection detail.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/needs-collection
// ─────────────────────────────────────────────
needsCollectionRouter.post('/api/needs-collection', async (req, res) => {
  const auth = await requirePermission(req, 'needs.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Title, Description, Year, DepartmentId, Justification, Items } = req.body;

    if (!Title || !Year) {
      res.status(400).json({ ErrorMessage: 'Title and Year are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.needs_collection
        (title, description, year, department_id, justification, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'Draft', $6, NOW(), NOW())
       RETURNING
        needs_id AS "NeedsId",
        title AS "Title",
        year AS "Year",
        status AS "Status",
        created_at AS "CreatedAt"`,
      [Title, Description || '', Year, DepartmentId || null, Justification || '', auth!.sub]
    );

    const needs = result.rows[0];

    if (Array.isArray(Items) && Items.length > 0) {
      for (const item of Items) {
        await pool.query(
          `INSERT INTO procurement_workflow.needs_collection_items
            (needs_id, description, estimated_cost, unit, quantity, justification, category, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [needs.NeedsId, item.Description || '', item.EstimatedCost || 0,
           item.Unit || '', item.Quantity || 1, item.Justification || '', item.Category || '']
        );
      }
    }

    res.status(201).json(needs);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating needs collection.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/needs-collection/:id
// ─────────────────────────────────────────────
needsCollectionRouter.put('/api/needs-collection/:id', async (req, res) => {
  const auth = await requirePermission(req, 'needs.update');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Title, Description, Year, DepartmentId, Justification, Status } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.needs_collection
       SET
        title = COALESCE(NULLIF($1, ''), title),
        description = COALESCE(NULLIF($2, ''), description),
        year = COALESCE(NULLIF($3, ''), year),
        department_id = COALESCE($4, department_id),
        justification = COALESCE(NULLIF($5, ''), justification),
        status = COALESCE(NULLIF($6, ''), status),
        updated_at = NOW()
       WHERE needs_id = $7
       RETURNING
        needs_id AS "NeedsId",
        title AS "Title",
        year AS "Year",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [Title || '', Description || '', Year || '', DepartmentId || null,
       Justification || '', Status || '', id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Needs collection not found or update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating needs collection.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/needs-collection/:id/decision
// ─────────────────────────────────────────────
needsCollectionRouter.post('/api/needs-collection/:id/decision', async (req, res) => {
  const auth = await requirePermission(req, 'needs.endorse');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    const newStatus = Decision === 'Approved' ? 'Approved' :
                      Decision === 'Returned' ? 'Returned' : 'Rejected';

    const result = await pool.query(
      `UPDATE procurement_workflow.needs_collection
       SET status = $1, updated_at = NOW()
       WHERE needs_id = $2
       RETURNING
        needs_id AS "NeedsId",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [newStatus, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Needs collection not found.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.needs_collection_decisions
        (needs_id, decision, comments, decided_by, decided_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, Decision, Comments || '', auth!.sub]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting the decision.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/needs-collection/authorized-users
// ─────────────────────────────────────────────
needsCollectionRouter.get('/api/needs-collection/authorized-users', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        iu.internal_user_id AS "InternalUserId",
        iu.first_name || ' ' || iu.surname AS "FullName",
        iu.email AS "Email",
        iu.role AS "Role",
        ou.unit_name AS "UnitName"
       FROM identity.internal_users iu
       LEFT JOIN identity.organizational_units ou ON iu.unit_id = ou.unit_id
       WHERE iu.status = 'Active'
       ORDER BY iu.surname, iu.first_name`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching authorized users.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/needs-collection/analysis
// ─────────────────────────────────────────────
needsCollectionRouter.get('/api/needs-collection/analysis', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Year } = req.query;

    let yearFilter = '';
    const values: unknown[] = [];
    if (Year) { yearFilter = 'WHERE nc.year = $1'; values.push(Year); }

    const result = await pool.query(
      `SELECT
        nc.year AS "Year",
        d.department_name AS "DepartmentName",
        COUNT(*) AS "TotalNeeds",
        COUNT(CASE WHEN nc.status = 'Approved' THEN 1 END) AS "ApprovedCount",
        COUNT(CASE WHEN nc.status = 'Rejected' THEN 1 END) AS "RejectedCount",
        COUNT(CASE WHEN nc.status = 'Draft' THEN 1 END) AS "DraftCount",
        COALESCE(SUM(
          (SELECT COALESCE(SUM(nci.estimated_cost), 0)
           FROM procurement_workflow.needs_collection_items nci
           WHERE nci.needs_id = nc.needs_id)
        ), 0) AS "TotalEstimatedCost"
       FROM procurement_workflow.needs_collection nc
       LEFT JOIN identity.organizational_units d ON nc.department_id = d.unit_id
       ${yearFilter}
       GROUP BY nc.year, d.department_name
       ORDER BY nc.year DESC, d.department_name`,
      values
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching needs analysis.' });
  }
});
