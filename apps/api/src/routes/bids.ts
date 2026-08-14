import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const bidsRouter = Router();

// POST /api/bids
bidsRouter.post('/api/bids', async (req, res) => {
  const auth = await requirePermission(req, 'bid.submit');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { TenderId, BidAmount, Proposal, FileName } = req.body;

    if (!TenderId || !BidAmount || !Proposal) {
      res.status(400).json({ ErrorMessage: 'TenderId, BidAmount, and Proposal are required.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.submit_bid($1, $2, $3, $4, $5)',
      [TenderId, auth!.sub, BidAmount, Proposal || '', 90]
    );

    const bid = result.rows[0];

    if (!bid) {
      res.status(400).json({ ErrorMessage: 'Bid submission failed.' });
      return;
    }

    const bidDetail = await pool.query(
      `SELECT bid_id, tender_id, vendor_id, bid_amount, technical_proposal_url AS "Proposal",
              status, submission_date AS "SubmittedAt"
       FROM vendor_sourcing.bids WHERE bid_id = $1`,
      [bid.bid_id]
    );

    res.status(201).json({
      BidId: bid.bid_id,
      TenderId: bid.tender_id,
      VendorId: bid.vendor_id,
      BidAmount: bidDetail.rows[0]?.BidAmount ?? null,
      Proposal: bidDetail.rows[0]?.Proposal ?? null,
      Status: bidDetail.rows[0]?.Status ?? 'Submitted',
      SubmittedAt: bidDetail.rows[0]?.SubmittedAt ?? null,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting the bid.' });
  }
});

// GET /api/vendors/:vendorId/bids
bidsRouter.get('/api/vendors/:vendorId/bids', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;
    const result = await pool.query('SELECT * FROM vendor_sourcing.get_submitted_bids($1)', [vendorId]);

    const bids = result.rows.map((b) => ({
      BidId: b.bid_id,
      TenderId: b.tender_id,
      BidAmount: b.bid_amount,
      Proposal: b.technical_proposal_url || '',
      ValidityPeriodDays: b.validity_period_days,
      SubmittedAt: b.submission_date,
      Status: b.status,
    }));

    res.json({ Items: bids });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching bids.' });
  }
});

// GET /api/bids/:bidId/proposal-file
bidsRouter.get('/api/bids/:bidId/proposal-file', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { bidId } = req.params;
    const result = await pool.query(
      `SELECT
        b.bid_id AS "BidId",
        b.technical_proposal_url AS "FileName",
        b.technical_proposal_url AS "Proposal"
      FROM vendor_sourcing.bids b
      WHERE b.bid_id = $1`,
      [bidId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Bid not found.' });
      return;
    }

    const bid = result.rows[0];
    res.json({
      BidId: bid.BidId,
      FileName: bid.FileName,
      FileUrl: bid.Proposal ? `/api/bids/${bidId}/proposal` : null,
      Message: bid.FileName ? 'Proposal file available.' : 'No proposal file attached.',
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching proposal file.' });
  }
});

// GET /api/bids/:bidId
bidsRouter.get('/api/bids/:bidId', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { bidId } = req.params;
    const result = await pool.query(
      `SELECT
        b.bid_id AS "BidId",
        b.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        b.vendor_id AS "VendorId",
        v.company_name AS "CompanyName",
        b.bid_amount AS "BidAmount",
        b.technical_proposal_url AS "Proposal",
        b.technical_proposal_url AS "FileName",
        b.status AS "Status",
        b.submission_date AS "SubmittedAt"
      FROM vendor_sourcing.bids b
      LEFT JOIN vendor_sourcing.tenders t ON b.tender_id = t.tender_id
      LEFT JOIN identity.vendors v ON b.vendor_id = v.vendor_id
      WHERE b.bid_id = $1`,
      [bidId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Bid not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching bid details.' });
  }
});
