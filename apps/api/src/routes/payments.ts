import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const paymentsRouter = Router();

// GET /api/payments
paymentsRouter.get('/api/payments', async (req, res) => {
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
    const Query = (req.query.Query ?? req.query.query) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const CloseoutEligible = (req.query.CloseoutEligible ?? req.query.closeoutEligible) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (Status) {
      conditions.push(`p.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }
    if (Query) {
      conditions.push(`(p.payment_reference ILIKE $${paramIndex} OR p.payee_name ILIKE $${paramIndex} OR c.contract_title ILIKE $${paramIndex})`);
      values.push(`%${Query}%`);
      paramIndex++;
    }
    if (CloseoutEligible === 'true') {
      conditions.push(`p.closeout_eligible = true`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM post_award.payments p
       LEFT JOIN post_award.contracts c ON p.contract_id = c.contract_id
       ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        p.payment_id AS "PaymentId",
        p.contract_id AS "ContractId",
        c.contract_title AS "ContractTitle",
        p.payment_reference AS "PaymentReference",
        p.payee_name AS "PayeeName",
        p.amount AS "Amount",
        p.payment_date AS "PaymentDate",
        p.payment_method AS "PaymentMethod",
        p.closeout_eligible AS "CloseoutEligible",
        p.status AS "Status",
        p.created_at AS "CreatedAt"
      FROM post_award.payments p
      LEFT JOIN post_award.contracts c ON p.contract_id = c.contract_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    const payments = result.rows.map((p) => ({
      PaymentId: p.PaymentId,
      ContractId: p.ContractId,
      ContractTitle: p.ContractTitle,
      PaymentReference: p.PaymentReference,
      PayeeName: p.PayeeName,
      Amount: p.Amount,
      PaymentDate: p.PaymentDate,
      PaymentMethod: p.PaymentMethod,
      CloseoutEligible: p.CloseoutEligible,
      Status: p.Status,
      CreatedAt: p.CreatedAt,
    }));

    res.json({
      Payments: payments,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching payments.' });
  }
});

// POST /api/payments
paymentsRouter.post('/api/payments', async (req, res) => {
  const auth = await requirePermission(req, 'payment.record');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const {
      ContractId, PaymentReference, PayeeName, Amount,
      PaymentDate, PaymentMethod, CloseoutEligible, Notes,
    } = req.body;

    if (!ContractId || !PaymentReference || !PayeeName || !Amount) {
      res.status(400).json({ ErrorMessage: 'ContractId, PaymentReference, PayeeName, and Amount are required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO post_award.payments
        (contract_id, payment_reference, payee_name, amount, payment_date, payment_method, closeout_eligible, notes, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending', $9, NOW())
       RETURNING
         payment_id AS "PaymentId",
         contract_id AS "ContractId",
         payment_reference AS "PaymentReference",
         payee_name AS "PayeeName",
         amount AS "Amount",
         payment_date AS "PaymentDate",
         payment_method AS "PaymentMethod",
         closeout_eligible AS "CloseoutEligible",
         status AS "Status",
         created_at AS "CreatedAt"`,
      [
        ContractId,
        PaymentReference,
        PayeeName,
        Amount,
        PaymentDate || new Date().toISOString(),
        PaymentMethod || 'BankTransfer',
        CloseoutEligible || false,
        Notes || '',
        auth!.sub,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recording the payment.' });
  }
});
