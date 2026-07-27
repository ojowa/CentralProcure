import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const evaluationReportsRouter = Router();

// GET /api/evaluation-reports
evaluationReportsRouter.get('/api/evaluation-reports', async (req, res) => {
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
      conditions.push(`(t.title ILIKE $${paramIndex} OR er.comments ILIKE $${paramIndex})`);
      values.push(`%${Query}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM procurement_workflow.evaluation_reports er
       LEFT JOIN vendor_sourcing.tenders t ON er.tender_id = t.tender_id
       ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        er.report_id AS "ReportId",
        er.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        er.evaluator_id AS "EvaluatorId",
        iu.first_name || ' ' || iu.surname AS "EvaluatorName",
        er.score AS "Score",
        er.recommendation AS "Recommendation",
        er.comments AS "Comments",
        er.status AS "Status",
        er.submitted_at AS "SubmittedAt",
        er.reviewed_at AS "ReviewedAt"
      FROM procurement_workflow.evaluation_reports er
      LEFT JOIN vendor_sourcing.tenders t ON er.tender_id = t.tender_id
      LEFT JOIN identity.internal_users iu ON er.evaluator_id = iu.internal_user_id
      ${whereClause}
      ORDER BY er.submitted_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    const reports = result.rows.map((r) => ({
      ReportId: r.ReportId,
      TenderId: r.TenderId,
      TenderTitle: r.TenderTitle,
      EvaluatorId: r.EvaluatorId,
      EvaluatorName: r.EvaluatorName,
      Score: r.Score,
      Recommendation: r.Recommendation,
      Comments: r.Comments,
      Status: r.Status,
      SubmittedAt: r.SubmittedAt,
      ReviewedAt: r.ReviewedAt,
    }));

    res.json({
      Reports: reports,
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
    const { reportId } = req.params;
    const result = await pool.query(
      `SELECT
        er.report_id AS "ReportId",
        er.tender_id AS "TenderId",
        t.title AS "TenderTitle",
        er.evaluator_id AS "EvaluatorId",
        iu.first_name || ' ' || iu.surname AS "EvaluatorName",
        er.score AS "Score",
        er.recommendation AS "Recommendation",
        er.comments AS "Comments",
        er.status AS "Status",
        er.submitted_at AS "SubmittedAt",
        er.reviewed_at AS "ReviewedAt"
      FROM procurement_workflow.evaluation_reports er
      LEFT JOIN vendor_sourcing.tenders t ON er.tender_id = t.tender_id
      LEFT JOIN identity.internal_users iu ON er.evaluator_id = iu.internal_user_id
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
