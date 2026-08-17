import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const evaluationsRouter = Router();

// GET /api/evaluations/assigned-tenders/default
evaluationsRouter.get('/api/evaluations/assigned-tenders/default', async (req, res) => {
  const auth = await requirePermission(req, 'evaluation.submit');
  if (denyIfNoPermission(res, auth)) return;
  if (!auth) return;

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
        t.title AS "TenderTitle",
        er.committee_lead AS "CommitteeLead",
        er.recommendation AS "Recommendation",
        er.score_summary AS "ScoreSummary",
        er.status AS "EvaluationStatus",
        er.submitted_at AS "SubmittedAt",
        er.evaluator_id AS "EvaluatorId",
        tea.role AS "AssignmentRole",
        tea.assignment_date AS "AssignmentDate",
        t.category AS "ProcurementCategory",
        t.status AS "TenderStatus",
        t.closing_date AS "SubmissionDeadline",
        t.opening_date AS "OpeningDate"
      FROM procurement_workflow.evaluation_reports er
      LEFT JOIN vendor_sourcing.tenders t ON er.tender_id = t.tender_id
      LEFT JOIN procurement_workflow.tender_evaluation_assignments tea
        ON er.tender_id = tea.tender_id AND er.evaluator_id = tea.evaluator_id
      WHERE er.evaluator_id = $1
      ORDER BY er.submitted_at DESC`,
      [auth.sub]
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
      EvaluatorId: r.EvaluatorId,
      AssignmentRole: r.AssignmentRole,
      AssignmentDate: r.AssignmentDate,
      ProcurementCategory: r.ProcurementCategory,
      TenderStatus: r.TenderStatus,
      SubmissionDeadline: r.SubmissionDeadline,
      OpeningDate: r.OpeningDate,
    }));

    res.json({ Items: assigned });
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
    const { TenderId, ReportCode, ActionType, Reason, Notes, Justification, Recommendation, ThresholdNote, ScorePercentage, FinancialRank, TechnicalPass } = req.body;

    if (!TenderId || !ActionType) {
      res.status(400).json({ ErrorMessage: 'TenderId and ActionType are required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.evaluation_actions
        (action_type, tender_id, report_code, reason, notes, justification, recommendation, threshold_note, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
        action_id AS "ActionId",
        action_type AS "ActionType",
        tender_id AS "TenderId",
        report_code AS "ReportCode",
        reason AS "Reason",
        notes AS "Notes",
        justification AS "Justification",
        recommendation AS "Recommendation",
        threshold_note AS "ThresholdNote",
        requested_by AS "RequestedBy",
        created_at AS "CreatedAt"`,
      [ActionType, TenderId, ReportCode || null, Reason || null, Notes || null, Justification || null, Recommendation || null, ThresholdNote || null, auth!.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred recording the evaluation action.' });
  }
});

// GET /api/evaluations/assignments
evaluationsRouter.get('/api/evaluations/assignments', async (req, res) => {
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
    const { TenderId } = req.query;

    let result;
    if (TenderId) {
      result = await pool.query(
        `SELECT
          tea.tender_id AS "TenderId",
          t.title AS "TenderTitle",
          t.status AS "TenderStatus",
          tea.assignment_role AS "AssignmentRole",
          tea.internal_user_id AS "InternalUserId",
          iu.email AS "Email",
          iu.username AS "Username",
          r.role_name AS "RoleName",
          ou.unit_name AS "UnitName",
          tea.assigned_by AS "AssignedBy",
          tea.assigned_at AS "AssignedAt"
        FROM procurement_workflow.tender_evaluation_assignments tea
        LEFT JOIN vendor_sourcing.tenders t ON tea.tender_id = t.tender_id
        LEFT JOIN identity.internal_users iu ON tea.internal_user_id = iu.internal_user_id
        LEFT JOIN identity.roles r ON r.role_id = iu.role_id
        LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
        WHERE tea.tender_id = $1
        ORDER BY tea.assignment_role`, [TenderId]
      );
    } else {
      result = await pool.query(
        `SELECT
          tea.tender_id AS "TenderId",
          t.title AS "TenderTitle",
          t.status AS "TenderStatus",
          tea.assignment_role AS "AssignmentRole",
          tea.internal_user_id AS "InternalUserId",
          iu.email AS "Email",
          iu.username AS "Username",
          r.role_name AS "RoleName",
          ou.unit_name AS "UnitName",
          tea.assigned_by AS "AssignedBy",
          tea.assigned_at AS "AssignedAt"
        FROM procurement_workflow.tender_evaluation_assignments tea
        LEFT JOIN vendor_sourcing.tenders t ON tea.tender_id = t.tender_id
        LEFT JOIN identity.internal_users iu ON tea.internal_user_id = iu.internal_user_id
        LEFT JOIN identity.roles r ON r.role_id = iu.role_id
        LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
        ORDER BY t.title, tea.assignment_role`
      );
    }

    const assignments = result.rows.map((r) => ({
      TenderId: r.TenderId,
      TenderTitle: r.TenderTitle,
      TenderStatus: r.TenderStatus || 'Unknown',
      AssignmentRole: r.AssignmentRole,
      InternalUserId: r.InternalUserId,
      Email: r.Email,
      Username: r.Username,
      RoleName: r.RoleName,
      UnitName: r.UnitName,
      AssignedBy: r.AssignedBy,
      AssignedAt: r.AssignedAt,
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
    const { AssignmentRole, InternalUserId } = req.body;

    if (!AssignmentRole) {
      res.status(400).json({ ErrorMessage: 'AssignmentRole is required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.tender_evaluation_assignments
        (tender_id, assignment_role, internal_user_id, assigned_by, status)
       VALUES ($1, $2, $3, $4, CASE WHEN $3 IS NOT NULL THEN 'Assigned' ELSE 'Unassigned' END)
       ON CONFLICT (tender_id, assignment_role)
       DO UPDATE SET
        internal_user_id = $3,
        assigned_by = $4,
        status = CASE WHEN $3 IS NOT NULL THEN 'Assigned' ELSE 'Unassigned' END,
        updated_at = now()
       RETURNING
        tender_id AS "TenderId",
        assignment_role AS "AssignmentRole",
        internal_user_id AS "InternalUserId",
        status AS "Status",
        assigned_at AS "AssignedAt"`,
      [tenderId, AssignmentRole, InternalUserId || null, auth!.sub]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating the assignment.' });
  }
});
