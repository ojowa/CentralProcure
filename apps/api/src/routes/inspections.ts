import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const inspectionsRouter = Router();

// GET /api/inspections
inspectionsRouter.get('/api/inspections', async (req, res) => {
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
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));

    const result = await pool.query(
      'SELECT * FROM post_award.get_inspections_sp($1, $2, $3, $4)',
      [Status || '', Query || '', pageNum, pageSizeNum]
    );

    const inspections = result.rows.map((i) => ({
      InspectionId: i.inspection_id,
      InspectionCode: i.inspection_code,
      ContractCode: i.contract_code,
      TenderTitle: i.tender_title,
      VendorName: i.vendor_name,
      InspectorName: i.inspector_name,
      ScheduledDate: i.scheduled_date,
      CompletedDate: i.completed_date,
      Outcome: i.outcome,
      Location: i.location,
      Notes: i.notes,
      Status: i.status,
      CreatedAt: i.created_at,
    }));

    res.json({
      Inspections: inspections,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching inspections.' });
  }
});

// GET /api/inspections/:inspectionId
inspectionsRouter.get('/api/inspections/:inspectionId', async (req, res) => {
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
    const { inspectionId } = req.params;
    const result = await pool.query(
      'SELECT * FROM post_award.get_inspection_detail_sp($1)',
      [inspectionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Inspection not found.' });
      return;
    }

    const i = result.rows[0];
    res.json({
      InspectionId: i.inspection_id,
      InspectionCode: i.inspection_code,
      ContractCode: i.contract_code,
      TenderTitle: i.tender_title,
      VendorName: i.vendor_name,
      InspectorName: i.inspector_name,
      ScheduledDate: i.scheduled_date,
      CompletedDate: i.completed_date,
      Outcome: i.outcome,
      Location: i.location,
      Notes: i.notes,
      Status: i.status,
      CreatedAt: i.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching inspection details.' });
  }
});

// PUT /api/inspections/:inspectionId
inspectionsRouter.put('/api/inspections/:inspectionId', async (req, res) => {
  const auth = await requirePermission(req, 'inspection.update');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { inspectionId } = req.params;
    const { InspectorName, ScheduledDate, CompletedDate, Outcome, Notes, Status } = req.body;

    const validStatuses = ['Scheduled', 'InProgress', 'Completed', 'Cancelled'];
    if (Status && !validStatuses.includes(Status)) {
      res.status(400).json({ ErrorMessage: `Invalid status. Allowed values: ${validStatuses.join(', ')}` });
      return;
    }

    const validOutcomes = ['Satisfactory', 'Unsatisfactory', 'Pending'];
    if (Outcome && !validOutcomes.includes(Outcome)) {
      res.status(400).json({ ErrorMessage: `Invalid outcome. Allowed values: ${validOutcomes.join(', ')}` });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE post_award.inspections
         SET
           inspector_name = COALESCE($1, inspector_name),
           scheduled_date = COALESCE($2, scheduled_date),
           completed_date = COALESCE($3, completed_date),
           outcome = COALESCE($4, outcome),
           notes = COALESCE($5, notes),
           status = COALESCE($6, status),
           updated_at = NOW()
         WHERE inspection_id = $7
         RETURNING
           inspection_id AS "InspectionId",
           inspection_code AS "InspectionCode",
           contract_code AS "ContractCode",
           tender_title AS "TenderTitle",
           vendor_name AS "VendorName",
           inspector_name AS "InspectorName",
           scheduled_date AS "ScheduledDate",
           completed_date AS "CompletedDate",
           outcome AS "Outcome",
           location AS "Location",
           notes AS "Notes",
           status AS "Status",
           updated_at AS "UpdatedAt"`,
        [
          InspectorName || null,
          ScheduledDate || null,
          CompletedDate || null,
          Outcome || null,
          Notes || null,
          Status || null,
          inspectionId,
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ ErrorMessage: 'Inspection not found or update failed.' });
        return;
      }

      if (Status === 'Completed' || Outcome) {
        const contractResult = await client.query(
          `UPDATE post_award.contracts
           SET
             updated_at = NOW(),
             status = CASE
               WHEN $2 = 'Satisfactory' THEN 'Active'
               ELSE status
             END
           WHERE contract_code = $1
           RETURNING contract_code AS "ContractCode", status AS "Status"`,
          [result.rows[0].ContractCode, Outcome || '']
        );

        if (contractResult.rows.length > 0) {
          await client.query(
            `INSERT INTO post_award.contract_workflow_log
              (contract_code, action, performed_by, notes, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              result.rows[0].ContractCode,
              `Inspection ${Outcome ? `outcome: ${Outcome}` : 'completed'}`,
               auth!.sub,
              Notes || '',
            ]
          );
        }
      }

      await client.query('COMMIT');

      res.json(result.rows[0]);
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the inspection.' });
  }
});
