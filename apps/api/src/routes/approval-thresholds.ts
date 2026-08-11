import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const approvalThresholdsRouter = Router();

// GET /api/approval-thresholds
approvalThresholdsRouter.get('/api/approval-thresholds', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
        at.threshold_id AS "ThresholdId",
        at.threshold_name AS "ThresholdName",
        at.min_amount AS "MinAmount",
        at.max_amount AS "MaxAmount",
        at.required_approvers AS "RequiredApprovers",
        at.required_approval_level AS "RequiredApprovalLevel",
        at.status AS "IsActive",
        at.created_at AS "CreatedAt",
        at.updated_at AS "UpdatedAt"
      FROM procurement_workflow.approval_thresholds at
      WHERE at.status = 'Active'
      ORDER BY at.min_amount ASC`
    );

    const thresholds = result.rows.map((t) => ({
      ThresholdId: t.ThresholdId,
      ThresholdName: t.ThresholdName,
      MinAmount: t.MinAmount,
      MaxAmount: t.MaxAmount,
      RequiredApprovers: t.RequiredApprovers,
      RequiredApprovalLevel: t.RequiredApprovalLevel,
      IsActive: t.IsActive,
      CreatedAt: t.CreatedAt,
      UpdatedAt: t.UpdatedAt,
    }));

    res.json({ Thresholds: thresholds });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching approval thresholds.' });
  }
});

// GET /api/approval-thresholds/resolve
approvalThresholdsRouter.get('/api/approval-thresholds/resolve', async (req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const Amount = (req.query.Amount ?? req.query.amount) as string | undefined;
    const ProcurementType = (req.query.ProcurementType ?? req.query.procurementType) as string | undefined;

    if (!Amount) {
      res.status(400).json({ ErrorMessage: 'Amount query parameter is required.' });
      return;
    }

    const amount = Number(Amount);

    const result = await pool.query(
      `SELECT
        threshold_id AS "ThresholdId",
        threshold_name AS "ThresholdName",
        min_amount AS "MinAmount",
        max_amount AS "MaxAmount",
        required_approvers AS "RequiredApprovers",
        required_approval_level AS "RequiredApprovalLevel"
      FROM procurement_workflow.approval_thresholds
      WHERE status = 'Active'
        AND min_amount <= $1
        AND (max_amount IS NULL OR max_amount >= $1)
      ${ProcurementType ? 'AND ($3::text IS NULL OR procurement_type = $3)' : ''}
      ORDER BY min_amount DESC
      LIMIT 1`,
      ProcurementType ? [amount, amount, ProcurementType] : [amount]
    );

    if (result.rows.length === 0) {
      res.json({ Message: 'No matching threshold found.', Amount: amount });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred resolving approval threshold.' });
  }
});

// PUT /api/approval-thresholds/:id
approvalThresholdsRouter.put('/api/approval-thresholds/:id', async (req, res) => {
  const auth = await requirePermission(req, 'admin.manage_thresholds');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { id } = req.params;
    const { ThresholdName, MinAmount, MaxAmount, RequiredApprovers, RequiredApprovalLevel, IsActive } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.approval_thresholds
       SET
         threshold_name = COALESCE($1, threshold_name),
         min_amount = COALESCE($2, min_amount),
         max_amount = COALESCE($3, max_amount),
         required_approvers = COALESCE($4, required_approvers),
         required_approval_level = COALESCE($5, required_approval_level),
         status = COALESCE($6, status),
         updated_at = NOW()
       WHERE threshold_id = $7
       RETURNING
         threshold_id AS "ThresholdId",
         threshold_name AS "ThresholdName",
         min_amount AS "MinAmount",
         max_amount AS "MaxAmount",
         required_approvers AS "RequiredApprovers",
         required_approval_level AS "RequiredApprovalLevel",
         status AS "IsActive",
         updated_at AS "UpdatedAt"`,
      [
        ThresholdName || null,
        MinAmount !== undefined ? MinAmount : null,
        MaxAmount !== undefined ? MaxAmount : null,
        RequiredApprovers !== undefined ? RequiredApprovers : null,
        RequiredApprovalLevel || null,
        IsActive !== undefined ? IsActive : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Approval threshold not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the approval threshold.' });
  }
});
