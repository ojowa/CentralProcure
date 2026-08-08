import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const bppNoObjectionsRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/bpp-no-objections
// ─────────────────────────────────────────────
bppNoObjectionsRouter.get('/api/bpp-no-objections', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { TenderId, Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (TenderId) { conditions.push(`bno.tender_id = $${idx}`); values.push(TenderId); idx++; }
    if (Status) { conditions.push(`bno.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.bpp_no_objections bno
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        bno.no_objection_id AS "NoObjectionId",
        bno.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        bno.amount AS "Amount",
        bno.procurement_type AS "ProcurementType",
        bno.status AS "Status",
        bno.requested_by AS "RequestedBy",
        bno.requested_at AS "RequestedAt",
        bno.decision_by AS "DecisionBy",
        bno.decision_at AS "DecisionAt",
        bno.decision_notes AS "DecisionNotes",
        bno.reference_code AS "ReferenceCode",
        bno.created_at AS "CreatedAt",
        bno.updated_at AS "UpdatedAt"
       FROM procurement_workflow.bpp_no_objections bno
       LEFT JOIN vendor_sourcing.tenders t ON bno.tender_id = t.tender_id
       ${whereClause}
       ORDER BY bno.created_at DESC
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
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching BPP no-objections.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/bpp-no-objections/:id
// ─────────────────────────────────────────────
bppNoObjectionsRouter.get('/api/bpp-no-objections/:id', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        bno.no_objection_id AS "NoObjectionId",
        bno.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        bno.amount AS "Amount",
        bno.procurement_type AS "ProcurementType",
        bno.status AS "Status",
        bno.requested_by AS "RequestedBy",
        bno.requested_at AS "RequestedAt",
        bno.decision_by AS "DecisionBy",
        bno.decision_at AS "DecisionAt",
        bno.decision_notes AS "DecisionNotes",
        bno.reference_code AS "ReferenceCode",
        bno.created_at AS "CreatedAt",
        bno.updated_at AS "UpdatedAt"
       FROM procurement_workflow.bpp_no_objections bno
       LEFT JOIN vendor_sourcing.tenders t ON bno.tender_id = t.tender_id
       WHERE bno.no_objection_id = $1`, [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'BPP no-objection not found.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the BPP no-objection.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/bpp-no-objections
// ─────────────────────────────────────────────
bppNoObjectionsRouter.post('/api/bpp-no-objections', async (req, res) => {
  const auth = await requirePermission(req, 'bpp.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { TenderId, Amount, ProcurementType, Status, DecisionNotes, Justification } = req.body;

    if (!TenderId) {
      res.status(400).json({ ErrorMessage: 'TenderId is required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.bpp_no_objections
        (tender_id, amount, procurement_type, status, requested_by, requested_at, decision_notes, reference_code, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, NOW(), NOW())
       RETURNING
        no_objection_id AS "NoObjectionId",
        tender_id AS "TenderId",
        amount AS "Amount",
        procurement_type AS "ProcurementType",
        status AS "Status",
        requested_by AS "RequestedBy",
        requested_at AS "RequestedAt",
        created_at AS "CreatedAt"`,
      [TenderId, Amount || 0, ProcurementType || null,
       Status || 'Draft', auth!.sub, DecisionNotes || '',
       `BNO-${Date.now().toString(36).toUpperCase()}`, auth!.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating BPP no-objection.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/bpp-no-objections/:id
// ─────────────────────────────────────────────
bppNoObjectionsRouter.put('/api/bpp-no-objections/:id', async (req, res) => {
  const auth = await requirePermission(req, 'bpp.update');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Status, DecisionNotes, DecisionBy, DecisionAt } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.bpp_no_objections
       SET
        status = COALESCE(NULLIF($1, ''), status),
        decision_notes = COALESCE(NULLIF($2, ''), decision_notes),
        decision_by = COALESCE(NULLIF($3, ''), decision_by),
        decision_at = COALESCE(NULLIF($4, '')::timestamp, decision_at),
        updated_at = NOW()
       WHERE no_objection_id = $5
       RETURNING
        no_objection_id AS "NoObjectionId",
        tender_id AS "TenderId",
        status AS "Status",
        decision_by AS "DecisionBy",
        decision_at AS "DecisionAt",
        decision_notes AS "DecisionNotes",
        updated_at AS "UpdatedAt"`,
      [Status || '', DecisionNotes || '', DecisionBy || '', DecisionAt || '', id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'BPP no-objection not found or update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the BPP no-objection.' });
  }
});