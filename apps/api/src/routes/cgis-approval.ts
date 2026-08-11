import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const cgisApprovalRouter = Router();

// GET /api/cgis-approval/documents/:entityType/:entityId
cgisApprovalRouter.get('/api/cgis-approval/documents/:entityType/:entityId', async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }
  try {
    const { entityType, entityId } = req.params;
    const result = await pool.query(
      `SELECT
        wi.instance_id AS "DocumentId",
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wi.current_stage_key AS "DocumentType",
        wi.record_title AS "FileName",
        NULL AS "FileUrl",
        wi.current_status AS "Status",
        NULL AS "UploadedBy",
        wi.created_at AS "CreatedAt"
       FROM procurement_workflow.workflow_instances wi
       WHERE wi.entity_type = $1 AND wi.entity_id = $2
       ORDER BY wi.created_at DESC`,
      [entityType, entityId]
    );
    res.json({ Items: result.rows });
  } catch (error: any) { res.status(500).json({ ErrorMessage: error.message }); }
});

// POST /api/cgis-approval/:action
cgisApprovalRouter.post('/api/cgis-approval/:action', async (req: Request, res: Response) => {
  const auth = await requirePermission(req, 'cgis.approve');
  if (denyIfNoPermission(res, auth)) return;

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
      [newStatus, Notes || `${action} by CGIS`, auth!.email || auth!.sub, EntityType, EntityId]
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
