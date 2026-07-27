import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const administrativeReviewsRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/administrative-reviews
// ─────────────────────────────────────────────
administrativeReviewsRouter.get('/api/administrative-reviews', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { EntityType, EntityId, Status, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (EntityType) { conditions.push(`ar.entity_type = $${idx}`); values.push(EntityType); idx++; }
    if (EntityId) { conditions.push(`ar.entity_id = $${idx}`); values.push(EntityId); idx++; }
    if (Status) { conditions.push(`ar.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.administrative_reviews ar
       ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        ar.review_id AS "ReviewId",
        ar.entity_type AS "EntityType",
        ar.entity_id AS "EntityId",
        ar.entity_title AS "EntityTitle",
        ar.review_type AS "ReviewType",
        ar.status AS "Status",
        ar.comments AS "Comments",
        ar.reviewed_by AS "ReviewedBy",
        ar.reviewed_at AS "ReviewedAt",
        ar.created_at AS "CreatedAt"
       FROM procurement_workflow.administrative_reviews ar
       ${whereClause}
       ORDER BY ar.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Reviews: result.rows,
      TotalCount: totalCount,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching administrative reviews.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/administrative-reviews/filing-context
// ─────────────────────────────────────────────
administrativeReviewsRouter.get('/api/administrative-reviews/filing-context', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { EntityType, EntityId } = req.query;

    if (!EntityType || !EntityId) {
      res.status(400).json({ ErrorMessage: 'EntityType and EntityId are required.' }); return;
    }

    const result = await pool.query(
      `SELECT
        ar.review_id AS "ReviewId",
        ar.entity_type AS "EntityType",
        ar.entity_id AS "EntityId",
        ar.entity_title AS "EntityTitle",
        ar.review_type AS "ReviewType",
        ar.status AS "Status",
        ar.comments AS "Comments",
        ar.reviewed_by AS "ReviewedBy",
        ar.reviewed_at AS "ReviewedAt",
        ar.created_at AS "CreatedAt",
        ar.filing_number AS "FilingNumber",
        ar.filing_date AS "FilingDate"
       FROM procurement_workflow.administrative_reviews ar
       WHERE ar.entity_type = $1 AND ar.entity_id = $2
       ORDER BY ar.created_at DESC
       LIMIT 10`, [EntityType, EntityId]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching filing context.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/administrative-reviews/:id
// ─────────────────────────────────────────────
administrativeReviewsRouter.get('/api/administrative-reviews/:id', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        ar.review_id AS "ReviewId",
        ar.entity_type AS "EntityType",
        ar.entity_id AS "EntityId",
        ar.entity_title AS "EntityTitle",
        ar.review_type AS "ReviewType",
        ar.status AS "Status",
        ar.comments AS "Comments",
        ar.justification AS "Justification",
        ar.reviewed_by AS "ReviewedBy",
        ar.reviewed_at AS "ReviewedAt",
        ar.created_at AS "CreatedAt",
        ar.updated_at AS "UpdatedAt",
        ar.filing_number AS "FilingNumber",
        ar.filing_date AS "FilingDate"
       FROM procurement_workflow.administrative_reviews ar
       WHERE ar.review_id = $1`, [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Administrative review not found.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the administrative review.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/administrative-reviews
// ─────────────────────────────────────────────
administrativeReviewsRouter.post('/api/administrative-reviews', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { EntityType, EntityId, EntityTitle, ReviewType, Status, Comments, Justification } = req.body;

    if (!EntityType || !EntityId || !ReviewType) {
      res.status(400).json({ ErrorMessage: 'EntityType, EntityId, and ReviewType are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.administrative_reviews
        (entity_type, entity_id, entity_title, review_type, status, comments, justification, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
       RETURNING
        review_id AS "ReviewId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        review_type AS "ReviewType",
        status AS "Status",
        created_at AS "CreatedAt"`,
      [EntityType, EntityId, EntityTitle || '', ReviewType,
       Status || 'Pending', Comments || '', Justification || '', payload.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating administrative review.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/administrative-reviews/:id
// ─────────────────────────────────────────────
administrativeReviewsRouter.put('/api/administrative-reviews/:id', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Status, Comments, Justification, ReviewType } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.administrative_reviews
       SET
        status = COALESCE(NULLIF($1, ''), status),
        comments = COALESCE(NULLIF($2, ''), comments),
        justification = COALESCE(NULLIF($3, ''), justification),
        review_type = COALESCE(NULLIF($4, ''), review_type),
        updated_at = NOW()
       WHERE review_id = $5
       RETURNING
        review_id AS "ReviewId",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        review_type AS "ReviewType",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [Status || '', Comments || '', Justification || '', ReviewType || '', id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Administrative review not found or update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the administrative review.' });
  }
});
