import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const planningCommitteeRouter = Router();

function requireAuth(req: any) {
  return extractPayloadFromRequest(req.headers.authorization);
}

// ─────────────────────────────────────────────
// GET /api/planning-committee/workspace/queue
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/workspace/queue', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const planResult = await pool.query(
      `SELECT
        pp.plan_id AS "PlanId",
        pp.plan_number AS "PlanNumber",
        pp.title AS "Title",
        pp.status AS "Status",
        pp.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
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
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const result = await pool.query(
      `SELECT
        pcr.review_id AS "ReviewId",
        pcr.member_id AS "MemberId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        pcr.decision AS "Decision",
        pcr.comments AS "Comments",
        pcr.reviewed_at AS "ReviewedAt"
       FROM procurement_workflow.plan_committee_reviews pcr
       LEFT JOIN identity.internal_users iu ON pcr.member_id = iu.internal_user_id
       WHERE pcr.plan_id = $1
       ORDER BY pcr.reviewed_at DESC`, [planId]
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
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { planId } = req.params;

    const result = await pool.query(
      `SELECT
        pcm.member_id AS "MemberId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        pcm.role AS "Role",
        CASE WHEN pcr.review_id IS NOT NULL THEN pcr.decision ELSE 'Pending' END AS "ReviewStatus",
        pcr.reviewed_at AS "ReviewedAt"
       FROM procurement_workflow.planning_committee_members pcm
       LEFT JOIN identity.internal_users iu ON pcm.member_id = iu.internal_user_id
       LEFT JOIN procurement_workflow.plan_committee_reviews pcr
         ON pcm.member_id = pcr.member_id AND pcr.plan_id = $1
       ORDER BY pcm.role, iu.surname`, [planId]
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
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        role_id AS "RoleId",
        role_name AS "RoleName",
        description AS "Description"
       FROM procurement_workflow.committee_roles
       ORDER BY role_name`
    );

    res.json({ Items: result.rows });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching committee roles.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/submit-member-review
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/submit-member-review', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { PlanId, Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.plan_committee_reviews
        (plan_id, member_id, decision, comments, reviewed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (plan_id, member_id)
       DO UPDATE SET decision = $3, comments = $4, reviewed_at = NOW()
       RETURNING review_id AS "ReviewId", decision AS "Decision", reviewed_at AS "ReviewedAt"`,
       [PlanId, auth!.sub, Decision, Comments || '']
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
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { PlanId, Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const newStatus = Decision === 'Approved' ? 'Committee Approved' :
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
      `INSERT INTO procurement_workflow.plan_committee_decisions
        (plan_id, decision, comments, finalized_by, finalized_at)
       VALUES ($1, $2, $3, $4, NOW())`,
       [PlanId, Decision, Comments || '', auth!.sub]
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
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        pcm.member_id AS "MemberId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        iu.email AS "Email",
        pcm.role AS "Role",
        pcm.assigned_at AS "AssignedAt"
       FROM procurement_workflow.planning_committee_members pcm
       LEFT JOIN identity.internal_users iu ON pcm.member_id = iu.internal_user_id
       WHERE pcm.role = 'Chairman'
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
    const { MemberId } = req.body;

    if (!MemberId) {
      res.status(400).json({ ErrorMessage: 'MemberId is required.' }); return;
    }

    await pool.query(
      `UPDATE procurement_workflow.planning_committee_members
       SET role = 'Member'
       WHERE role = 'Chairman'`
    );

    const result = await pool.query(
      `INSERT INTO procurement_workflow.planning_committee_members (member_id, role, assigned_by, assigned_at)
       VALUES ($1, 'Chairman', $2, NOW())
       ON CONFLICT (member_id)
       DO UPDATE SET role = 'Chairman', assigned_by = $2, assigned_at = NOW()
       RETURNING
        member_id AS "MemberId",
        role AS "Role",
        assigned_at AS "AssignedAt"`,
       [MemberId, auth!.sub]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred upserting chairman.' });
  }
});