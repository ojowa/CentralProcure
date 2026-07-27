import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const budgetRouter = Router();

// GET /api/budget/availability
budgetRouter.get('/api/budget/availability', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const AppropriationId = (req.query.AppropriationId ?? req.query.appropriationId) as string | undefined;
    const FiscalYear = (req.query.FiscalYear ?? req.query.fiscalYear) as string | undefined;
    const BudgetCode = (req.query.budgetCode) as string | undefined;
    const Department = (req.query.department) as string | undefined;

    if (!AppropriationId) {
      res.status(400).json({ ErrorMessage: 'AppropriationId is required.' });
      return;
    }

    const result = await pool.query(
      `SELECT
        a.appropriation_id AS "AppropriationId",
        a.appropriation_code AS "AppropriationCode",
        a.total_amount AS "TotalAmount",
        COALESCE(releases.released_total, 0) AS "ReleasedTotal",
        COALESCE(commitments.committed_total, 0) AS "CommittedTotal",
        COALESCE(payments.paid_total, 0) AS "PaidTotal",
        a.total_amount - COALESCE(releases.released_total, 0) AS "UnreleasedBalance",
        COALESCE(releases.released_total, 0) - COALESCE(commitments.committed_total, 0) AS "AvailableForCommitment",
        COALESCE(commitments.committed_total, 0) - COALESCE(payments.paid_total, 0) AS "OutstandingCommitments"
      FROM post_award.appropriations a
      LEFT JOIN (
        SELECT appropriation_id, SUM(amount) AS released_total
        FROM post_award.releases WHERE status = 'Active'
        GROUP BY appropriation_id
      ) releases ON a.appropriation_id = releases.appropriation_id
      LEFT JOIN (
        SELECT r.appropriation_id, SUM(c.amount) AS committed_total
        FROM post_award.commitments c
        JOIN post_award.releases r ON c.release_id = r.release_id
        WHERE c.status = 'Active'
        GROUP BY r.appropriation_id
      ) commitments ON a.appropriation_id = commitments.appropriation_id
      LEFT JOIN (
        SELECT r.appropriation_id, SUM(p.amount) AS paid_total
        FROM post_award.payments p
        JOIN post_award.commitments c ON p.commitment_id = c.commitment_id
        JOIN post_award.releases r ON c.release_id = r.release_id
        WHERE p.status = 'Completed'
        GROUP BY r.appropriation_id
      ) payments ON a.appropriation_id = payments.appropriation_id
      WHERE a.appropriation_id = $1`,
      [AppropriationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Appropriation not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred checking budget availability.' });
  }
});

// GET /api/budget/summary
budgetRouter.get('/api/budget/summary', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const FiscalYear = (req.query.FiscalYear ?? req.query.fiscalYear) as string | undefined;
    const BudgetCode = (req.query.budgetCode) as string | undefined;
    const Department = (req.query.department) as string | undefined;

    const result = await pool.query(
      `SELECT
        a.appropriation_id AS "AppropriationId",
        a.appropriation_code AS "AppropriationCode",
        a.description AS "Description",
        a.total_amount AS "TotalAmount",
        a.fiscal_year AS "FiscalYear",
        a.status AS "Status",
        COALESCE(releases.released_total, 0) AS "ReleasedTotal",
        COALESCE(commitments.committed_total, 0) AS "CommittedTotal",
        COALESCE(payments.paid_total, 0) AS "PaidTotal"
      FROM post_award.appropriations a
      LEFT JOIN (
        SELECT appropriation_id, SUM(amount) AS released_total
        FROM post_award.releases WHERE status = 'Active'
        GROUP BY appropriation_id
      ) releases ON a.appropriation_id = releases.appropriation_id
      LEFT JOIN (
        SELECT r.appropriation_id, SUM(c.amount) AS committed_total
        FROM post_award.commitments c
        JOIN post_award.releases r ON c.release_id = r.release_id
        WHERE c.status = 'Active'
        GROUP BY r.appropriation_id
      ) commitments ON a.appropriation_id = commitments.appropriation_id
      LEFT JOIN (
        SELECT r.appropriation_id, SUM(p.amount) AS paid_total
        FROM post_award.payments p
        JOIN post_award.commitments c ON p.commitment_id = c.commitment_id
        JOIN post_award.releases r ON c.release_id = r.release_id
        WHERE p.status = 'Completed'
        GROUP BY r.appropriation_id
      ) payments ON a.appropriation_id = payments.appropriation_id
      ${FiscalYear ? 'WHERE a.fiscal_year = $1' : ''}
      ORDER BY a.appropriation_code ASC`,
      FiscalYear ? [FiscalYear] : []
    );

    res.json({ Summary: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching budget summary.' });
  }
});

// GET /api/budget/dashboard
budgetRouter.get('/api/budget/dashboard', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
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
        (SELECT COUNT(*) FROM post_award.appropriations WHERE status = 'Active') AS "ActiveAppropriations",
        (SELECT COALESCE(SUM(total_amount), 0) FROM post_award.appropriations WHERE status = 'Active') AS "TotalAppropriated",
        (SELECT COALESCE(SUM(amount), 0) FROM post_award.releases WHERE status = 'Active') AS "TotalReleased",
        (SELECT COALESCE(SUM(amount), 0) FROM post_award.commitments WHERE status = 'Active') AS "TotalCommitted",
        (SELECT COALESCE(SUM(amount), 0) FROM post_award.payments WHERE status = 'Completed') AS "TotalPaid",
        (SELECT COUNT(*) FROM post_award.commitments WHERE status = 'Active') AS "ActiveCommitments",
        (SELECT COUNT(*) FROM post_award.payments WHERE status = 'Pending') AS "PendingPayments",
        (SELECT COUNT(*) FROM post_award.appropriations WHERE status = 'Pending') AS "PendingApprovals"`
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching budget dashboard.' });
  }
});

// GET /api/budget/confirmations
budgetRouter.get('/api/budget/confirmations', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const FiscalYear = (req.query.fiscalYear) as string | undefined;
    const Department = (req.query.department) as string | undefined;
    const Stage = (req.query.stage) as string | undefined;
    const Query = (req.query.query) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = ['bp.status = $1'];
    const values: unknown[] = [Status || 'Pending'];
    let paramIndex = 2;

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.budget_plans bp ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        bp.plan_id AS "PlanId",
        bp.plan_code AS "PlanCode",
        bp.description AS "Description",
        bp.requested_amount AS "RequestedAmount",
        bp.department AS "Department",
        bp.requested_by AS "RequestedBy",
        bp.status AS "Status",
        bp.created_at AS "CreatedAt"
      FROM post_award.budget_plans bp
      ${whereClause}
      ORDER BY bp.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Confirmations: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching confirmations.' });
  }
});

// GET /api/budget/confirmations/:planId
budgetRouter.get('/api/budget/confirmations/:planId', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { planId } = req.params;
    const result = await pool.query(
      `SELECT
        bp.plan_id AS "PlanId",
        bp.plan_code AS "PlanCode",
        bp.description AS "Description",
        bp.requested_amount AS "RequestedAmount",
        bp.department AS "Department",
        bp.requested_by AS "RequestedBy",
        bp.status AS "Status",
        bp.approved_by AS "ApprovedBy",
        bp.approved_at AS "ApprovedAt",
        bp.rejection_reason AS "RejectionReason",
        bp.created_at AS "CreatedAt"
      FROM post_award.budget_plans bp
      WHERE bp.plan_id = $1`,
      [planId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Budget plan not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching confirmation details.' });
  }
});

// POST /api/budget/confirmations/:planId/decision
budgetRouter.post('/api/budget/confirmations/:planId/decision', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { planId } = req.params;
    const { Decision, RejectionReason } = req.body;

    if (!Decision || !['Approved', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be either "Approved" or "Rejected".' });
      return;
    }

    const result = await pool.query(
      `UPDATE post_award.budget_plans
       SET
         status = $1,
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = $3,
         updated_at = NOW()
       WHERE plan_id = $4
       RETURNING
         plan_id AS "PlanId",
         plan_code AS "PlanCode",
         description AS "Description",
         requested_amount AS "RequestedAmount",
         status AS "Status",
         approved_by AS "ApprovedBy",
         approved_at AS "ApprovedAt",
         rejection_reason AS "RejectionReason"`,
      [Decision, payload.sub, RejectionReason || null, planId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Budget plan not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred processing the decision.' });
  }
});

// GET /api/budget/requisitions
budgetRouter.get('/api/budget/requisitions', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (Status) {
      conditions.push(`bp.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.budget_plans bp ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        bp.plan_id AS "PlanId",
        bp.plan_code AS "PlanCode",
        bp.description AS "Description",
        bp.requested_amount AS "RequestedAmount",
        bp.department AS "Department",
        bp.requested_by AS "RequestedBy",
        bp.status AS "Status",
        bp.created_at AS "CreatedAt"
      FROM post_award.budget_plans bp
      ${whereClause}
      ORDER BY bp.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Requisitions: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching budget requisitions.' });
  }
});

// GET /api/budget/appropriations
budgetRouter.get('/api/budget/appropriations', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const FiscalYear = (req.query.FiscalYear ?? req.query.fiscalYear) as string | undefined;
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const Department = (req.query.department) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (FiscalYear) {
      conditions.push(`a.fiscal_year = $${paramIndex}`);
      values.push(FiscalYear);
      paramIndex++;
    }
    if (Status) {
      conditions.push(`a.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.appropriations a ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        a.appropriation_id AS "AppropriationId",
        a.appropriation_code AS "AppropriationCode",
        a.description AS "Description",
        a.total_amount AS "TotalAmount",
        a.fiscal_year AS "FiscalYear",
        a.status AS "Status",
        a.created_by AS "CreatedBy",
        a.created_at AS "CreatedAt"
      FROM post_award.appropriations a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Appropriations: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching appropriations.' });
  }
});

// POST /api/budget/appropriations
budgetRouter.post('/api/budget/appropriations', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { AppropriationCode, Description, TotalAmount, FiscalYear } = req.body;

    if (!AppropriationCode || !TotalAmount || !FiscalYear) {
      res.status(400).json({ ErrorMessage: 'AppropriationCode, TotalAmount, and FiscalYear are required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO post_award.appropriations
        (appropriation_code, description, total_amount, fiscal_year, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, 'Active', $5, NOW())
       RETURNING
         appropriation_id AS "AppropriationId",
         appropriation_code AS "AppropriationCode",
         description AS "Description",
         total_amount AS "TotalAmount",
         fiscal_year AS "FiscalYear",
         status AS "Status",
         created_by AS "CreatedBy",
         created_at AS "CreatedAt"`,
      [AppropriationCode, Description || '', TotalAmount, FiscalYear, payload.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the appropriation.' });
  }
});

// POST /api/budget/appropriations/:id/close
budgetRouter.post('/api/budget/appropriations/:id/close', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE post_award.appropriations
       SET status = 'Closed', updated_at = NOW()
       WHERE appropriation_id = $1 AND status = 'Active'
       RETURNING
         appropriation_id AS "AppropriationId",
         appropriation_code AS "AppropriationCode",
         description AS "Description",
         total_amount AS "TotalAmount",
         fiscal_year AS "FiscalYear",
         status AS "Status"`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Appropriation not found or not in Active status.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred closing the appropriation.' });
  }
});

// GET /api/budget/releases
budgetRouter.get('/api/budget/releases', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const AppropriationId = (req.query.AppropriationId ?? req.query.appropriationId) as string | undefined;
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const FiscalYear = (req.query.fiscalYear) as string | undefined;
    const Department = (req.query.department) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (AppropriationId) {
      conditions.push(`r.appropriation_id = $${paramIndex}`);
      values.push(AppropriationId);
      paramIndex++;
    }
    if (Status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.releases r ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        r.release_id AS "ReleaseId",
        r.appropriation_id AS "AppropriationId",
        a.appropriation_code AS "AppropriationCode",
        r.release_code AS "ReleaseCode",
        r.description AS "Description",
        r.amount AS "Amount",
        r.status AS "Status",
        r.created_by AS "CreatedBy",
        r.created_at AS "CreatedAt"
      FROM post_award.releases r
      LEFT JOIN post_award.appropriations a ON r.appropriation_id = a.appropriation_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Releases: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching releases.' });
  }
});

// POST /api/budget/releases
budgetRouter.post('/api/budget/releases', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { AppropriationId, ReleaseCode, Description, Amount } = req.body;

    if (!AppropriationId || !ReleaseCode || !Amount) {
      res.status(400).json({ ErrorMessage: 'AppropriationId, ReleaseCode, and Amount are required.' });
      return;
    }

    const result = await pool.query(
      `WITH available AS (
        SELECT
          a.appropriation_id,
          a.total_amount - COALESCE(
            (SELECT SUM(r.amount) FROM post_award.releases r
             WHERE r.appropriation_id = a.appropriation_id AND r.status = 'Active'), 0
          ) AS available_amount
        FROM post_award.appropriations a
        WHERE a.appropriation_id = $1 AND a.status = 'Active'
      ),
      insert_check AS (
        INSERT INTO post_award.releases
          (appropriation_id, release_code, description, amount, status, created_by, created_at)
        SELECT $1, $2, $3, $4, 'Active', $5, NOW()
        FROM available
        WHERE available.available_amount >= $4
        RETURNING
          release_id AS "ReleaseId",
          appropriation_id AS "AppropriationId",
          release_code AS "ReleaseCode",
          description AS "Description",
          amount AS "Amount",
          status AS "Status",
          created_by AS "CreatedBy",
          created_at AS "CreatedAt"
      )
      SELECT * FROM insert_check`,
      [AppropriationId, ReleaseCode, Description || '', Amount, payload.sub]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'Insufficient available balance or appropriation not found.' });
      return;
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the release.' });
  }
});

// GET /api/budget/commitments
budgetRouter.get('/api/budget/commitments', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const ReleaseId = (req.query.ReleaseId ?? req.query.releaseId) as string | undefined;
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const FiscalYear = (req.query.fiscalYear) as string | undefined;
    const Department = (req.query.department) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (ReleaseId) {
      conditions.push(`c.release_id = $${paramIndex}`);
      values.push(ReleaseId);
      paramIndex++;
    }
    if (Status) {
      conditions.push(`c.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.commitments c ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        c.commitment_id AS "CommitmentId",
        c.release_id AS "ReleaseId",
        r.release_code AS "ReleaseCode",
        c.commitment_code AS "CommitmentCode",
        c.description AS "Description",
        c.amount AS "Amount",
        c.beneficiary AS "Beneficiary",
        c.status AS "Status",
        c.created_by AS "CreatedBy",
        c.created_at AS "CreatedAt"
      FROM post_award.commitments c
      LEFT JOIN post_award.releases r ON c.release_id = r.release_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Commitments: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching commitments.' });
  }
});

// POST /api/budget/commitments
budgetRouter.post('/api/budget/commitments', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { ReleaseId, CommitmentCode, Description, Amount, Beneficiary } = req.body;

    if (!ReleaseId || !CommitmentCode || !Amount) {
      res.status(400).json({ ErrorMessage: 'ReleaseId, CommitmentCode, and Amount are required.' });
      return;
    }

    const result = await pool.query(
      `WITH available AS (
        SELECT
          r.release_id,
          r.amount - COALESCE(
            (SELECT SUM(c.amount) FROM post_award.commitments c
             WHERE c.release_id = r.release_id AND c.status = 'Active'), 0
          ) AS available_amount
        FROM post_award.releases r
        WHERE r.release_id = $1 AND r.status = 'Active'
      ),
      insert_check AS (
        INSERT INTO post_award.commitments
          (release_id, commitment_code, description, amount, beneficiary, status, created_by, created_at)
        SELECT $1, $2, $3, $4, $5, 'Active', $6, NOW()
        FROM available
        WHERE available.available_amount >= $4
        RETURNING
          commitment_id AS "CommitmentId",
          release_id AS "ReleaseId",
          commitment_code AS "CommitmentCode",
          description AS "Description",
          amount AS "Amount",
          beneficiary AS "Beneficiary",
          status AS "Status",
          created_by AS "CreatedBy",
          created_at AS "CreatedAt"
      )
      SELECT * FROM insert_check`,
      [ReleaseId, CommitmentCode, Description || '', Amount, Beneficiary || '', payload.sub]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'Insufficient available balance or release not found.' });
      return;
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the commitment.' });
  }
});

// POST /api/budget/commitments/:id/cancel
budgetRouter.post('/api/budget/commitments/:id/cancel', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE post_award.commitments
       SET status = 'Cancelled', updated_at = NOW()
       WHERE commitment_id = $1 AND status = 'Active'
       RETURNING
         commitment_id AS "CommitmentId",
         release_id AS "ReleaseId",
         commitment_code AS "CommitmentCode",
         description AS "Description",
         amount AS "Amount",
         beneficiary AS "Beneficiary",
         status AS "Status"`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Commitment not found or not in Active status.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred cancelling the commitment.' });
  }
});
