import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const procurementPlansRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/procurement-plans
// ─────────────────────────────────────────────
procurementPlansRouter.get('/api/procurement-plans', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear, Department, Status, SortBy, SortOrder, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (FiscalYear) { conditions.push(`pp.fiscal_year = $${idx}`); values.push(FiscalYear); idx++; }
    if (Department) { conditions.push(`pp.department = $${idx}`); values.push(Department); idx++; }
    if (Status) { conditions.push(`pp.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSortColumns: Record<string, string> = {
      plan_id: 'pp.plan_id', plan_number: 'pp.plan_title', title: 'pp.plan_title',
      fiscal_year: 'pp.fiscal_year', status: 'pp.status', created_at: 'pp.created_at'
    };
    const sortCol = validSortColumns[SortBy as string] || 'pp.created_at';
    const sortDir = (SortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.procurement_plans pp
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        pp.plan_id AS "PlanId",
        pp.plan_title AS "PlanNumber",
        pp.plan_title AS "Title",
        pp.notes AS "Description",
        pp.fiscal_year AS "FiscalYear",
        pp.department AS "DepartmentId",
        pp.department AS "DepartmentName",
        pp.status AS "Status",
        pp.created_by AS "CreatedBy",
        pp.created_at AS "CreatedAt",
        pp.updated_at AS "UpdatedAt",
        wi.current_status AS "WorkflowStatus",
        wi.current_stage_key AS "CurrentStageId",
        wsc.stage_title AS "CurrentStageName",
        ya.fiscal_year AS "AppYear",
        (SELECT COALESCE(SUM(ppi.estimated_cost), 0)
         FROM procurement_workflow.procurement_plan_items ppi
         WHERE ppi.plan_id = pp.plan_id) AS "TotalEstimatedCost",
        (SELECT COALESCE(SUM(ppi.approved_budget), 0)
         FROM procurement_workflow.procurement_plan_items ppi
         WHERE ppi.plan_id = pp.plan_id) AS "TotalApprovedBudget"
       FROM procurement_workflow.procurement_plans pp
       LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_id = pp.plan_id
       LEFT JOIN procurement_workflow.workflow_stage_catalog wsc ON wi.current_stage_key = wsc.stage_key
       LEFT JOIN procurement_workflow.yearly_apps ya ON pp.yearly_app_id = ya.yearly_app_id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
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
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching procurement plans.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-plans
// ─────────────────────────────────────────────
procurementPlansRouter.post('/api/procurement-plans', async (req, res) => {
  const auth = await requirePermission(req, 'procurement_plan.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Title, Description, FiscalYear, DepartmentId, YearlyAppId, Items } = req.body;
    if (!Title || !FiscalYear) {
      res.status(400).json({ ErrorMessage: 'Title and FiscalYear are required.' }); return;
    }

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.create_procurement_plan_sp($1, $2, $3, $4, $5, $6)`,
      [Title, Description || '', FiscalYear, DepartmentId || null, YearlyAppId || null, auth!.sub]
    );

    const plan = result.rows[0];
    if (!plan || plan.error_message) {
      res.status(400).json({ ErrorMessage: plan?.error_message || 'Failed to create procurement plan.' }); return;
    }

    if (Array.isArray(Items) && Items.length > 0) {
      for (const item of Items) {
        await pool.query(
          `SELECT * FROM procurement_workflow.create_procurement_plan_item_sp($1, $2, $3, $4, $5, $6, $7, $8)`,
          [plan.plan_id, item.Description || '', item.Justification || '',
           item.EstimatedCost || 0, item.ApprovedBudget || 0, item.FundingSource || '',
           item.ItemCategory || '', auth!.sub]
        );
      }
    }

    res.status(201).json({
      PlanId: plan.plan_id,
      PlanNumber: plan.plan_title,
      Title: plan.plan_title,
      FiscalYear: plan.fiscal_year,
      Status: plan.status,
      CreatedAt: plan.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the procurement plan.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/procurement-plans/:planId
// ─────────────────────────────────────────────
procurementPlansRouter.get('/api/procurement-plans/:planId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const planResult = await pool.query(
      `SELECT
        pp.plan_id AS "PlanId",
        pp.plan_title AS "PlanNumber",
        pp.plan_title AS "Title",
        pp.notes AS "Description",
        pp.fiscal_year AS "FiscalYear",
        pp.department AS "DepartmentId",
        pp.department AS "DepartmentName",
        pp.status AS "Status",
        pp.created_by AS "CreatedBy",
        pp.yearly_app_id AS "YearlyAppId",
        pp.created_at AS "CreatedAt",
        pp.updated_at AS "UpdatedAt",
        wi.current_status AS "WorkflowStatus",
        wi.current_stage_key AS "CurrentStageId",
        wsc.stage_title AS "CurrentStageName"
       FROM procurement_workflow.procurement_plans pp
       LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_id = pp.plan_id
       LEFT JOIN procurement_workflow.workflow_stage_catalog wsc ON wi.current_stage_key = wsc.stage_key
       WHERE pp.plan_id = $1`, [planId]
    );

    if (planResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Procurement plan not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT * FROM procurement_workflow.get_procurement_plan_items($1)`, [planId]
    );

    res.json({
      ...planResult.rows[0],
      Items: itemsResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the procurement plan.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/procurement-plans/:planId
// ─────────────────────────────────────────────
procurementPlansRouter.put('/api/procurement-plans/:planId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;
    const { Title, Description, FiscalYear, DepartmentId, YearlyAppId, Status } = req.body;

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.update_procurement_plan_sp($1, $2, $3, $4, $5, $6, $7)`,
      [planId, Title || '', Description || '', FiscalYear || '', DepartmentId || null, YearlyAppId || null, Status || '']
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the procurement plan.' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/procurement-plans/:planId
// ─────────────────────────────────────────────
procurementPlansRouter.delete('/api/procurement-plans/:planId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;
    const result = await pool.query(
      `SELECT * FROM procurement_workflow.delete_procurement_plan_sp($1)`, [planId]
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Delete failed.' }); return;
    }

    res.json({ Status: 'Deleted', PlanId: planId });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred deleting the procurement plan.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-plans/:planId/approval-decision
// ─────────────────────────────────────────────
procurementPlansRouter.post('/api/procurement-plans/:planId/approval-decision', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;
    const { Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    const newStatus = Decision === 'Approved' ? 'Approved' : Decision === 'Returned' ? 'Returned' : 'Rejected';

    const result = await pool.query(
       `UPDATE procurement_workflow.procurement_plans
       SET status = $1, updated_at = NOW()
       WHERE plan_id = $2
       RETURNING
        plan_id AS "PlanId",
        plan_title AS "PlanNumber",
        plan_title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [newStatus, planId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Procurement plan not found.' }); return;
    }

    if (Comments) {
      await pool.query(
        `INSERT INTO procurement_workflow.workflow_instances
          (entity_type, entity_id, record_title, last_transition_reason, updated_at)
         VALUES ('procurement_plan', $1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [planId, Decision, Comments]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred processing the approval decision.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-plans/:planId/recommend-for-approval
// ─────────────────────────────────────────────
procurementPlansRouter.post('/api/procurement-plans/:planId/recommend-for-approval', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;
    const { Comments } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.procurement_plans
       SET status = 'Recommended', updated_at = NOW()
       WHERE plan_id = $1 AND status = 'Draft'
       RETURNING
        plan_id AS "PlanId",
        plan_title AS "PlanNumber",
        plan_title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [planId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'Plan not found or cannot be recommended in current status.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.workflow_instances
        (entity_type, entity_id, record_title, last_transition_reason, updated_at)
       VALUES ('procurement_plan', $1, 'Recommended', $2, NOW())
       ON CONFLICT DO NOTHING`,
      [planId, Comments || '']
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recommending the plan.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/procurement-plans/:planId/recommendation-readiness
// ─────────────────────────────────────────────
procurementPlansRouter.get('/api/procurement-plans/:planId/recommendation-readiness', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const planResult = await pool.query(
      `SELECT plan_id, status FROM procurement_workflow.procurement_plans WHERE plan_id = $1`, [planId]
    );

    if (planResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Plan not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT COUNT(*) AS total_items,
              COUNT(CASE WHEN estimated_cost > 0 THEN 1 END) AS items_with_cost
       FROM procurement_workflow.procurement_plan_items
       WHERE plan_id = $1`, [planId]
    );

    const totalItems = parseInt(itemsResult.rows[0]?.total_items || '0', 10);
    const itemsWithCost = parseInt(itemsResult.rows[0]?.items_with_cost || '0', 10);

    const plan = planResult.rows[0];
    const isReady = plan.status === 'Draft' && totalItems > 0 && itemsWithCost === totalItems;

    res.json({
      PlanId: planId,
      Status: plan.status,
      IsReadyForRecommendation: isReady,
      TotalItems: totalItems,
      ItemsWithCost: itemsWithCost,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred checking recommendation readiness.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/procurement-plans/:planId/requisitions
// ─────────────────────────────────────────────
procurementPlansRouter.get('/api/procurement-plans/:planId/requisitions', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const result = await pool.query(
      `SELECT
        r.requisition_id AS "RequisitionId",
        r.requisition_number AS "RequisitionNumber",
        r.title AS "Title",
        r.status AS "Status",
        r.created_at AS "CreatedAt",
        pcl.linked_at AS "LinkedAt"
       FROM procurement_workflow.planning_committee_plan_links pcl
       JOIN procurement_workflow.requisitions r ON pcl.requisition_id = r.requisition_id
       WHERE pcl.plan_id = $1
       ORDER BY pcl.linked_at DESC`, [planId]
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching linked requisitions.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-plans/:planId/initiate-procurement
// ─────────────────────────────────────────────
procurementPlansRouter.post('/api/procurement-plans/:planId/initiate-procurement', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const result = await pool.query(
      `UPDATE procurement_workflow.procurement_plans
       SET status = 'Procurement Initiated', updated_at = NOW()
       WHERE plan_id = $1 AND status = 'Approved'
       RETURNING
        plan_id AS "PlanId",
        plan_title AS "PlanNumber",
        plan_title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [planId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'Plan not found or cannot be initiated in current status.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred initiating procurement.' });
  }
});
