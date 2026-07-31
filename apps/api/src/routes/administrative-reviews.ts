import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

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
    const { EntityType, EntityId, Status } = req.query;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (EntityType) { conditions.push(`ar.entity_type = $${idx}`); values.push(EntityType); idx++; }
    if (EntityId) { conditions.push(`ar.entity_id = $${idx}`); values.push(EntityId); idx++; }
    if (Status) { conditions.push(`ar.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        ar.complaint_id AS "ComplaintId",
        ar.complaint_reference AS "ComplaintReference",
        ar.entity_type AS "EntityType",
        ar.entity_id AS "EntityId",
        ar.subject AS "Subject",
        ar.stage_key_at_filing AS "StageKeyAtFiling",
        ar.status AS "Status",
        ar.filed_by AS "FiledBy",
        ar.filed_at AS "FiledAt",
        ar.assigned_to AS "AssignedTo",
        ar.resolution_outcome AS "ResolutionOutcome",
        ar.resolved_at AS "ResolvedAt",
        ar.parent_record_title AS "ParentRecordTitle",
        ar.parent_current_stage_key AS "ParentCurrentStageKey",
        ar.parent_current_stage_title AS "ParentCurrentStageTitle",
        ar.parent_current_status AS "ParentCurrentStatus"
       FROM procurement_workflow.administrative_reviews ar
       ${whereClause}
       ORDER BY ar.filed_at DESC`,
      values
    );

    res.json({ Items: result.rows, TotalCount: result.rows.length });
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
        ar.complaint_id AS "ComplaintId",
        ar.complaint_reference AS "ComplaintReference",
        ar.entity_type AS "EntityType",
        ar.entity_id AS "EntityId",
        ar.subject AS "Subject",
        ar.status AS "Status",
        ar.filed_at AS "FiledAt"
       FROM procurement_workflow.administrative_reviews ar
       WHERE ar.entity_type = $1 AND ar.entity_id = $2
       ORDER BY ar.filed_at DESC
       LIMIT 10`, [EntityType, EntityId]
    );

    res.json({ Items: result.rows });
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
        ar.complaint_id AS "ComplaintId",
        ar.complaint_reference AS "ComplaintReference",
        ar.entity_type AS "EntityType",
        ar.entity_id AS "EntityId",
        ar.subject AS "Subject",
        ar.summary AS "Summary",
        ar.details AS "Details",
        ar.complaint_channel AS "ComplaintChannel",
        ar.requested_remedy AS "RequestedRemedy",
        ar.stage_key_at_filing AS "StageKeyAtFiling",
        ar.status AS "Status",
        ar.filed_by AS "FiledBy",
        ar.filed_at AS "FiledAt",
        ar.assigned_to AS "AssignedTo",
        ar.reviewed_by AS "ReviewedBy",
        ar.reviewed_at AS "ReviewedAt",
        ar.resolution_outcome AS "ResolutionOutcome",
        ar.resolution_stage_key AS "ResolutionStageKey",
        ar.resolution_notes AS "ResolutionNotes",
        ar.resolved_at AS "ResolvedAt",
        ar.parent_record_title AS "ParentRecordTitle",
        ar.parent_current_stage_key AS "ParentCurrentStageKey",
        ar.parent_current_stage_title AS "ParentCurrentStageTitle",
        ar.parent_current_status AS "ParentCurrentStatus",
        ar.created_at AS "CreatedAt",
        ar.updated_at AS "UpdatedAt"
       FROM procurement_workflow.administrative_reviews ar
       WHERE ar.complaint_id = $1`, [id]
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
  const auth = await requirePermission(req, 'administrative_review.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const {
      EntityType, EntityId, Subject, Summary, Details,
      ComplaintChannel, RequestedRemedy, FiledBy, AssignedTo
    } = req.body;

    if (!EntityType || !EntityId) {
      res.status(400).json({ ErrorMessage: 'EntityType and EntityId are required.' }); return;
    }

    const refResult = await pool.query(`SELECT nextval('procurement_workflow.complaint_ref_seq') AS seq`);
    let seq = refResult.rows[0]?.seq;
    if (!seq) {
      await pool.query(`CREATE SEQUENCE IF NOT EXISTS procurement_workflow.complaint_ref_seq START 1001`);
      const retry = await pool.query(`SELECT nextval('procurement_workflow.complaint_ref_seq') AS seq`);
      seq = retry.rows[0]?.seq;
    }
    const complaintRef = `COMP-${seq}`;

    const result = await pool.query(
      `INSERT INTO procurement_workflow.administrative_reviews
        (complaint_reference, entity_type, entity_id, subject, summary, details,
         complaint_channel, requested_remedy, stage_key_at_filing, status, filed_by,
         assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', 'Filed', $9, $10, NOW(), NOW())
       RETURNING
        complaint_id AS "ComplaintId",
        complaint_reference AS "ComplaintReference",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        subject AS "Subject",
        status AS "Status",
        filed_by AS "FiledBy",
        filed_at AS "FiledAt"`,
      [complaintRef, EntityType, EntityId, Subject || '', Summary || '', Details || '',
       ComplaintChannel || 'Portal', RequestedRemedy || '', FiledBy || auth!.sub, AssignedTo || null]
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
  const auth = await requirePermission(req, 'administrative_review.update');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Status, AssignedTo, ReviewedBy, ResolutionOutcome, ResolutionStageKey, ResolutionNotes } = req.body;

    const isTerminal = ['Resolved', 'Rejected', 'Closed'].includes(Status || '');

    const result = await pool.query(
      `UPDATE procurement_workflow.administrative_reviews
       SET
        status = COALESCE(NULLIF($1, ''), status),
        assigned_to = COALESCE(NULLIF($2, ''), assigned_to),
        reviewed_by = COALESCE(NULLIF($3, ''), reviewed_by),
        resolution_outcome = COALESCE(NULLIF($4, ''), resolution_outcome),
        resolution_stage_key = COALESCE(NULLIF($5, ''), resolution_stage_key),
        resolution_notes = COALESCE(NULLIF($6, ''), resolution_notes),
        resolved_at = CASE WHEN $7 THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
       WHERE complaint_id = $8
       RETURNING
        complaint_id AS "ComplaintId",
        complaint_reference AS "ComplaintReference",
        entity_type AS "EntityType",
        entity_id AS "EntityId",
        subject AS "Subject",
        summary AS "Summary",
        details AS "Details",
        complaint_channel AS "ComplaintChannel",
        requested_remedy AS "RequestedRemedy",
        stage_key_at_filing AS "StageKeyAtFiling",
        status AS "Status",
        filed_by AS "FiledBy",
        filed_at AS "FiledAt",
        assigned_to AS "AssignedTo",
        reviewed_by AS "ReviewedBy",
        reviewed_at AS "ReviewedAt",
        resolution_outcome AS "ResolutionOutcome",
        resolution_stage_key AS "ResolutionStageKey",
        resolution_notes AS "ResolutionNotes",
        resolved_at AS "ResolvedAt",
        parent_record_title AS "ParentRecordTitle",
        parent_current_stage_key AS "ParentCurrentStageKey",
        parent_current_stage_title AS "ParentCurrentStageTitle",
        parent_current_status AS "ParentCurrentStatus",
        created_at AS "CreatedAt",
        updated_at AS "UpdatedAt"`,
      [Status || '', AssignedTo || '', ReviewedBy || '', ResolutionOutcome || '',
       ResolutionStageKey || '', ResolutionNotes || '', isTerminal, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Administrative review not found or update failed.' }); return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating administrative review.' });
  }
});
