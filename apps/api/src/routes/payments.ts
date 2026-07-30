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
    const CloseoutEligible = (req.query.CloseoutEligible ?? req.query.closeoutEligible) as string | undefined;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (Status) {
      conditions.push(`c.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }
    if (Query) {
      conditions.push(`(c.contract_code ILIKE $${paramIndex} OR c.tender_title ILIKE $${paramIndex} OR c.vendor_name ILIKE $${paramIndex})`);
      values.push(`%${Query}%`);
      paramIndex++;
    }
    if (CloseoutEligible === 'true') {
      conditions.push(`c.is_paid = false`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        c.contract_id AS "ContractId",
        c.contract_code AS "ContractCode",
        c.tender_title AS "TenderTitle",
        c.vendor_name AS "VendorName",
        c.contract_value AS "ContractValue",
        c.status AS "ContractStatus",
        c.progress AS "ContractProgress",
        c.is_paid AS "IsPaid",
        wi.current_stage_key AS "CurrentStageKey",
        wsc.stage_title AS "CurrentStageTitle",
        wi.current_status AS "WorkflowStatus",
        ins.inspection_code AS "InspectionCode",
        ins.status AS "InspectionStatus",
        ins.outcome AS "InspectionOutcome",
        ins.completed_date AS "InspectionCompletedDate",
        co.closeout_id AS "CloseoutId",
        co.closeout_code AS "CloseoutReference",
        co.status AS "CloseoutStatus",
        co.final_acceptance_completed AS "FinalAcceptanceCompleted",
        co.final_payment_completed AS "FinalPaymentRecorded",
        co.archived_at AS "ArchivedAt"
      FROM post_award.contracts c
      LEFT JOIN procurement_workflow.workflow_instances wi
        ON wi.entity_type = 'contract' AND wi.entity_id = c.contract_code
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
        ON wsc.stage_key = wi.current_stage_key
      LEFT JOIN post_award.inspections ins
        ON ins.contract_code = c.contract_code
      LEFT JOIN post_award.closeouts co
        ON co.contract_code = c.contract_code
      ${whereClause}
      ORDER BY c.created_at DESC`
    );

    const payments = result.rows.map((r) => {
      const finalPaymentRecorded = r.FinalPaymentRecorded || false;
      const isPaid = r.IsPaid || false;
      const inspectionDone = r.InspectionStatus === 'Completed' || r.InspectionOutcome === 'Satisfactory';
      const closeoutExists = Boolean(r.CloseoutId);

      let paymentStage = 'Awaiting Inspection';
      if (r.InspectionStatus === 'InProgress') paymentStage = 'Inspection In Progress';
      else if (r.InspectionOutcome === 'Unsatisfactory') paymentStage = 'Blocked by Inspection';
      else if (inspectionDone && !isPaid) paymentStage = 'Ready for Final Payment';
      else if (isPaid && !closeoutExists) paymentStage = 'Ready for Closeout';
      else if (closeoutExists && r.ArchivedAt) paymentStage = 'Archived';
      else if (inspectionDone && isPaid) paymentStage = 'Ready for Closeout';

      return {
        ContractId: r.ContractId,
        ContractCode: r.ContractCode,
        TenderTitle: r.TenderTitle,
        VendorName: r.VendorName,
        ContractValue: r.ContractValue,
        ContractStatus: r.ContractStatus,
        ContractProgress: r.ContractProgress,
        CurrentStageKey: r.CurrentStageKey,
        CurrentStageTitle: r.CurrentStageTitle,
        WorkflowStatus: r.WorkflowStatus,
        InspectionCode: r.InspectionCode,
        InspectionStatus: r.InspectionStatus,
        InspectionOutcome: r.InspectionOutcome,
        InspectionCompletedDate: r.InspectionCompletedDate,
        FinalAcceptanceCompleted: r.FinalAcceptanceCompleted || false,
        FinalPaymentRecorded: finalPaymentRecorded,
        IsPaid: isPaid,
        CloseoutEligible: isPaid && inspectionDone && !closeoutExists,
        PaymentStage: paymentStage,
        CloseoutId: r.CloseoutId,
        CloseoutReference: r.CloseoutReference,
        CloseoutStatus: r.CloseoutStatus,
        ArchivedAt: r.ArchivedAt,
      };
    });

    res.json({ Payments: payments });
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
      ContractCode, ContractId, PaymentReference, Amount,
      PaymentDate, Notes,
    } = req.body;

    const contractCode = ContractCode || ContractId;

    if (!contractCode || !PaymentReference || !Amount) {
      res.status(400).json({ ErrorMessage: 'ContractCode, PaymentReference, and Amount are required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO post_award.payments
        (contract_code, payment_reference, amount, payment_date, notes, status, recorded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Pending', $6, NOW())
       RETURNING
         payment_id AS "PaymentId",
         contract_code AS "ContractCode",
         payment_reference AS "PaymentReference",
         amount AS "Amount",
         payment_date AS "PaymentDate",
         notes AS "Notes",
         status AS "Status",
         recorded_by AS "RecordedBy",
         created_at AS "CreatedAt"`,
      [
        contractCode,
        PaymentReference,
        Amount,
        PaymentDate || new Date().toISOString(),
        Notes || '',
        auth!.sub,
      ]
    );

    await pool.query(
      `UPDATE post_award.contracts SET is_paid = true, payment_recorded_at = NOW(), updated_at = NOW()
       WHERE contract_code = $1`,
      [contractCode]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recording the payment.' });
  }
});
