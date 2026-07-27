import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const bidOpeningRouter = Router();

// GET /api/bid-opening/sessions
bidOpeningRouter.get('/api/bid-opening/sessions', async (req, res) => {
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
    const { Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM vendor_sourcing.bid_opening_sessions'
    );
    const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.get_bid_opening_sessions($1, $2)',
      [pageNum, pageSizeNum]
    );

    const sessions = result.rows.map((s) => ({
      SessionId: s.session_id,
      TenderId: s.tender_id,
      TenderTitle: s.tender_title,
      SessionDate: s.session_date,
      Status: s.status,
      ConductedBy: s.conducted_by,
      CreatedAt: s.created_at,
    }));

    res.json({
      Sessions: sessions,
      TotalCount: totalCount,
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching bid opening sessions.' });
  }
});

// GET /api/bid-opening/sessions/:sessionId
bidOpeningRouter.get('/api/bid-opening/sessions/:sessionId', async (req, res) => {
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
    const { sessionId } = req.params;
    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.get_bid_opening_session_details($1)',
      [sessionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Bid opening session not found.' });
      return;
    }

    const s = result.rows[0];
    res.json({
      SessionId: s.session_id,
      TenderId: s.tender_id,
      TenderTitle: s.tender_title,
      SessionDate: s.session_date,
      Status: s.status,
      ConductedBy: s.conducted_by,
      Notes: s.notes,
      CreatedAt: s.created_at,
      Bids: s.bids || [],
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching session details.' });
  }
});

// POST /api/bid-opening/sessions
bidOpeningRouter.post('/api/bid-opening/sessions', async (req, res) => {
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
    const {
      TenderId, SessionDate, Status, ConductedBy,
      Notes, Location, Attendees, OpeningMethod,
    } = req.body;

    if (!TenderId || !SessionDate) {
      res.status(400).json({ ErrorMessage: 'TenderId and SessionDate are required.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.create_bid_opening_session($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        TenderId, SessionDate, Status || 'Scheduled', payload.sub,
        Notes || '', Location || '', Attendees || '', OpeningMethod || 'Public',
      ]
    );

    const s = result.rows[0];
    res.status(201).json({
      SessionId: s.session_id,
      TenderId: s.tender_id,
      SessionDate: s.session_date,
      Status: s.status,
      ConductedBy: s.conducted_by,
      CreatedAt: s.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating the session.' });
  }
});

// PUT /api/bid-opening/sessions/:sessionId
bidOpeningRouter.put('/api/bid-opening/sessions/:sessionId', async (req, res) => {
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
    const { sessionId } = req.params;
    const {
      TenderId, SessionDate, Status, ConductedBy,
      Notes, Location, Attendees, OpeningMethod,
    } = req.body;

    const result = await pool.query(
      'SELECT * FROM vendor_sourcing.update_bid_opening_session($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        sessionId, TenderId || '', SessionDate || '', Status || '',
        ConductedBy || payload.sub, Notes || '', Location || '', OpeningMethod || '',
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Session not found or update failed.' });
      return;
    }

    const s = result.rows[0];
    res.json({
      SessionId: s.session_id,
      TenderId: s.tender_id,
      SessionDate: s.session_date,
      Status: s.status,
      ConductedBy: s.conducted_by,
      Notes: s.notes,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the session.' });
  }
});
