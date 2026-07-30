import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const evaluationsRouter = Router();

// GET /api/evaluations/assigned-tenders/default
evaluationsRouter.get('/api/evaluations/assigned-tenders/default', async (req, res) => {
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
        er.report_id AS "ReportId",
        er.report_code AS "ReportCode",
        er.tender_id AS "TenderId",
        er.tender_title AS "TenderTitle",
        er.committee_lead AS "CommitteeLead",
        er.recommendation AS "Recommendation",
        er.score_summary AS "ScoreSummary",
        er.status AS "EvaluationStatus",
        er.submitted_at AS "SubmittedAt",
        er.created_by AS "AssignmentRole",
        er.created_at AS "AssignmentDate",
        t.category AS "ProcurementCategory",
        t.status AS "TenderStatus",
        t.closing_date AS "SubmissionDeadline",
        t.opening_date AS "OpeningDate"
      FROM procurement_workflow.evaluation_reports er
      LEFT JOIN vendor_sourcing.tenders t ON er.tender_id = t.tender_id
      WHERE er.created_by = $1
      ORDER BY er.submitted_at DESC`,
      [payload.sub]
    );

    const assigned = result.rows.map((r) => ({
      ReportId: r.ReportId,
      ReportCode: r.ReportCode,
      TenderId: r.TenderId,
      TenderTitle: r.TenderTitle,
      CommitteeLead: r.CommitteeLead,
      Recommendation: r.Recommendation,
      ScoreSummary: r.ScoreSummary,
      EvaluationStatus: r.EvaluationStatus,
      SubmittedAt: r.SubmittedAt,
      AssignmentRole: r.AssignmentRole,
      AssignmentDate: r.AssignmentDate,
      ProcurementCategory: r.ProcurementCategory,
      TenderStatus: r.TenderStatus,
      SubmissionDeadline: r.SubmissionDeadline,
      OpeningDate: r.OpeningDate,
    }));

    res.json(assigned);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching assigned tenders.' });
  }
});

// POST /api/evaluations/actions
evaluationsRouter.post('/api/evaluations/actions', async (req, res) => {
  const auth = await requirePermission(req, 'evaluation.submit');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { TenderId, ReportId, Action, Comments, Score } = req.body;

    if (!TenderId || !Action) {
      res.status(400).json({ ErrorMessage: 'TenderId and Action are required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.evaluation_actions
        (tender_id, report_id, evaluator_id, action, comments, score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING
        action_id AS "ActionId",
        tender_id AS "TenderId",
        report_id AS "ReportId",
        evaluator_id AS "EvaluatorId",
        action AS "Action",
        comments AS "Comments",
        score AS "Score",
        created_at AS "CreatedAt"`,
      [TenderId, ReportId || null, auth!.sub, Action, Comments || '', Score || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recording the evaluation action.' });
  }
});

// GET /api/evaluations/assignments
evaluationsRouter.get('/api/evaluations/assignments', async (req, res) => {
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
    const { TenderId } = req.query;

    let result;
    if (TenderId) {
      result = await pool.query(
        `SELECT
          tea.tender_id AS "TenderId",
          t.title AS "TenderTitle",
          tea.evaluator_id AS "EvaluatorId",
          iu.first_name || ' ' || iu.surname AS "EvaluatorName",
          tea.assignment_date AS "AssignmentDate",
          tea.role AS "Role",
          tea.status AS "Status"
        FROM procurement_workflow.tender_evaluation_assignments tea
        LEFT JOIN vendor_sourcing.tenders t ON tea.tender_id = t.tender_id
        LEFT JOIN identity.internal_users iu ON tea.evaluator_id = iu.internal_user_id
        WHERE tea.tender_id = $1
        ORDER BY tea.assignment_date DESC`,
        [TenderId]
      );
    } else {
      result = await pool.query(
        `SELECT
          tea.tender_id AS "TenderId",
          t.title AS "TenderTitle",
          tea.evaluator_id AS "EvaluatorId",
          iu.first_name || ' ' || iu.surname AS "EvaluatorName",
          tea.assignment_date AS "AssignmentDate",
          tea.role AS "Role",
          tea.status AS "Status"
        FROM procurement_workflow.tender_evaluation_assignments tea
        LEFT JOIN vendor_sourcing.tenders t ON tea.tender_id = t.tender_id
        LEFT JOIN identity.internal_users iu ON tea.evaluator_id = iu.internal_user_id
        ORDER BY tea.assignment_date DESC`
      );
    }

    const assignments = result.rows.map((r) => ({
      TenderId: r.TenderId,
      TenderTitle: r.TenderTitle,
      EvaluatorId: r.EvaluatorId,
      EvaluatorName: r.EvaluatorName,
      AssignmentDate: r.AssignmentDate,
      Role: r.Role,
      Status: r.Status,
    }));

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching assignments.' });
  }
});

// PUT /api/evaluations/assignments/:tenderId
evaluationsRouter.put('/api/evaluations/assignments/:tenderId', async (req, res) => {
  const auth = await requirePermission(req, 'evaluation.assign');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { tenderId } = req.params;
    const { EvaluatorId, Role, Status } = req.body;

    const result = await pool.query(
      `UPDATE procurement_workflow.tender_evaluation_assignments
       SET
        evaluator_id = COALESCE($1, evaluator_id),
        role = COALESCE($2, role),
        status = COALESCE($3, status)
       WHERE tender_id = $4
       RETURNING
        tender_id AS "TenderId",
        evaluator_id AS "EvaluatorId",
        role AS "Role",
        status AS "Status",
        assignment_date AS "AssignmentDate"`,
      [EvaluatorId || null, Role || null, Status || null, tenderId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Assignment not found or update failed.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the assignment.' });
  }
});
