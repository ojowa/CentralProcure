import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const cgisApprovalRouter = Router();

// GET /api/cgis-approval/documents/:entityType/:entityId
cgisApprovalRouter.get('/api/cgis-approval/documents/:entityType/:entityId', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { entityType, entityId } = req.params;
    const result = await pool.query(
      `SELECT document_id AS "DocumentId",
              entity_type AS "EntityType",
              entity_id AS "EntityId",
              document_type AS "DocumentType",
              file_name AS "FileName",
              file_url AS "FileUrl",
              status AS "Status",
              uploaded_by AS "UploadedBy",
              created_at AS "CreatedAt"
       FROM procurement_workflow.workflow_documents
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
    res.json(result.rows);
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// POST /api/cgis-approval/:action
cgisApprovalRouter.post('/api/cgis-approval/:action', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { action } = req.params;
    const { EntityType, EntityId, Notes } = req.body;
    if (!EntityType || !EntityId) { res.status(400).json({ ErrorMessage: 'EntityType and EntityId are required.' }); return; }
    if (!['approve', 'reject', 'return', 'escalate'].includes(action)) { res.status(400).json({ ErrorMessage: 'Invalid action.' }); return; }

    const statusMap: Record<string, string> = {
      approve: 'Approved',
      reject: 'Rejected',
      return: 'Returned',
      escalate: 'Escalated'
    };
    const newStatus = statusMap[action];

    await pool.query(
      `UPDATE procurement_workflow.workflow_instances SET current_status = $1, updated_at = NOW()
       WHERE entity_type = $2 AND entity_id = $3`,
      [newStatus, EntityType, EntityId]
    );

    await pool.query(
      `INSERT INTO procurement_workflow.workflow_instance_history
        (instance_id, to_stage_key, stage_status, transition_source, transition_reason, actor)
       SELECT instance_id, current_stage_key, $1, 'cgis_approval', $2, $3
       FROM procurement_workflow.workflow_instances WHERE entity_type = $4 AND entity_id = $5`,
      [newStatus, Notes || `${action} by CGIS`, payload.email || payload.sub, EntityType, EntityId]
    );

    res.json({
      Status: 'Success',
      Action: action,
      EntityType,
      EntityId,
      NewStatus: newStatus
    });
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});
