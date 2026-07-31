import { Router } from 'express';
import { pool } from '../db.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';
import { syncAsync } from '../lib/workflow/runtime-tracker.js';

export const needsCollectionRouter = Router();

// ─────────────────────────────────────────────
// Phase 1: COLLECTION — units submit needs
// ─────────────────────────────────────────────

// GET /api/needs-collection — list collections
needsCollectionRouter.get('/api/needs-collection', async (req, res) => {
  const auth = await requirePermission(req, 'needs.view');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Status, UnitId, FiscalYear, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (Status) { conditions.push(`nc.status = $${idx}`); values.push(Status); idx++; }
    if (UnitId) { conditions.push(`nc.unit_id = $${idx}`); values.push(UnitId); idx++; }
    if (FiscalYear) { conditions.push(`nc.fiscal_year = $${idx}`); values.push(FiscalYear); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM procurement_workflow.needs_collection nc ${whereClause}`, values
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      `SELECT
        nc.collection_id AS "CollectionId",
        nc.title AS "Title",
        nc.fiscal_year AS "FiscalYear",
        nc.unit_id AS "UnitId",
        ou.unit_name AS "UnitName",
        nc.status AS "Status",
        nc.remarks AS "Remarks",
        nc.created_by AS "CreatedBy",
        nc.created_at AS "CreatedAt",
        nc.updated_at AS "UpdatedAt",
        (SELECT COUNT(*) FROM procurement_workflow.needs_collection_items nci WHERE nci.collection_id = nc.collection_id)::INT AS "ItemCount"
       FROM procurement_workflow.needs_collection nc
       LEFT JOIN identity.organizational_units ou ON nc.unit_id = ou.unit_id
       ${whereClause}
       ORDER BY nc.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({ Items: result.rows, TotalCount: totalCount, Page: pageNum, PageSize: pageSizeNum });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching collections.' });
  }
});

// POST /api/needs-collection — create collection
needsCollectionRouter.post('/api/needs-collection', async (req, res) => {
  const auth = await requirePermission(req, 'needs.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { Title, FiscalYear, UnitId, Remarks, Items } = req.body;
    if (!Title || !FiscalYear) {
      res.status(400).json({ ErrorMessage: 'Title and FiscalYear are required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.needs_collection
        (title, fiscal_year, unit_id, remarks, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Draft', $5, NOW(), NOW())
       RETURNING
        collection_id AS "CollectionId",
        title AS "Title",
        fiscal_year AS "FiscalYear",
        status AS "Status",
        created_at AS "CreatedAt"`,
      [Title, FiscalYear, UnitId || null, Remarks || '', auth!.sub]
    );

    const collection = result.rows[0];

    if (Array.isArray(Items) && Items.length > 0) {
      for (const item of Items) {
        await pool.query(
          `INSERT INTO procurement_workflow.needs_collection_items
            (collection_id, description, quantity, unit, priority, procurement_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [collection.CollectionId, item.Description || '', item.Quantity || 1,
           item.Unit || 'Unit', item.Priority || 'Normal', item.ProcurementType || 'Goods']
        );
      }
    }

    res.status(201).json(collection);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error creating collection.' });
  }
});

// ─────────────────────────────────────────────
// ANALYSIS — aggregated view across collections
// ─────────────────────────────────────────────

// GET /api/needs-collection/analysis — basic aggregation
needsCollectionRouter.get('/api/needs-collection/analysis', async (req, res) => {
  const auth = await requirePermission(req, 'needs.view');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.analyze_needs($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching analysis.' });
  }
});

// GET /api/needs-collection/analysis/category — breakdown by procurement type
needsCollectionRouter.get('/api/needs-collection/analysis/category', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.analyze_needs_by_category($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching category analysis.' });
  }
});

// GET /api/needs-collection/analysis/unit — per-unit submission breakdown
needsCollectionRouter.get('/api/needs-collection/analysis/unit', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.analyze_needs_by_unit($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching unit analysis.' });
  }
});

// GET /api/needs-collection/analysis/weighted — priority-weighted scoring
needsCollectionRouter.get('/api/needs-collection/analysis/weighted', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.analyze_needs_weighted($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching weighted analysis.' });
  }
});

// GET /api/needs-collection/analysis/similar — duplicate/similar detection
needsCollectionRouter.get('/api/needs-collection/analysis/similar', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.detect_similar_needs($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error detecting similar needs.' });
  }
});

// GET /api/needs-collection/analysis/plan-gap — compare needs vs procurement plan
needsCollectionRouter.get('/api/needs-collection/analysis/plan-gap', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.analyze_needs_plan_gap($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error analyzing plan gap.' });
  }
});

// GET /api/needs-collection/analysis/thresholds — threshold flags
needsCollectionRouter.get('/api/needs-collection/analysis/thresholds', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear, UnitPrice } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const unitPrice = parseFloat(UnitPrice as string) || 0;
    const result = await pool.query(`SELECT * FROM procurement_workflow.analyze_needs_thresholds($1, $2)`, [FiscalYear, unitPrice]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error analyzing thresholds.' });
  }
});

// GET /api/needs-collection/analysis/non-submissions — units that haven't submitted
needsCollectionRouter.get('/api/needs-collection/analysis/non-submissions', async (req, res) => {
  const auth = await requirePermission(req, 'needs.analysis');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear } = req.query;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }
    const result = await pool.query(`SELECT * FROM procurement_workflow.get_non_submissions($1)`, [FiscalYear]);
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching non-submissions.' });
  }
});

// ─────────────────────────────────────────────
// Phase 2: ASSESSMENT — procurement endorses
// ─────────────────────────────────────────────

// GET /api/needs-collection/assessments — list assessments
needsCollectionRouter.get('/api/needs-collection/assessments', async (req, res) => {
  const auth = await requirePermission(req, 'needs.view');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear, Status } = req.query;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (FiscalYear) { conditions.push(`na.fiscal_year = $${idx}`); values.push(FiscalYear); idx++; }
    if (Status) { conditions.push(`na.status = $${idx}`); values.push(Status); idx++; }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        na.assessment_id AS "AssessmentId",
        na.fiscal_year AS "FiscalYear",
        na.status AS "Status",
        na.remarks AS "Remarks",
        na.assessed_by AS "AssessedBy",
        na.assessed_at AS "AssessedAt",
        na.created_at AS "CreatedAt",
        (SELECT COUNT(*) FROM procurement_workflow.needs_assessment_items nai WHERE nai.assessment_id = na.assessment_id)::INT AS "ItemCount"
       FROM procurement_workflow.needs_assessment na
       ${whereClause}
       ORDER BY na.created_at DESC`,
      values
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching assessments.' });
  }
});

// POST /api/needs-collection/assessments — create (from analysis or manual)
needsCollectionRouter.post('/api/needs-collection/assessments', async (req, res) => {
  const auth = await requirePermission(req, 'needs.consolidate');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { FiscalYear, Items } = req.body;
    if (!FiscalYear) { res.status(400).json({ ErrorMessage: 'FiscalYear is required.' }); return; }

    let assessmentId: string;

    if (Array.isArray(Items) && Items.length > 0) {
      // Manual creation with provided items
      const result = await pool.query(
        `INSERT INTO procurement_workflow.needs_assessment (fiscal_year, status, created_by)
         VALUES ($1, 'Draft', $2)
         RETURNING assessment_id AS "AssessmentId"`,
        [FiscalYear, auth!.sub]
      );
      assessmentId = result.rows[0].AssessmentId;

      for (const item of Items) {
        await pool.query(
          `INSERT INTO procurement_workflow.needs_assessment_items
            (assessment_id, description, quantity, unit, priority, procurement_type, source_units)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [assessmentId, item.Description || '', item.Quantity || 1,
           item.Unit || 'Unit', item.Priority || 'Normal', item.ProcurementType || 'Goods',
           JSON.stringify(item.SourceUnits || [])]
        );
      }
    } else {
      // Create from analysis
      const result = await pool.query(
        `SELECT procurement_workflow.create_assessment_from_analysis($1, $2) AS "AssessmentId"`,
        [FiscalYear, auth!.sub]
      );
      assessmentId = result.rows[0].AssessmentId;
    }

    const detail = await pool.query(
      `SELECT assessment_id AS "AssessmentId", fiscal_year AS "FiscalYear", status AS "Status", created_at AS "CreatedAt"
       FROM procurement_workflow.needs_assessment WHERE assessment_id = $1`, [assessmentId]
    );

    // Advance workflow: needs_assessment → budget_allocation_and_confirmation
    try {
      await syncAsync({
        entity_type: 'needs_assessment',
        entity_id: assessmentId,
        stage_key: 'budget_allocation_and_confirmation',
        status: 'Active',
        record_title: `Needs Assessment FY${FiscalYear}`,
        parent_entity_type: null,
        parent_entity_id: null,
        amount: null,
        procurement_type: null,
        threshold_id: null,
        actor: auth!.sub,
        transition_source: 'assessment_created',
        transition_reason: 'Needs assessment created successfully — proceeding to budget allocation.',
      });
    } catch (wfErr: any) {
      console.error('Workflow sync failed for needs assessment:', wfErr.message);
    }

    res.status(201).json(detail.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error creating assessment.' });
  }
});

// ─────────────────────────────────────────────
// COLLECTION — :id routes (after specific routes)
// ─────────────────────────────────────────────

// GET /api/needs-collection/:id — detail with items
needsCollectionRouter.get('/api/needs-collection/:id', async (req, res) => {
  const auth = await requirePermission(req, 'needs.view');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
        nc.collection_id AS "CollectionId",
        nc.title AS "Title",
        nc.fiscal_year AS "FiscalYear",
        nc.unit_id AS "UnitId",
        ou.unit_name AS "UnitName",
        nc.status AS "Status",
        nc.remarks AS "Remarks",
        nc.submitted_at AS "SubmittedAt",
        nc.created_by AS "CreatedBy",
        nc.created_at AS "CreatedAt",
        nc.updated_at AS "UpdatedAt"
       FROM procurement_workflow.needs_collection nc
       LEFT JOIN identity.organizational_units ou ON nc.unit_id = ou.unit_id
       WHERE nc.collection_id = $1`, [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Collection not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT
        item_id AS "ItemId",
        description AS "Description",
        quantity AS "Quantity",
        unit AS "Unit",
        priority AS "Priority",
        procurement_type AS "ProcurementType"
       FROM procurement_workflow.needs_collection_items
       WHERE collection_id = $1
       ORDER BY created_at`, [id]
    );

    res.json({ ...result.rows[0], Items: itemsResult.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching collection detail.' });
  }
});

// PUT /api/needs-collection/:id — update collection
needsCollectionRouter.put('/api/needs-collection/:id', async (req, res) => {
  const auth = await requirePermission(req, 'needs.create');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Title, FiscalYear, UnitId, Remarks, Items } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.needs_collection
       SET title = COALESCE(NULLIF($1, ''), title),
           fiscal_year = COALESCE(NULLIF($2, '')::int, fiscal_year),
           unit_id = COALESCE($3, unit_id),
           remarks = COALESCE(NULLIF($4, ''), remarks),
           updated_at = NOW()
       WHERE collection_id = $5 AND status IN ('Draft', 'Returned')
       RETURNING
        collection_id AS "CollectionId",
        title AS "Title",
        fiscal_year AS "FiscalYear",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [Title || '', FiscalYear || '', UnitId || null, Remarks || '', id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Collection not found or not editable.' }); return;
    }

    if (Array.isArray(Items)) {
      await pool.query('DELETE FROM procurement_workflow.needs_collection_items WHERE collection_id = $1', [id]);
      for (const item of Items) {
        await pool.query(
          `INSERT INTO procurement_workflow.needs_collection_items
            (collection_id, description, quantity, unit, priority, procurement_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, item.Description || '', item.Quantity || 1,
           item.Unit || 'Unit', item.Priority || 'Normal', item.ProcurementType || 'Goods']
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error updating collection.' });
  }
});

// POST /api/needs-collection/:id/submit — submit for review
needsCollectionRouter.post('/api/needs-collection/:id/submit', async (req, res) => {
  const auth = await requirePermission(req, 'needs.submit');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE procurement_workflow.needs_collection
       SET status = 'Submitted', submitted_at = NOW(), updated_at = NOW()
       WHERE collection_id = $1 AND status IN ('Draft', 'Returned')
       RETURNING collection_id AS "CollectionId", status AS "Status"`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Collection not found or already submitted.' }); return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error submitting collection.' });
  }
});

// DELETE /api/needs-collection/:id
needsCollectionRouter.delete('/api/needs-collection/:id', async (req, res) => {
  const auth = await requirePermission(req, 'needs.delete');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM procurement_workflow.needs_collection
       WHERE collection_id = $1 AND status = 'Draft'
       RETURNING collection_id AS "CollectionId"`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Collection not found or not deletable.' }); return;
    }
    res.json({ Message: 'Collection deleted.' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error deleting collection.' });
  }
});

// ─────────────────────────────────────────────
// ASSESSMENT :id routes
// ─────────────────────────────────────────────

// GET /api/needs-collection/assessments/:id — detail with items
needsCollectionRouter.get('/api/needs-collection/assessments/:id', async (req, res) => {
  const auth = await requirePermission(req, 'needs.view');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
        na.assessment_id AS "AssessmentId",
        na.fiscal_year AS "FiscalYear",
        na.status AS "Status",
        na.remarks AS "Remarks",
        na.assessed_by AS "AssessedBy",
        na.assessed_at AS "AssessedAt",
        na.created_at AS "CreatedAt",
        na.updated_at AS "UpdatedAt"
       FROM procurement_workflow.needs_assessment na
       WHERE na.assessment_id = $1`, [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Assessment not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT
        item_id AS "ItemId",
        description AS "Description",
        quantity AS "Quantity",
        unit AS "Unit",
        priority AS "Priority",
        procurement_type AS "ProcurementType",
        source_units AS "SourceUnits"
       FROM procurement_workflow.needs_assessment_items
       WHERE assessment_id = $1
       ORDER BY created_at`, [id]
    );

    res.json({ ...result.rows[0], Items: itemsResult.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error fetching assessment detail.' });
  }
});

// POST /api/needs-collection/assessments/:id/decision — endorse/reject
needsCollectionRouter.post('/api/needs-collection/assessments/:id/decision', async (req, res) => {
  const auth = await requirePermission(req, 'needs.endorse');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Decision, Remarks } = req.body;

    if (!Decision || !['Endorsed', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Endorsed or Rejected.' }); return;
    }

    const result = await pool.query(
      `UPDATE procurement_workflow.needs_assessment
       SET status = $1, remarks = COALESCE(NULLIF($2, ''), remarks),
           assessed_by = $3, assessed_at = NOW(), updated_at = NOW()
       WHERE assessment_id = $4 AND status = 'Draft'
       RETURNING assessment_id AS "AssessmentId", status AS "Status", assessed_at AS "AssessedAt"`,
      [Decision, Remarks || '', auth!.sub, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Assessment not found or already decided.' }); return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error submitting decision.' });
  }
});

// PUT /api/needs-collection/assessments/:id — update assessment remarks
needsCollectionRouter.put('/api/needs-collection/assessments/:id', async (req, res) => {
  const auth = await requirePermission(req, 'needs.consolidate');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Remarks } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.needs_assessment
       SET remarks = COALESCE(NULLIF($1, ''), remarks), updated_at = NOW()
       WHERE assessment_id = $2 AND status = 'Draft'
       RETURNING assessment_id AS "AssessmentId", remarks AS "Remarks", updated_at AS "UpdatedAt"`,
      [Remarks || '', id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Assessment not found or not editable.' }); return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error updating assessment.' });
  }
});

// ─────────────────────────────────────────────
// ASSESSMENT ITEMS — add / update / delete
// ─────────────────────────────────────────────

// POST /api/needs-collection/assessments/:id/items — add item
needsCollectionRouter.post('/api/needs-collection/assessments/:id/items', async (req, res) => {
  const auth = await requirePermission(req, 'needs.consolidate');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { Description, Quantity, Unit, Priority, ProcurementType, SourceUnits } = req.body;

    // Verify assessment exists and is editable
    const check = await pool.query(`SELECT status FROM procurement_workflow.needs_assessment WHERE assessment_id = $1`, [id]);
    if (check.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Assessment not found.' }); return; }
    if (check.rows[0].status !== 'Draft') { res.status(400).json({ ErrorMessage: 'Assessment is not editable.' }); return; }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.needs_assessment_items
        (assessment_id, description, quantity, unit, priority, procurement_type, source_units)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING item_id AS "ItemId", description AS "Description", quantity AS "Quantity",
                 unit AS "Unit", priority AS "Priority", procurement_type AS "ProcurementType", source_units AS "SourceUnits"`,
      [id, Description || '', Quantity || 1, Unit || 'Unit', Priority || 'Normal',
       ProcurementType || 'Goods', JSON.stringify(SourceUnits || [])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error adding item.' });
  }
});

// PUT /api/needs-collection/assessments/:id/items/:itemId — update item
needsCollectionRouter.put('/api/needs-collection/assessments/:id/items/:itemId', async (req, res) => {
  const auth = await requirePermission(req, 'needs.consolidate');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id, itemId } = req.params;
    const { Description, Quantity, Unit, Priority, ProcurementType, SourceUnits } = req.body;

    const check = await pool.query(`SELECT status FROM procurement_workflow.needs_assessment WHERE assessment_id = $1`, [id]);
    if (check.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Assessment not found.' }); return; }
    if (check.rows[0].status !== 'Draft') { res.status(400).json({ ErrorMessage: 'Assessment is not editable.' }); return; }

    const result = await pool.query(
      `UPDATE procurement_workflow.needs_assessment_items
       SET description = COALESCE(NULLIF($1, ''), description),
           quantity = COALESCE(NULLIF($2, '')::decimal, quantity),
           unit = COALESCE(NULLIF($3, ''), unit),
           priority = COALESCE(NULLIF($4, ''), priority),
           procurement_type = COALESCE(NULLIF($5, ''), procurement_type),
           source_units = COALESCE($6, source_units)
       WHERE item_id = $7 AND assessment_id = $8
       RETURNING item_id AS "ItemId", description AS "Description", quantity AS "Quantity",
                 unit AS "Unit", priority AS "Priority", procurement_type AS "ProcurementType", source_units AS "SourceUnits"`,
      [Description || '', Quantity || '', Unit || '', Priority || '', ProcurementType || '',
       SourceUnits ? JSON.stringify(SourceUnits) : null, itemId, id]
    );

    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Item not found.' }); return; }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error updating item.' });
  }
});

// DELETE /api/needs-collection/assessments/:id/items/:itemId — delete item
needsCollectionRouter.delete('/api/needs-collection/assessments/:id/items/:itemId', async (req, res) => {
  const auth = await requirePermission(req, 'needs.consolidate');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id, itemId } = req.params;

    const check = await pool.query(`SELECT status FROM procurement_workflow.needs_assessment WHERE assessment_id = $1`, [id]);
    if (check.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Assessment not found.' }); return; }
    if (check.rows[0].status !== 'Draft') { res.status(400).json({ ErrorMessage: 'Assessment is not editable.' }); return; }

    const result = await pool.query(
      `DELETE FROM procurement_workflow.needs_assessment_items
       WHERE item_id = $1 AND assessment_id = $2
       RETURNING item_id AS "ItemId"`,
      [itemId, id]
    );

    if (result.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Item not found.' }); return; }
    res.json({ Message: 'Item deleted.' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error deleting item.' });
  }
});

// POST /api/needs-collection/assessments/:id/carry-forward — carry needs from another year
needsCollectionRouter.post('/api/needs-collection/assessments/:id/carry-forward', async (req, res) => {
  const auth = await requirePermission(req, 'needs.carry_forward');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { id } = req.params;
    const { SourceFiscalYear } = req.body;

    if (!SourceFiscalYear) { res.status(400).json({ ErrorMessage: 'SourceFiscalYear is required.' }); return; }

    // Verify assessment exists and is editable
    const check = await pool.query(`SELECT status, fiscal_year FROM procurement_workflow.needs_assessment WHERE assessment_id = $1`, [id]);
    if (check.rows.length === 0) { res.status(404).json({ ErrorMessage: 'Assessment not found.' }); return; }
    if (check.rows[0].status !== 'Draft') { res.status(400).json({ ErrorMessage: 'Assessment is not editable.' }); return; }

    // Get items from source year's submitted collections
    const sourceItems = await pool.query(
      `SELECT * FROM procurement_workflow.analyze_needs($1)`, [SourceFiscalYear]
    );

    if (sourceItems.rows.length === 0) {
      res.status(404).json({ ErrorMessage: `No submitted needs found for FY ${SourceFiscalYear}.` }); return;
    }

    let addedCount = 0;
    for (const item of sourceItems.rows) {
      await pool.query(
        `INSERT INTO procurement_workflow.needs_assessment_items
          (assessment_id, description, quantity, unit, priority, procurement_type, source_units)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, item.item_description, item.total_quantity, item.unit,
         item.priority_summary, item.procurement_type, item.source_units]
      );
      addedCount++;
    }

    res.json({ Message: `Carried forward ${addedCount} items from FY ${SourceFiscalYear}.`, Count: addedCount });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'Error carrying forward needs.' });
  }
});
