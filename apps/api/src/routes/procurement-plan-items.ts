import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const procurementPlanItemsRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/procurement-plans/:planId/items
// ─────────────────────────────────────────────
procurementPlanItemsRouter.get('/api/procurement-plans/:planId/items', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;
    const result = await pool.query(
      `SELECT * FROM procurement_workflow.get_procurement_plan_items($1)`, [planId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching plan items.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/procurement-plans/:planId/items
// ─────────────────────────────────────────────
procurementPlanItemsRouter.post('/api/procurement-plans/:planId/items', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;
    const { Description, Justification, EstimatedCost, ApprovedBudget, FundingSource, ItemCategory, Quantity, UnitOfMeasure } = req.body;

    if (!Description) {
      res.status(400).json({ ErrorMessage: 'Description is required.' }); return;
    }

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.create_procurement_plan_item_sp($1, $2, $3, $4, $5, $6, $7, $8)`,
      [planId, Description, Justification || '', EstimatedCost || 0, ApprovedBudget || 0,
       FundingSource || '', ItemCategory || '', payload.sub]
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Failed to create plan item.' }); return;
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the plan item.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/procurement-plan-items/:planItemId
// ─────────────────────────────────────────────
procurementPlanItemsRouter.get('/api/procurement-plan-items/:planItemId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planItemId } = req.params;
    const result = await pool.query(
      `SELECT
        ppi.plan_item_id AS "PlanItemId",
        ppi.plan_id AS "PlanId",
        ppi.description AS "Description",
        ppi.justification AS "Justification",
        ppi.estimated_cost AS "EstimatedCost",
        ppi.approved_budget AS "ApprovedBudget",
        ppi.funding_source AS "FundingSource",
        ppi.item_category AS "ItemCategory",
        ppi.quantity AS "Quantity",
        ppi.unit_of_measure AS "UnitOfMeasure",
        ppi.created_by AS "CreatedBy",
        ppi.created_at AS "CreatedAt",
        ppi.updated_at AS "UpdatedAt"
      FROM procurement_workflow.procurement_plan_items ppi
      WHERE ppi.plan_item_id = $1`,
      [planItemId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Plan item not found.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the plan item.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/procurement-plan-items/:planItemId
// ─────────────────────────────────────────────
procurementPlanItemsRouter.put('/api/procurement-plan-items/:planItemId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planItemId } = req.params;
    const { Description, Justification, EstimatedCost, ApprovedBudget, FundingSource, ItemCategory, Quantity, UnitOfMeasure } = req.body;

    const result = await pool.query(
      `SELECT * FROM procurement_workflow.update_procurement_plan_item_sp($1, $2, $3, $4, $5, $6, $7, $8)`,
      [planItemId, Description || '', Justification || '', EstimatedCost || 0,
       ApprovedBudget || 0, FundingSource || '', ItemCategory || '', payload.sub]
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the plan item.' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/procurement-plan-items/:planItemId
// ─────────────────────────────────────────────
procurementPlanItemsRouter.delete('/api/procurement-plan-items/:planItemId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planItemId } = req.params;
    const result = await pool.query(
      `SELECT * FROM procurement_workflow.delete_procurement_plan_item_sp($1)`, [planItemId]
    );

    if (result.rows.length === 0 || result.rows[0].error_message) {
      res.status(400).json({ ErrorMessage: result.rows[0]?.error_message || 'Delete failed.' }); return;
    }

    res.json({ Status: 'Deleted', PlanItemId: planItemId });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred deleting the plan item.' });
  }
});
