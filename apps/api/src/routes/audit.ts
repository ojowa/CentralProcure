import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const auditRouter = Router();

// GET /api/audit (root — alias for summary)
auditRouter.get('/api/audit', async (req, res) => {
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
        (SELECT COUNT(*) FROM post_award.contracts) AS "TotalContracts",
        (SELECT COUNT(*) FROM post_award.contracts WHERE status = 'Active') AS "ActiveContracts",
        (SELECT COUNT(*) FROM post_award.contracts WHERE status = 'Completed') AS "CompletedContracts",
        (SELECT COUNT(*) FROM post_award.inspections) AS "TotalInspections",
        (SELECT COUNT(*) FROM post_award.inspections WHERE status = 'Completed') AS "CompletedInspections",
        (SELECT COUNT(*) FROM post_award.payments) AS "TotalPayments",
        (SELECT COALESCE(SUM(amount), 0) FROM post_award.payments WHERE status = 'Completed') AS "TotalPaid",
        (SELECT COUNT(*) FROM post_award.closeouts) AS "TotalCloseouts",
        (SELECT COUNT(*) FROM post_award.closeouts WHERE status = 'Pending') AS "PendingCloseouts"`
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching audit summary.' });
  }
});

// GET /api/audit/summary
auditRouter.get('/api/audit/summary', async (req, res) => {
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
    const statsResult = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM post_award.contracts) AS "TotalContracts",
        (SELECT COUNT(*) FROM post_award.contracts WHERE status = 'Active') AS "ActiveContracts",
        (SELECT COUNT(*) FROM post_award.contracts WHERE status = 'Completed') AS "CompletedContracts",
        (SELECT COUNT(*) FROM post_award.inspections) AS "TotalInspections",
        (SELECT COUNT(*) FROM post_award.inspections WHERE status = 'Completed') AS "CompletedInspections",
        (SELECT COUNT(*) FROM post_award.payments) AS "TotalPayments",
        (SELECT COALESCE(SUM(amount), 0) FROM post_award.payments WHERE status = 'Completed') AS "TotalPaid",
        (SELECT COUNT(*) FROM post_award.closeouts) AS "TotalCloseouts",
        (SELECT COUNT(*) FROM post_award.closeouts WHERE status = 'Pending') AS "PendingCloseouts"`
    );

    const eventsResult = await pool.query(
      `SELECT
        wh.history_id AS "HistoryId",
        wi.entity_type AS "EntityType",
        wi.entity_id AS "EntityId",
        wh.from_stage_key AS "FromStageKey",
        wh.to_stage_key AS "ToStageKey",
        COALESCE(wsc_to.stage_title, wh.to_stage_key) AS "ToStageTitle",
        wh.stage_status AS "StageStatus",
        wh.transition_source AS "TransitionSource",
        wh.actor AS "Actor",
        wh.created_at AS "CreatedAt"
      FROM procurement_workflow.workflow_instance_history wh
      JOIN procurement_workflow.workflow_instances wi ON wi.instance_id = wh.instance_id
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc_to ON wsc_to.stage_key = wh.to_stage_key
      ORDER BY wh.created_at DESC
      LIMIT 10`
    );

    res.json({
      ...statsResult.rows[0],
      RecentEvents: eventsResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching audit summary.' });
  }
});

// GET /api/audit/closeouts
auditRouter.get('/api/audit/closeouts', async (req, res) => {
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
      conditions.push(`co.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.closeouts co ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        co.closeout_id AS "CloseoutId",
        co.contract_code AS "ContractCode",
        c.tender_title AS "ContractTitle",
        co.closeout_code AS "CloseoutCode",
        co.description AS "Description",
        co.status AS "Status",
        co.initiated_by AS "InitiatedBy",
        co.initiated_at AS "InitiatedAt",
        co.completed_at AS "CompletedAt",
        co.archive_location AS "ArchiveLocation",
        co.final_acceptance_completed AS "FinalAcceptanceCompleted",
        co.final_payment_completed AS "FinalPaymentCompleted",
        co.archived_by AS "ArchivedBy",
        co.archived_at AS "ArchivedAt",
        co.created_at AS "CreatedAt"
      FROM post_award.closeouts co
      LEFT JOIN post_award.contracts c ON co.contract_code = c.contract_code
      ${whereClause}
      ORDER BY co.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Closeouts: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching audit closeouts.' });
  }
});

// POST /api/audit/closeouts
auditRouter.post('/api/audit/closeouts', async (req, res) => {
  const auth = await requirePermission(req, 'audit.closeout');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { ContractCode, CloseoutCode, Description, ArchiveLocation, FinalAcceptanceCompleted, FinalPaymentCompleted, ArchivedBy } = req.body;

    if (!ContractCode || !CloseoutCode) {
      res.status(400).json({ ErrorMessage: 'ContractCode and CloseoutCode are required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO post_award.closeouts
        (contract_code, closeout_code, description, status, initiated_by, initiated_at,
         archive_location, final_acceptance_completed, final_payment_completed, archived_by, archived_at, created_at)
       VALUES ($1, $2, $3, 'Pending', $4, NOW(), $5, $6, $7, $8, CASE WHEN $8 IS NOT NULL THEN NOW() ELSE NULL END, NOW())
       RETURNING
         closeout_id AS "CloseoutId",
         contract_code AS "ContractCode",
         closeout_code AS "CloseoutCode",
         description AS "Description",
         status AS "Status",
         initiated_by AS "InitiatedBy",
         initiated_at AS "InitiatedAt",
         archive_location AS "ArchiveLocation",
         final_acceptance_completed AS "FinalAcceptanceCompleted",
         final_payment_completed AS "FinalPaymentCompleted",
         archived_by AS "ArchivedBy",
         archived_at AS "ArchivedAt",
         created_at AS "CreatedAt"`,
       [ContractCode, CloseoutCode, Description || '', auth!.sub,
        ArchiveLocation || null, FinalAcceptanceCompleted ?? false, FinalPaymentCompleted ?? false, ArchivedBy || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the closeout.' });
  }
});

// GET /api/audit/history
auditRouter.get('/api/audit/history', async (req, res) => {
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
    const EntityType = (req.query.EntityType ?? req.query.entityType) as string | undefined;
    const EntityId = (req.query.EntityId ?? req.query.entityId) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const SortBy = (req.query.SortBy ?? req.query.sortBy) as string | undefined;
    const SortOrder = (req.query.SortOrder ?? req.query.sortOrder) as string | undefined;
    const Actor = (req.query.actor) as string | undefined;
    const TransitionSource = (req.query.transitionSource) as string | undefined;
    const Query = (req.query.query) as string | undefined;
    const DateFrom = (req.query.dateFrom) as string | undefined;
    const DateTo = (req.query.dateTo) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const validSortColumns: Record<string, string> = {
      CreatedAt: 'ah.created_at',
      EntityType: 'ah.entity_type',
      Action: 'ah.action',
    };
    const sortColumn = validSortColumns[SortBy as string] || 'ah.created_at';
    const order = SortOrder === 'ASC' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (EntityType) {
      conditions.push(`ah.entity_type = $${paramIndex}`);
      values.push(EntityType);
      paramIndex++;
    }
    if (EntityId) {
      conditions.push(`ah.entity_id = $${paramIndex}`);
      values.push(EntityId);
      paramIndex++;
    }
    if (Actor) {
      conditions.push(`ah.performed_by = $${paramIndex}`);
      values.push(Actor);
      paramIndex++;
    }
    if (TransitionSource) {
      conditions.push(`ah.old_values::text ILIKE $${paramIndex}`);
      values.push(`%${TransitionSource}%`);
      paramIndex++;
    }
    if (Query) {
      conditions.push(`(ah.action ILIKE $${paramIndex} OR ah.notes ILIKE $${paramIndex} OR ah.entity_id ILIKE $${paramIndex})`);
      values.push(`%${Query}%`);
      paramIndex++;
    }
    if (DateFrom) {
      conditions.push(`ah.created_at >= $${paramIndex}`);
      values.push(DateFrom);
      paramIndex++;
    }
    if (DateTo) {
      conditions.push(`ah.created_at <= $${paramIndex}`);
      values.push(DateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM post_award.audit_history ah ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        ah.audit_id AS "AuditId",
        ah.entity_type AS "EntityType",
        ah.entity_id AS "EntityId",
        ah.action AS "Action",
        ah.performed_by AS "PerformedBy",
        ah.old_values AS "OldValues",
        ah.new_values AS "NewValues",
        ah.notes AS "Notes",
        ah.created_at AS "CreatedAt"
      FROM post_award.audit_history ah
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      History: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching audit history.' });
  }
});

// GET /api/audit/diagnostics/:entityType/:entityId
auditRouter.get('/api/audit/diagnostics/:entityType/:entityId', async (req, res) => {
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
    const { entityType, entityId } = req.params;

    const validEntityTypes = ['contract', 'inspection', 'payment', 'milestone', 'closeout', 'appropriation', 'release', 'commitment'];
    if (!validEntityTypes.includes(entityType)) {
      res.status(400).json({ ErrorMessage: `Invalid entity type. Allowed values: ${validEntityTypes.join(', ')}` });
      return;
    }

    const historyResult = await pool.query(
      `SELECT
        ah.audit_id AS "AuditId",
        ah.entity_type AS "EntityType",
        ah.entity_id AS "EntityId",
        ah.action AS "Action",
        ah.performed_by AS "PerformedBy",
        ah.old_values AS "OldValues",
        ah.new_values AS "NewValues",
        ah.notes AS "Notes",
        ah.created_at AS "CreatedAt"
      FROM post_award.audit_history ah
      WHERE ah.entity_type = $1 AND ah.entity_id = $2
      ORDER BY ah.created_at ASC`,
      [entityType, entityId]
    );

    const workflowResult = await pool.query(
      `SELECT
        awl.log_id AS "LogId",
        awl.entity_type AS "EntityType",
        awl.entity_id AS "EntityId",
        awl.action AS "Action",
        awl.performed_by AS "PerformedBy",
        awl.from_status AS "FromStatus",
        awl.to_status AS "ToStatus",
        awl.notes AS "Notes",
        awl.created_at AS "CreatedAt"
      FROM post_award.audit_workflow_log awl
      WHERE awl.entity_type = $1 AND awl.entity_id = $2
      ORDER BY awl.created_at ASC`,
      [entityType, entityId]
    );

    res.json({
      EntityType: entityType,
      EntityId: entityId,
      AuditHistory: historyResult.rows,
      WorkflowTimeline: workflowResult.rows,
      TotalActions: historyResult.rows.length,
      TotalTransitions: workflowResult.rows.length,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow diagnostics.' });
  }
});
