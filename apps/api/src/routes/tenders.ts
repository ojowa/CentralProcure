import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const tendersRouter = Router();

// GET /api/internal/tenders
tendersRouter.get('/api/internal/tenders', async (req, res) => {
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
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Query = (req.query.Query ?? req.query.query) as string | undefined;
    const Category = (req.query.category) as string | undefined;
    const SortBy = (req.query.sortBy) as string | undefined;
    const SortDir = (req.query.sortDir) as string | undefined;
    const MinValue = (req.query.minValue) as string | undefined;
    const MaxValue = (req.query.maxValue) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));

    const countResult = await pool.query('SELECT * FROM vendor_sourcing.get_tenders_count($1, $2)', [Status || '', Query || '']);
    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

    const result = await pool.query('SELECT * FROM vendor_sourcing.get_tenders($1, $2, $3, $4)', [
      Status || '',
      Query || '',
      pageNum,
      pageSizeNum,
    ]);

    const tenders = result.rows.map((t) => ({
      TenderId: t.tender_id,
      Title: t.title,
      Description: t.description ?? null,
      Category: t.category,
      EstimatedValue: t.budget,
      Status: t.status,
      Department: t.department,
      BudgetCode: t.budget_code,
      FiscalYear: t.fiscal_year,
      PublishedAt: t.publish_date,
      OpeningDate: t.opening_date,
      ClosingDate: t.closing_date,
      CreatedAt: t.created_at,
    }));

    res.json({
      Items: tenders,
      TotalCount: totalCount,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching tenders.' });
  }
});

// GET /api/internal/tenders/:tenderId
tendersRouter.get('/api/internal/tenders/:tenderId', async (req, res) => {
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
    const { tenderId } = req.params;
    const result = await pool.query('SELECT * FROM vendor_sourcing.get_tender_details($1)', [tenderId]);

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Tender not found.' });
      return;
    }

    const t = result.rows[0];
    res.json({
      TenderId: t.tender_id,
      Title: t.title,
      Description: t.description,
      Category: t.category,
      EstimatedValue: t.budget,
      Status: t.status,
      Department: t.department,
      BudgetCode: t.budget_code,
      FiscalYear: t.fiscal_year,
      Requirements: t.specifications,
      EligibilityCriteria: t.eligibility_criteria,
      EvaluationCriteria: t.evaluation_criteria,
      PublishedAt: t.publish_date,
      OpeningDate: t.opening_date,
      ClosingDate: t.closing_date,
      CreatedAt: t.created_at,
      UpdatedAt: t.updated_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching tender details.' });
  }
});

// POST /api/internal/tenders
tendersRouter.post('/api/internal/tenders', async (req, res) => {
  const auth = await requirePermission(req, 'tender.manage');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const {
      Title, Description, EstimatedValue, Status, ClosingDate,
      Requirements, EvaluationCriteria, Category, ProcurementType,
      FundingSource, ApprovalLevel, UnitId, DepartmentId, ProjectId,
    } = req.body;

    if (!Title || !Description) {
      res.status(400).json({ ErrorMessage: 'Title and Description are required.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.create_tender($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
      [
        Title, Description, EstimatedValue || 0, Status || 'Draft',
        ClosingDate || null, Requirements || '', EvaluationCriteria || '',
        Category || '', ProcurementType || '', FundingSource || '',
        ApprovalLevel || '', UnitId || null, DepartmentId || null,
        ProjectId || null, auth!.sub,
      ]
    );

    const t = result.rows[0];
    res.status(201).json({
      TenderId: t.tender_id,
      Title: t.title,
      Description: t.description,
      EstimatedValue: t.estimated_value,
      Status: t.status,
      CreatedAt: t.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the tender.' });
  }
});

// PUT /api/internal/tenders/:tenderId
tendersRouter.put('/api/internal/tenders/:tenderId', async (req, res) => {
  const auth = await requirePermission(req, 'tender.manage');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { tenderId } = req.params;
    const {
      Title, Description, EstimatedValue, Status, ClosingDate,
      Requirements, EvaluationCriteria, Category, ProcurementType,
      FundingSource, ApprovalLevel, UnitId, DepartmentId,
    } = req.body;

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.update_tender_sp($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      [
        tenderId, Title || '', Description || '', EstimatedValue || 0,
        Status || '', ClosingDate || null, Requirements || '',
        EvaluationCriteria || '', Category || '', ProcurementType || '',
        FundingSource || '', ApprovalLevel || '', UnitId || null,
        DepartmentId || null,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Tender not found or update failed.' });
      return;
    }

    const t = result.rows[0];
    res.json({
      TenderId: t.tender_id,
      Title: t.title,
      Description: t.description,
      EstimatedValue: t.estimated_value,
      Status: t.status,
      ClosingDate: t.closing_date,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the tender.' });
  }
});

// DELETE /api/internal/tenders/:tenderId
tendersRouter.delete('/api/internal/tenders/:tenderId', async (req, res) => {
  const auth = await requirePermission(req, 'tender.manage');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { tenderId } = req.params;
    const result = await pool.query(
      'DELETE FROM vendor_sourcing.tenders WHERE tender_id = $1 RETURNING tender_id',
      [tenderId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Tender not found.' });
      return;
    }

    res.json({ TenderId: result.rows[0].tender_id, Status: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred deleting the tender.' });
  }
});

// POST /api/internal/tenders/:tenderId/publish
tendersRouter.post('/api/internal/tenders/:tenderId/publish', async (req, res) => {
  const auth = await requirePermission(req, 'tender.manage');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { tenderId } = req.params;
    const { PublishedAt, ClosingDate } = req.body;

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.publish_tender($1, $2, $3, $4)',
      [tenderId, auth!.sub, PublishedAt || new Date().toISOString(), ClosingDate || null]
    );

    const t = result.rows[0];

    if (!t || t.error_message) {
      res.status(400).json({ ErrorMessage: t?.error_message || 'Publish failed.' });
      return;
    }

    res.json({
      TenderId: t.tender_id,
      Status: t.status,
      PublishedAt: t.published_at,
      ClosingDate: t.closing_date,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred publishing the tender.' });
  }
});

// GET /api/tenders/:tenderId/bids
tendersRouter.get('/api/tenders/:tenderId/bids', async (req, res) => {
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
    const { tenderId } = req.params;
    const result = await pool.query(
      `SELECT b.bid_id AS "BidId",
              b.tender_id AS "TenderId",
              b.vendor_id AS "VendorId",
              v.company_name AS "CompanyName",
              b.bid_amount AS "BidAmount",
              b.proposal AS "Proposal",
              b.status AS "Status",
              b.submitted_at AS "SubmittedAt"
       FROM vendor_sourcing.bids b
       LEFT JOIN identity.vendors v ON b.vendor_id = v.vendor_id
       WHERE b.tender_id = $1
       ORDER BY b.submitted_at DESC`,
      [tenderId]
    );
    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching bids.' });
  }
});

// GET /api/tenders/:tenderId/workflow-display
tendersRouter.get('/api/tenders/:tenderId/workflow-display', async (req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { tenderId } = req.params;
    const result = await pool.query(
      `SELECT
        wi.instance_id AS "InstanceId",
        wi.tender_id AS "TenderId",
        wi.current_stage_id AS "CurrentStageId",
        wsc.stage_name AS "StageName",
        wsc.stage_order AS "StageOrder",
        wi.status AS "Status",
        wi.created_at AS "CreatedAt",
        wi.updated_at AS "UpdatedAt"
      FROM procurement_workflow.workflow_instances wi
      LEFT JOIN procurement_workflow.workflow_stage_catalog wsc ON wi.current_stage_id = wsc.stage_id
      WHERE wi.tender_id = $1
      ORDER BY wsc.stage_order ASC`,
      [tenderId]
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workflow display.' });
  }
});
