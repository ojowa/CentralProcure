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
    const { Year, Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (Year) { conditions.push(`ya.fiscal_year = $${idx}`); values.push(Year); idx++; }
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
        ya.fiscal_year AS "FiscalYear",
        ya.title AS "Title",
        ya.status AS "Status",
        COALESCE((
          SELECT COUNT(*) FROM procurement_workflow.procurement_plans pp WHERE pp.yearly_app_id = ya.yearly_app_id
        ), 0) AS "PlansCount",
        COALESCE((
          SELECT COUNT(*) FROM procurement_workflow.procurement_plans pp
          WHERE pp.yearly_app_id = ya.yearly_app_id AND pp.status = 'Approved'
        ), 0) AS "IncludedPlansCount",
        COALESCE((
          SELECT COUNT(*) FROM procurement_workflow.procurement_plans pp
          WHERE pp.yearly_app_id = ya.yearly_app_id AND pp.status != 'Approved'
        ), 0) AS "PendingPlansCount",
        COALESCE((
          SELECT SUM(pi.estimated_cost) FROM procurement_workflow.procurement_plan_items pi
          JOIN procurement_workflow.procurement_plans pp ON pp.plan_id = pi.plan_id
          WHERE pp.yearly_app_id = ya.yearly_app_id
        ), 0) AS "TotalBudget",
        COALESCE((
          SELECT COUNT(*) FROM procurement_workflow.procurement_plan_items pi
          JOIN procurement_workflow.procurement_plans pp ON pp.plan_id = pi.plan_id
          WHERE pp.yearly_app_id = ya.yearly_app_id
        ), 0) AS "ItemsCount",
        ya.created_at AS "CreatedAt",
        ya.updated_at AS "UpdatedAt"
       FROM procurement_workflow.yearly_apps ya
       ${whereClause}
       ORDER BY ya.fiscal_year DESC, ya.created_at DESC
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
        ya.fiscal_year AS "FiscalYear",
        ya.title AS "Title",
        ya.notes AS "Notes",
        ya.status AS "Status",
        ya.submitted_at AS "SubmittedAt",
        ya.approved_at AS "ApprovedAt",
        ya.created_at AS "CreatedAt",
        ya.updated_at AS "UpdatedAt"
       FROM procurement_workflow.yearly_apps ya
       WHERE ya.yearly_app_id = $1`, [yearlyAppId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Yearly APP not found.' }); return;
    }

    const app = result.rows[0];

    const plansResult = await pool.query(
      `SELECT
        pp.plan_id AS "PlanId",
        pp.plan_title AS "PlanTitle",
        pp.department AS "Department",
        pp.fiscal_year AS "FiscalYear",
        pp.status AS "Status",
        COALESCE((
          SELECT wi.current_stage_key FROM procurement_workflow.workflow_instances wi
          WHERE wi.entity_type = 'procurement_plan' AND wi.entity_id = pp.plan_id
          ORDER BY wi.created_at DESC LIMIT 1
        ), '') AS "CurrentStageKey",
        COALESCE((
          SELECT wi.current_stage_title FROM procurement_workflow.workflow_instances wi
          WHERE wi.entity_type = 'procurement_plan' AND wi.entity_id = pp.plan_id
          ORDER BY wi.created_at DESC LIMIT 1
        ), '') AS "CurrentStageTitle",
        COALESCE((
          SELECT SUM(pi.estimated_cost) FROM procurement_workflow.procurement_plan_items pi WHERE pi.plan_id = pp.plan_id
        ), 0) AS "TotalBudget",
        COALESCE((
          SELECT COUNT(*) FROM procurement_workflow.procurement_plan_items pi WHERE pi.plan_id = pp.plan_id
        ), 0) AS "ItemCount",
        pp.created_at AS "CreatedAt"
       FROM procurement_workflow.procurement_plans pp
       WHERE pp.yearly_app_id = $1
       ORDER BY pp.created_at DESC`, [yearlyAppId]
    );

    const includedPlans = plansResult.rows.filter((p: any) => p.Status === 'Approved');
    const pendingPlans = plansResult.rows.filter((p: any) => p.Status !== 'Approved');

    res.json({
      App: {
        ...app,
        TotalBudget: plansResult.rows.reduce((sum: number, p: any) => sum + (parseFloat(p.TotalBudget) || 0), 0),
        PlansCount: plansResult.rows.length,
        IncludedPlansCount: includedPlans.length,
        PendingPlansCount: pendingPlans.length,
        ItemsCount: plansResult.rows.reduce((sum: number, p: any) => sum + (parseInt(p.ItemCount) || 0), 0),
      },
      IncludedPlans: includedPlans,
      PendingPlans: pendingPlans,
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
    const { Year, Title, Notes, Items } = req.body;

    if (!Year || !Title) {
      res.status(400).json({ ErrorMessage: 'Year and Title are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.yearly_apps
        (fiscal_year, title, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'Draft', NOW(), NOW())
       RETURNING
        yearly_app_id AS "YearlyAppId",
        fiscal_year AS "Year",
        title AS "Title",
        status AS "Status",
        created_at AS "CreatedAt"`,
      [Year, Title, Notes || '']
    );

    const app = result.rows[0];

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
    const { Title, Notes, Year, Status } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.yearly_apps
       SET
        title = COALESCE(NULLIF($1, ''), title),
        notes = COALESCE(NULLIF($2, ''), notes),
        fiscal_year = COALESCE(NULLIF($3, '')::int, fiscal_year),
        status = COALESCE(NULLIF($4, ''), status),
        updated_at = NOW()
       WHERE yearly_app_id = $5
       RETURNING
        yearly_app_id AS "YearlyAppId",
        fiscal_year AS "Year",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [Title || '', Notes || '', Year || '', Status || '', yearlyAppId]
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
        fiscal_year AS "Year",
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

    const app = appResult.rows[0];
    const isReady = app.status === 'Submitted';

    res.json({
      YearlyAppId: yearlyAppId,
      Status: app.status,
      IsReadyForRecommendation: isReady,
      TotalItems: 0,
      ItemsWithCost: 0,
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
        fiscal_year AS "Year",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [yearlyAppId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'APP not found or cannot be recommended in current status.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recommending the yearly APP.' });
  }
});
