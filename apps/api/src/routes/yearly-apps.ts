import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const yearlyAppsRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/yearly-apps
// ─────────────────────────────────────────────
yearlyAppsRouter.get('/api/yearly-apps', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Year, DepartmentId, Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (Year) { conditions.push(`ya.year = $${idx}`); values.push(Year); idx++; }
    if (DepartmentId) { conditions.push(`ya.department_id = $${idx}`); values.push(DepartmentId); idx++; }
    if (Status) { conditions.push(`ya.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.yearly_apps ya
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        ya.yearly_app_id AS "YearlyAppId",
        ya.year AS "Year",
        ya.title AS "Title",
        ya.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
        ya.status AS "Status",
        ya.created_by AS "CreatedBy",
        ya.created_at AS "CreatedAt",
        ya.updated_at AS "UpdatedAt",
        (SELECT COUNT(*) FROM procurement_workflow.yearly_app_items yai WHERE yai.yearly_app_id = ya.yearly_app_id) AS "TotalItems"
       FROM procurement_workflow.yearly_apps ya
       LEFT JOIN identity.organizational_units d ON ya.department_id = d.unit_id
       ${whereClause}
       ORDER BY ya.year DESC, ya.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      YearlyApps: result.rows,
      TotalCount: totalCount,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching yearly APPs.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/yearly-apps/:yearlyAppId
// ─────────────────────────────────────────────
yearlyAppsRouter.get('/api/yearly-apps/:yearlyAppId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { yearlyAppId } = req.params;

    const result = await pool.query(
      `SELECT
        ya.yearly_app_id AS "YearlyAppId",
        ya.year AS "Year",
        ya.title AS "Title",
        ya.description AS "Description",
        ya.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
        ya.status AS "Status",
        ya.created_by AS "CreatedBy",
        ya.created_at AS "CreatedAt",
        ya.updated_at AS "UpdatedAt"
       FROM procurement_workflow.yearly_apps ya
       LEFT JOIN identity.organizational_units d ON ya.department_id = d.unit_id
       WHERE ya.yearly_app_id = $1`, [yearlyAppId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Yearly APP not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT
        yai.item_id AS "ItemId",
        yai.description AS "Description",
        yai.estimated_cost AS "EstimatedCost",
        yai.approved_budget AS "ApprovedBudget",
        yai.funding_source AS "FundingSource",
        yai.item_category AS "ItemCategory",
        yai.status AS "Status"
       FROM procurement_workflow.yearly_app_items yai
       WHERE yai.yearly_app_id = $1
       ORDER BY yai.item_id`, [yearlyAppId]
    );

    res.json({
      ...result.rows[0],
      Items: itemsResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the yearly APP.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/yearly-apps
// ─────────────────────────────────────────────
yearlyAppsRouter.post('/api/yearly-apps', async (req, res) => {
  const auth = await requirePermission(req, 'annual_plan.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Year, Title, Description, DepartmentId, Items } = req.body;

    if (!Year || !Title) {
      res.status(400).json({ ErrorMessage: 'Year and Title are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.yearly_apps
        (year, title, description, department_id, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Draft', $5, NOW(), NOW())
       RETURNING
        yearly_app_id AS "YearlyAppId",
        year AS "Year",
        title AS "Title",
        status AS "Status",
        created_at AS "CreatedAt"`,
      [Year, Title, Description || '', DepartmentId || null, auth!.sub]
    );

    const app = result.rows[0];

    if (Array.isArray(Items) && Items.length > 0) {
      for (const item of Items) {
        await pool.query(
          `INSERT INTO procurement_workflow.yearly_app_items
            (yearly_app_id, description, estimated_cost, approved_budget, funding_source, item_category, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'Draft', NOW())`,
          [app.YearlyAppId, item.Description || '', item.EstimatedCost || 0,
           item.ApprovedBudget || 0, item.FundingSource || '', item.ItemCategory || '']
        );
      }
    }

    res.status(201).json(app);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the yearly APP.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/yearly-apps/:yearlyAppId
// ─────────────────────────────────────────────
yearlyAppsRouter.put('/api/yearly-apps/:yearlyAppId', async (req, res) => {
  const auth = await requirePermission(req, 'annual_plan.update');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { yearlyAppId } = req.params;
    const { Title, Description, DepartmentId, Year, Status } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.yearly_apps
       SET
        title = COALESCE(NULLIF($1, ''), title),
        description = COALESCE(NULLIF($2, ''), description),
        department_id = COALESCE($3, department_id),
        year = COALESCE(NULLIF($4, ''), year),
        status = COALESCE(NULLIF($5, ''), status),
        updated_at = NOW()
       WHERE yearly_app_id = $6
       RETURNING
        yearly_app_id AS "YearlyAppId",
        year AS "Year",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [Title || '', Description || '', DepartmentId || null, Year || '', Status || '', yearlyAppId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Yearly APP not found or update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the yearly APP.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/yearly-apps/:yearlyAppId/submit
// ─────────────────────────────────────────────
yearlyAppsRouter.post('/api/yearly-apps/:yearlyAppId/submit', async (req, res) => {
  const auth = await requirePermission(req, 'annual_plan.submit');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { yearlyAppId } = req.params;

    const result = await pool.query(
      `UPDATE procurement_workflow.yearly_apps
       SET status = 'Submitted', updated_at = NOW()
       WHERE yearly_app_id = $1 AND status = 'Draft'
       RETURNING
        yearly_app_id AS "YearlyAppId",
        year AS "Year",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [yearlyAppId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'APP not found or cannot be submitted in current status.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting the yearly APP.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/yearly-apps/:yearlyAppId/recommendation-readiness
// ─────────────────────────────────────────────
yearlyAppsRouter.get('/api/yearly-apps/:yearlyAppId/recommendation-readiness', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { yearlyAppId } = req.params;

    const appResult = await pool.query(
      `SELECT yearly_app_id, status FROM procurement_workflow.yearly_apps WHERE yearly_app_id = $1`, [yearlyAppId]
    );

    if (appResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Yearly APP not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT COUNT(*) AS total_items,
              COUNT(CASE WHEN estimated_cost > 0 THEN 1 END) AS items_with_cost
       FROM procurement_workflow.yearly_app_items
       WHERE yearly_app_id = $1`, [yearlyAppId]
    );

    const totalItems = parseInt(itemsResult.rows[0]?.total_items || '0', 10);
    const itemsWithCost = parseInt(itemsResult.rows[0]?.items_with_cost || '0', 10);

    const app = appResult.rows[0];
    const isReady = app.status === 'Submitted' && totalItems > 0 && itemsWithCost === totalItems;

    res.json({
      YearlyAppId: yearlyAppId,
      Status: app.status,
      IsReadyForRecommendation: isReady,
      TotalItems: totalItems,
      ItemsWithCost: itemsWithCost,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred checking recommendation readiness.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/yearly-apps/:yearlyAppId/recommend-for-approval
// ─────────────────────────────────────────────
yearlyAppsRouter.post('/api/yearly-apps/:yearlyAppId/recommend-for-approval', async (req, res) => {
  const auth = await requirePermission(req, 'annual_plan.recommend');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { yearlyAppId } = req.params;
    const { Comments } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.yearly_apps
       SET status = 'Recommended', updated_at = NOW()
       WHERE yearly_app_id = $1 AND status = 'Submitted'
       RETURNING
        yearly_app_id AS "YearlyAppId",
        year AS "Year",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [yearlyAppId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'APP not found or cannot be recommended in current status.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.yearly_app_recommendation_history
        (yearly_app_id, recommended_by, comments, recommended_at)
       VALUES ($1, $2, $3, NOW())`,
      [yearlyAppId, auth!.sub, Comments || '']
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recommending the yearly APP.' });
  }
});
