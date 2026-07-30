import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const tendersPublicRouter = Router();

// GET /api/Tender/open
tendersPublicRouter.get('/api/Tender/open', async (_req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const result = await pool.query(
      "SELECT * FROM vendor_sourcing.get_tenders(p_status := 'Open', p_page_size := 100)"
    );

    const tenders = result.rows.map((t) => ({
      Id: t.tender_id,
      Title: t.title,
      ProcurementCategory: t.category,
      Status: t.status,
      SubmissionDeadline: t.closing_date,
    }));

    res.json(tenders);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching open tenders.' });
  }
});

// POST /api/Tender/bid
tendersPublicRouter.post('/api/Tender/bid', async (req, res) => {
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
    const { TenderId, BidAmount, Proposal, FileName } = req.body;

    if (!TenderId || !BidAmount || !Proposal) {
      res.status(400).json({ ErrorMessage: 'TenderId, BidAmount, and Proposal are required.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.submit_bid($1, $2, $3, $4, $5)',
      [payload.sub, TenderId, BidAmount, Proposal, FileName || '']
    );

    const bid = result.rows[0];

    if (!bid || bid.error_message) {
      res.status(400).json({ ErrorMessage: bid?.error_message || 'Bid submission failed.' });
      return;
    }

    res.status(201).json({
      BidId: bid.bid_id,
      TenderId: bid.tender_id,
      VendorId: bid.vendor_id,
      BidAmount: bid.bid_amount,
      Status: bid.status,
      SubmittedAt: bid.submitted_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting the bid.' });
  }
});

// GET /api/Tender/submitted-bids
tendersPublicRouter.get('/api/Tender/submitted-bids', async (req, res) => {
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
    const result = await pool.query('SELECT * FROM vendor_sourcing.get_submitted_bids($1)', [payload.sub]);

    const bids = result.rows.map((b) => ({
      BidId: b.bid_id,
      TenderId: b.tender_id,
      TenderTitle: b.tender_title,
      BidAmount: b.bid_amount,
      Status: b.status,
      SubmittedAt: b.submitted_at,
    }));

    res.json(bids);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching submitted bids.' });
  }
});

// GET /api/Tender/:tenderId
tendersPublicRouter.get('/api/Tender/:tenderId', async (req, res) => {
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
      Id: t.tender_id,
      Title: t.title,
      ProcurementCategory: t.category,
      Status: t.status,
      SubmissionDeadline: t.closing_date,
      OpeningDate: t.opening_date,
      ClosingDate: t.closing_date,
      Description: t.description,
      Specifications: t.specifications,
      Budget: t.budget,
      EligibilityCriteria: t.eligibility_criteria,
      EvaluationCriteria: t.evaluation_criteria,
      Documents: [],
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching tender details.' });
  }
});
