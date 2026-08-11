import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const evaluationReportsRouter = Router();

// GET /api/evaluation-reports
evaluationReportsRouter.get('/api/evaluation-reports', async (req, res) => {
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
    const { Status, Query, Page, PageSize } = req.query;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (Status) {
      conditions.push(`er.status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }
    if (Query) {
      conditions.push(`(er.tender_title ILIKE $${paramIndex} OR er.report_code ILIKE $${paramIndex} OR er.recommendation ILIKE $${paramIndex})`);
      values.push(`%${Query}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.evaluation_reports er
       ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        er.report_id AS "ReportId",
        er.report_code AS "ReportCode",
        er.tender_id AS "TenderId",
        er.tender_title AS "TenderTitle",
        er.committee_lead AS "CommitteeLead",
        er.recommendation AS "Recommendation",
        er.score_summary AS "ScoreSummary",
        er.status AS "Status",
        er.submitted_at AS "SubmittedAt",
        er.notes AS "Notes"
      FROM procurement_workflow.evaluation_reports er
      ${whereClause}
      ORDER BY er.submitted_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Items: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching evaluation reports.' });
  }
});

// GET /api/evaluation-reports/:reportId
evaluationReportsRouter.get('/api/evaluation-reports/:reportId', async (req, res) => {
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
    const { reportId } = req.params;
    const result = await pool.query(
      `SELECT
        er.report_id AS "ReportId",
        er.report_code AS "ReportCode",
        er.tender_id AS "TenderId",
        er.tender_title AS "TenderTitle",
        er.committee_lead AS "CommitteeLead",
        er.recommendation AS "Recommendation",
        er.score_summary AS "ScoreSummary",
        er.status AS "Status",
        er.submitted_at AS "SubmittedAt",
        er.notes AS "Notes"
      FROM procurement_workflow.evaluation_reports er
      WHERE er.report_id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Evaluation report not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the evaluation report.' });
  }
});
