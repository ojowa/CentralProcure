import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

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
    const { RequisitionId, TenderId, Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (RequisitionId) { conditions.push(`bno.requisition_id = $${idx}`); values.push(RequisitionId); idx++; }
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
        bno.requisition_id AS "RequisitionId",
        r.requisition_number AS "RequisitionNumber",
        bno.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        bno.status AS "Status",
        bno.comments AS "Comments",
        bno.decided_by AS "DecidedBy",
        bno.decided_at AS "DecidedAt",
        bno.created_at AS "CreatedAt"
       FROM procurement_workflow.bpp_no_objections bno
       LEFT JOIN procurement_workflow.requisitions r ON bno.requisition_id = r.requisition_id
       LEFT JOIN vendor_sourcing.tenders t ON bno.tender_id = t.tender_id
       ${whereClause}
       ORDER BY bno.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      NoObjections: result.rows,
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
        bno.requisition_id AS "RequisitionId",
        r.requisition_number AS "RequisitionNumber",
        r.title AS "RequisitionTitle",
        bno.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        bno.status AS "Status",
        bno.comments AS "Comments",
        bno.justification AS "Justification",
        bno.decided_by AS "DecidedBy",
        bno.decided_at AS "DecidedAt",
        bno.created_at AS "CreatedAt",
        bno.updated_at AS "UpdatedAt"
       FROM procurement_workflow.bpp_no_objections bno
       LEFT JOIN procurement_workflow.requisitions r ON bno.requisition_id = r.requisition_id
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
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { RequisitionId, TenderId, Status, Comments, Justification } = req.body;

    if (!RequisitionId) {
      res.status(400).json({ ErrorMessage: 'RequisitionId is required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.bpp_no_objections
        (requisition_id, tender_id, status, comments, justification, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING
        no_objection_id AS "NoObjectionId",
        requisition_id AS "RequisitionId",
        tender_id AS "TenderId",
        status AS "Status",
        created_at AS "CreatedAt"`,
      [RequisitionId, TenderId || null, Status || 'Pending', Comments || '',
       Justification || '', payload.sub]
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
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Status, Comments, Justification } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.bpp_no_objections
       SET
        status = COALESCE(NULLIF($1, ''), status),
        comments = COALESCE(NULLIF($2, ''), comments),
        justification = COALESCE(NULLIF($3, ''), justification),
        updated_at = NOW()
       WHERE no_objection_id = $4
       RETURNING
        no_objection_id AS "NoObjectionId",
        requisition_id AS "RequisitionId",
        tender_id AS "TenderId",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [Status || '', Comments || '', Justification || '', id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'BPP no-objection not found or update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the BPP no-objection.' });
  }
});
