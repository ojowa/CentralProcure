import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const contractsRouter = Router();

// GET /api/contracts/awards
contractsRouter.get('/api/contracts/awards', async (req, res) => {
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
    const { Status, Query, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));

    const result = await pool.query(
      'SELECT * FROM post_award.get_contract_awards_sp($1, $2, $3, $4)',
      [Status || '', Query || '', pageNum, pageSizeNum]
    );

    const awards = result.rows.map((a) => ({
      AwardId: a.award_id,
      ContractId: a.contract_id,
      VendorId: a.vendor_id,
      VendorName: a.vendor_name,
      AwardAmount: a.award_amount,
      AwardDate: a.award_date,
      Status: a.status,
      PublishedAt: a.published_at,
      CreatedAt: a.created_at,
    }));

    res.json({
      Items: awards,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching contract awards.' });
  }
});

// GET /api/contracts/awards/:awardId
contractsRouter.get('/api/contracts/awards/:awardId', async (req, res) => {
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
    const { awardId } = req.params;
    const result = await pool.query(
      'SELECT * FROM post_award.get_contract_award_sp($1)',
      [awardId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Contract award not found.' });
      return;
    }

    const a = result.rows[0];
    res.json({
      AwardId: a.award_id,
      ContractId: a.contract_id,
      TenderId: a.tender_id,
      VendorId: a.vendor_id,
      VendorName: a.vendor_name,
      AwardAmount: a.award_amount,
      AwardDate: a.award_date,
      Status: a.status,
      PublishedAt: a.published_at,
      Terms: a.terms,
      CreatedAt: a.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching contract award details.' });
  }
});

// POST /api/contracts/awards/:awardId/publish
contractsRouter.post('/api/contracts/awards/:awardId/publish', async (req, res) => {
  const auth = await requirePermission(req, 'contract_award.publish');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { awardId } = req.params;
    const result = await pool.query(
      'SELECT * FROM post_award.publish_contract_award_sp($1, $2)',
      [awardId, auth!.sub]
    );

    const a = result.rows[0];

    if (!a || a.error_message) {
      res.status(400).json({ ErrorMessage: a?.error_message || 'Publish failed.' });
      return;
    }

    res.json({
      AwardId: a.award_id,
      Status: a.status,
      PublishedAt: a.published_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred publishing the contract award.' });
  }
});

// GET /api/contracts
contractsRouter.get('/api/contracts', async (req, res) => {
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
    const { Status, Query, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));

    const result = await pool.query(
      'SELECT * FROM post_award.get_contracts_sp($1, $2, $3, $4)',
      [Status || '', Query || '', pageNum, pageSizeNum]
    );

    const contracts = result.rows.map((c) => ({
      ContractId: c.contract_id,
      ContractCode: c.contract_code,
      TenderTitle: c.tender_title,
      VendorName: c.vendor_name,
      ContractValue: c.contract_value,
      Progress: c.progress,
      Status: c.status,
      StartDate: c.start_date,
      EndDate: c.end_date,
      ContractManager: c.contract_manager,
      CreatedAt: c.created_at,
    }));

    res.json({
      Items: contracts,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching contracts.' });
  }
});

// GET /api/contracts/:contractId
contractsRouter.get('/api/contracts/:contractId', async (req, res) => {
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
    const { contractId } = req.params;
    const result = await pool.query(
      'SELECT * FROM post_award.get_contract_detail_sp($1)',
      [contractId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Contract not found.' });
      return;
    }

    const c = result.rows[0];
    res.json({
      ContractId: c.contract_id,
      ContractCode: c.contract_code,
      TenderTitle: c.tender_title,
      VendorName: c.vendor_name,
      ContractValue: c.contract_value,
      Progress: c.progress,
      Status: c.status,
      StartDate: c.start_date,
      EndDate: c.end_date,
      ContractManager: c.contract_manager,
      Notes: c.notes,
      CreatedAt: c.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching contract details.' });
  }
});

// GET /api/contracts/:contractId/milestones
contractsRouter.get('/api/contracts/:contractId/milestones', async (req, res) => {
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
    const { contractId } = req.params;
    const result = await pool.query(
      'SELECT * FROM post_award.get_contract_milestones_sp($1)',
      [contractId]
    );

    const milestones = result.rows.map((m) => ({
      MilestoneId: m.milestone_id,
      ContractCode: m.contract_code,
      MilestoneTitle: m.milestone_title,
      ProgressAfter: m.progress_after,
      StatusAfter: m.status_after,
      Notes: m.notes,
      ContractManager: m.contract_manager,
      RecordedBy: m.recorded_by,
      RecordedAt: m.recorded_at,
    }));

    res.json({
      Milestones: milestones,
      ContractId: contractId,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching contract milestones.' });
  }
});

// POST /api/contracts/:contractId/milestones
contractsRouter.post('/api/contracts/:contractId/milestones', async (req, res) => {
  const auth = await requirePermission(req, 'contract_management.manage');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { contractId } = req.params;
    const { MilestoneTitle, Description, DueDate, Status } = req.body;

    if (!MilestoneTitle) {
      res.status(400).json({ ErrorMessage: 'MilestoneTitle is required.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM post_award.log_contract_milestone_sp($1, $2, $3, $4, $5, $6)',
      [contractId, MilestoneTitle, Description || '', DueDate || null, Status || 'Pending', auth!.sub]
    );

    const m = result.rows[0];

    if (!m || m.error_message) {
      res.status(400).json({ ErrorMessage: m?.error_message || 'Failed to log milestone.' });
      return;
    }

    res.status(201).json({
      MilestoneId: m.milestone_id,
      ContractId: m.contract_id,
      MilestoneTitle: m.milestone_title,
      Description: m.description,
      DueDate: m.due_date,
      Status: m.status,
      CreatedAt: m.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred logging the milestone.' });
  }
});
