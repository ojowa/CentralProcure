import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const planningCommitteeRouter = Router();

// ─────────────────────────────────────────────
// GET /api/planning-committee/workspace/queue
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/workspace/queue', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const planResult = await pool.query(
      `SELECT
        pp.plan_id AS "PlanId",
        pp.plan_number AS "PlanNumber",
        pp.title AS "Title",
        pp.status AS "Status",
        pp.department_id AS "DepartmentId",
        d.unit_name AS "DepartmentName",
        pp.created_at AS "CreatedAt",
        'Plan' AS "EntityType"
       FROM procurement_workflow.procurement_plans pp
       LEFT JOIN identity.organizational_units d ON pp.department_id = d.unit_id
       WHERE pp.status = 'Pending Committee Review'
       ORDER BY pp.created_at ASC NULLS LAST`
    );

    res.json({ Items: planResult.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the queue.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/plans/:planId/reviews
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/plans/:planId/reviews', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const result = await pool.query(
      `SELECT
        pcr.review_id AS "ReviewId",
        pcr.reviewer_user_id AS "ReviewerId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        pcr.reviewer_role AS "MemberRole",
        pcr.decision AS "Decision",
        pcr.remarks AS "Comments",
        pcr.review_round AS "ReviewRound",
        pcr.created_at AS "ReviewedAt"
       FROM procurement_workflow.planning_committee_member_reviews pcr
       LEFT JOIN identity.internal_users iu ON pcr.reviewer_user_id = iu.internal_user_id::text
       WHERE pcr.plan_id = $1
       ORDER BY pcr.created_at DESC`, [planId]
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching plan reviews.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/plans/:planId/member-statuses
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/plans/:planId/member-statuses', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const result = await pool.query(
      `SELECT
        pcm.role_key AS "MemberRole",
        pcm.status_label AS "StatusLabel",
        pcm.decision AS "Decision",
        pcm.updated_by AS "UpdatedBy",
        pcm.updated_at AS "ReviewedAt"
       FROM procurement_workflow.planning_committee_member_status pcm
       WHERE pcm.plan_id = $1
       ORDER BY pcm.role_key`, [planId]
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching plan member statuses.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/committee-roles
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/committee-roles', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        CASE r.role_name
          WHEN 'PlanningStatisticsOfficer' THEN 'planning_statistics_officer'
          WHEN 'FinancialUnitOfficer' THEN 'financial_unit_officer'
          WHEN 'DepartmentHead' THEN 'department_head'
          WHEN 'LegalReviewer' THEN 'legal_reviewer'
          WHEN 'ProcurementSecretary' THEN 'procurement_secretary'
          WHEN 'Head of Procurement' THEN 'comptroller_procurement'
        END AS "RoleKey",
        r.role_name AS "RoleName",
        r.role_name AS "DisplayName",
        COALESCE(r.description, '') AS "Description",
        (r.role_name = 'Head of Procurement') AS "IsChair"
       FROM identity.roles r
       WHERE r.role_name IN (
         'PlanningStatisticsOfficer',
         'FinancialUnitOfficer',
         'DepartmentHead',
         'LegalReviewer',
         'ProcurementSecretary',
         'Head of Procurement'
       )
       ORDER BY r.role_name`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching committee roles.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/submit-member-review
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/submit-member-review', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.review');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { PlanId, Decision, Comments } = req.body;

    if (!Decision || !['Cleared', 'Queried', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Cleared, Queried, or Rejected.' }); return;
    }

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.planning_committee_member_reviews
        (plan_id, reviewer_role, reviewer_user_id, decision, remarks, review_round, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
       ON CONFLICT ON CONSTRAINT uq_member_review_plan_role_user_round
       DO UPDATE SET decision = $4, remarks = $5, updated_at = NOW()
       RETURNING review_id AS "ReviewId", decision AS "Decision", updated_at AS "ReviewedAt"`,
       [PlanId, auth!.role ?? 'reviewer', auth!.sub, Decision, Comments || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting member review.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/submit-committee-decision
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/submit-committee-decision', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.review');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { PlanId, Decision, Comments } = req.body;

    if (!Decision || !['Recommended', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Recommended, Returned, or Rejected.' }); return;
    }

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const overall = Decision === 'Recommended' ? 'Recommended' :
                    Decision === 'Returned' ? 'ReturnedToDepartment' : 'Rejected';
    const newStatus = Decision === 'Recommended' ? 'Committee Approved' :
                      Decision === 'Returned' ? 'Returned' : 'Rejected';

    const result = await pool.query(
      `UPDATE procurement_workflow.procurement_plans
       SET status = $1, updated_at = NOW()
       WHERE plan_id = $2
       RETURNING plan_id AS "PlanId", status AS "Status"`,
      [newStatus, PlanId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Plan not found.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.planning_committee_decisions
        (plan_id, chairman_user_id, secretary_user_id, overall_decision, committee_remarks, meeting_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NOW(), NOW())
       ON CONFLICT (plan_id)
       DO UPDATE SET overall_decision = $4, committee_remarks = $5, updated_at = NOW()`,
       [PlanId, auth!.sub, auth!.sub, overall, Comments || '']
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting committee decision.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/chairman
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/chairman', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        cfg.committee_code AS "CommitteeCode",
        iu.internal_user_id AS "InternalUserId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        iu.email AS "Email",
        cfg.assigned_by AS "AssignedBy",
        cfg.assigned_at AS "AssignedAt"
       FROM procurement_workflow.planning_committee_configuration cfg
       LEFT JOIN identity.internal_users iu ON cfg.chairman_internal_user_id = iu.internal_user_id
       ORDER BY cfg.assigned_at DESC
       LIMIT 1`
    );

    res.json(result.rows[0] || null);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching chairman.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/planning-committee/chairman
// ─────────────────────────────────────────────
planningCommitteeRouter.put('/api/planning-committee/chairman', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { InternalUserId } = req.body;

    const result = await pool.query(
      `INSERT INTO procurement_workflow.planning_committee_configuration
        (committee_code, chairman_internal_user_id, assigned_by, assigned_at, updated_at)
       VALUES ('planning', $1, $2, NOW(), NOW())
       ON CONFLICT (committee_code)
       DO UPDATE SET chairman_internal_user_id = $1, assigned_by = $2, assigned_at = NOW(), updated_at = NOW()
       RETURNING committee_code AS "CommitteeCode", chairman_internal_user_id AS "InternalUserId", assigned_at AS "AssignedAt"`,
       [InternalUserId || null, auth!.sub]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred upserting chairman.' });
  }
});