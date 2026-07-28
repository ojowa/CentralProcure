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
    const result = await pool.query(
      `SELECT
        r.requisition_id AS "RequisitionId",
        r.requisition_number AS "RequisitionNumber",
        r.title AS "Title",
        r.status AS "Status",
        r.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
        r.created_at AS "CreatedAt",
        r.submitted_for_review_at AS "SubmittedForReviewAt",
        'Requisition' AS "EntityType"
       FROM procurement_workflow.requisitions r
       LEFT JOIN identity.organizational_units d ON r.department_id = d.unit_id
       WHERE r.status = 'Pending Committee Review'
       ORDER BY r.submitted_for_review_at ASC NULLS LAST`
    );

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

    res.json({
      Requisitions: result.rows,
      Plans: planResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching the queue.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/workspace/requisitions/:requisitionId
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/workspace/requisitions/:requisitionId', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;

    const reqResult = await pool.query(
      `SELECT
        r.requisition_id AS "RequisitionId",
        r.requisition_number AS "RequisitionNumber",
        r.title AS "Title",
        r.description AS "Description",
        r.status AS "Status",
        r.department_id AS "DepartmentId",
        d.department_name AS "DepartmentName",
        r.justification AS "Justification",
        r.created_by AS "CreatedBy",
        r.created_at AS "CreatedAt",
        r.submitted_for_review_at AS "SubmittedForReviewAt"
       FROM procurement_workflow.requisitions r
       LEFT JOIN identity.organizational_units d ON r.department_id = d.unit_id
       WHERE r.requisition_id = $1`, [requisitionId]
    );

    if (reqResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Requisition not found.' }); return;
    }

    const itemsResult = await pool.query(
      `SELECT * FROM procurement_workflow.requisition_items WHERE requisition_id = $1`, [requisitionId]
    );

    const reviewsResult = await pool.query(
      `SELECT
        pcr.review_id AS "ReviewId",
        pcr.member_id AS "MemberId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        pcr.decision AS "Decision",
        pcr.comments AS "Comments",
        pcr.reviewed_at AS "ReviewedAt"
       FROM procurement_workflow.planning_committee_reviews pcr
       LEFT JOIN identity.internal_users iu ON pcr.member_id = iu.internal_user_id
       WHERE pcr.requisition_id = $1
       ORDER BY pcr.reviewed_at DESC`, [requisitionId]
    );

    const linkedPlansResult = await pool.query(
      `SELECT
        pr.plan_id AS "PlanId",
        pp.plan_number AS "PlanNumber",
        pp.title AS "PlanTitle",
        pr.linked_at AS "LinkedAt"
       FROM procurement_workflow.plan_requisitions pr
       JOIN procurement_workflow.procurement_plans pp ON pr.plan_id = pp.plan_id
       WHERE pr.requisition_id = $1`, [requisitionId]
    );

    res.json({
      ...reqResult.rows[0],
      Items: itemsResult.rows,
      Reviews: reviewsResult.rows,
      LinkedPlans: linkedPlansResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching workspace requisition.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/workspace/requisitions/:requisitionId/link
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/workspace/requisitions/:requisitionId/link', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { PlanId } = req.body;

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.plan_requisitions (plan_id, requisition_id, linked_by, linked_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (plan_id, requisition_id) DO NOTHING
       RETURNING plan_id AS "PlanId", requisition_id AS "RequisitionId", linked_at AS "LinkedAt"`,
      [PlanId, requisitionId, auth!.sub]
    );

    res.status(201).json(result.rows[0] || { PlanId, RequisitionId: requisitionId, Status: 'Already linked' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred linking the requisition.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/workspace/requisitions/:requisitionId/unlink
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/workspace/requisitions/:requisitionId/unlink', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { PlanId } = req.body;

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const result = await pool.query(
      `DELETE FROM procurement_workflow.plan_requisitions
       WHERE plan_id = $1 AND requisition_id = $2
       RETURNING plan_id AS "PlanId", requisition_id AS "RequisitionId"`,
      [PlanId, requisitionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Link not found.' }); return;
    }

    res.json({ Status: 'Unlinked', ...result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred unlinking the requisition.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/workspace/requisitions/:requisitionId/member-review
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/workspace/requisitions/:requisitionId/member-review', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.planning_committee_reviews
        (requisition_id, member_id, decision, comments, reviewed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (requisition_id, member_id)
       DO UPDATE SET decision = $3, comments = $4, reviewed_at = NOW()
       RETURNING
        review_id AS "ReviewId",
        requisition_id AS "RequisitionId",
        member_id AS "MemberId",
        decision AS "Decision",
        comments AS "Comments",
        reviewed_at AS "ReviewedAt"`,
      [requisitionId, auth!.sub, Decision, Comments || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred submitting member review.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/workspace/requisitions/:requisitionId/finalize
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/workspace/requisitions/:requisitionId/finalize', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    const newStatus = Decision === 'Approved' ? 'Committee Approved' :
                      Decision === 'Returned' ? 'Returned' : 'Rejected';

    const result = await pool.query(
      `UPDATE procurement_workflow.requisitions
       SET status = $1, updated_at = NOW()
       WHERE requisition_id = $2
       RETURNING
        requisition_id AS "RequisitionId",
        requisition_number AS "RequisitionNumber",
        title AS "Title",
        status AS "Status",
        updated_at AS "UpdatedAt"`,
      [newStatus, requisitionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Requisition not found.' }); return;
    }

    await pool.query(
      `INSERT INTO procurement_workflow.committee_decisions
        (requisition_id, decision, comments, finalized_by, finalized_at)
       VALUES ($1, $2, $3, $4, NOW())`,
       [requisitionId, Decision, Comments || '', auth!.sub]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred finalizing committee decision.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/requisitions/:requisitionId/reviews
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/requisitions/:requisitionId/reviews', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;

    const result = await pool.query(
      `SELECT
        pcr.review_id AS "ReviewId",
        pcr.member_id AS "MemberId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        pcr.decision AS "Decision",
        pcr.comments AS "Comments",
        pcr.reviewed_at AS "ReviewedAt"
       FROM procurement_workflow.planning_committee_reviews pcr
       LEFT JOIN identity.internal_users iu ON pcr.member_id = iu.internal_user_id
       WHERE pcr.requisition_id = $1
       ORDER BY pcr.reviewed_at DESC`, [requisitionId]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching reviews.' });
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

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching plan reviews.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/requisitions/:requisitionId/member-statuses
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/requisitions/:requisitionId/member-statuses', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;

    const result = await pool.query(
      `SELECT
        pcm.member_id AS "MemberId",
        iu.first_name || ' ' || iu.surname AS "MemberName",
        pcm.role AS "Role",
        CASE WHEN pcr.review_id IS NOT NULL THEN pcr.decision ELSE 'Pending' END AS "ReviewStatus",
        pcr.reviewed_at AS "ReviewedAt"
       FROM procurement_workflow.planning_committee_members pcm
       LEFT JOIN identity.internal_users iu ON pcm.member_id = iu.internal_user_id
       LEFT JOIN procurement_workflow.planning_committee_reviews pcr
         ON pcm.member_id = pcr.member_id AND pcr.requisition_id = $1
       ORDER BY pcm.role, iu.surname`, [requisitionId]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching member statuses.' });
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

    res.json(result.rows);
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

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching committee roles.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/planning-committee/plan-links
// ─────────────────────────────────────────────
planningCommitteeRouter.get('/api/planning-committee/plan-links', async (req, res) => {
  const payload = requireAuth(req);
  if (!payload?.sub) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const result = await pool.query(
      `SELECT
        pr.plan_id AS "PlanId",
        pp.plan_number AS "PlanNumber",
        pp.title AS "PlanTitle",
        pr.requisition_id AS "RequisitionId",
        r.requisition_number AS "RequisitionNumber",
        r.title AS "RequisitionTitle",
        pr.linked_by AS "LinkedBy",
        pr.linked_at AS "LinkedAt"
       FROM procurement_workflow.plan_requisitions pr
       JOIN procurement_workflow.procurement_plans pp ON pr.plan_id = pp.plan_id
       JOIN procurement_workflow.requisitions r ON pr.requisition_id = r.requisition_id
       ORDER BY pr.linked_at DESC`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching plan links.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/requisitions/:requisitionId/link-plan
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/requisitions/:requisitionId/link-plan', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { PlanId } = req.body;

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const result = await pool.query(
      `INSERT INTO procurement_workflow.plan_requisitions (plan_id, requisition_id, linked_by, linked_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (plan_id, requisition_id) DO NOTHING
       RETURNING plan_id AS "PlanId", requisition_id AS "RequisitionId", linked_at AS "LinkedAt"`,
      [PlanId, requisitionId, auth!.sub]
    );

    res.status(201).json(result.rows[0] || { PlanId, RequisitionId: requisitionId, Status: 'Already linked' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred linking plan.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/planning-committee/requisitions/:requisitionId/unlink-plan
// ─────────────────────────────────────────────
planningCommitteeRouter.post('/api/planning-committee/requisitions/:requisitionId/unlink-plan', async (req, res) => {
  const auth = await requirePermission(req, 'planning_committee.manage');
  if (denyIfNoPermission(res, auth)) return;
  if (!pool) { res.status(500).json({ ErrorMessage: 'Database connection is not configured.' }); return; }

  try {
    const { requisitionId } = req.params;
    const { PlanId } = req.body;

    if (!PlanId) {
      res.status(400).json({ ErrorMessage: 'PlanId is required.' }); return;
    }

    const result = await pool.query(
      `DELETE FROM procurement_workflow.plan_requisitions
       WHERE plan_id = $1 AND requisition_id = $2
       RETURNING plan_id AS "PlanId", requisition_id AS "RequisitionId"`,
      [PlanId, requisitionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Link not found.' }); return;
    }

    res.json({ Status: 'Unlinked', ...result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred unlinking plan.' });
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
    const { RequisitionId, PlanId, Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    if (RequisitionId) {
      const result = await pool.query(
        `INSERT INTO procurement_workflow.planning_committee_reviews
          (requisition_id, member_id, decision, comments, reviewed_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (requisition_id, member_id)
         DO UPDATE SET decision = $3, comments = $4, reviewed_at = NOW()
         RETURNING review_id AS "ReviewId", decision AS "Decision", reviewed_at AS "ReviewedAt"`,
         [RequisitionId, auth!.sub, Decision, Comments || '']
      );
      res.status(201).json(result.rows[0]);
    } else if (PlanId) {
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
    } else {
      res.status(400).json({ ErrorMessage: 'RequisitionId or PlanId is required.' }); return;
    }
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
    const { RequisitionId, PlanId, Decision, Comments } = req.body;

    if (!Decision || !['Approved', 'Returned', 'Rejected'].includes(Decision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be Approved, Returned, or Rejected.' }); return;
    }

    if (RequisitionId) {
      const newStatus = Decision === 'Approved' ? 'Committee Approved' :
                        Decision === 'Returned' ? 'Returned' : 'Rejected';

      const result = await pool.query(
        `UPDATE procurement_workflow.requisitions
         SET status = $1, updated_at = NOW()
         WHERE requisition_id = $2
         RETURNING requisition_id AS "RequisitionId", status AS "Status"`,
        [newStatus, RequisitionId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ ErrorMessage: 'Requisition not found.' }); return;
      }

      await pool.query(
        `INSERT INTO procurement_workflow.committee_decisions
          (requisition_id, decision, comments, finalized_by, finalized_at)
         VALUES ($1, $2, $3, $4, NOW())`,
         [RequisitionId, Decision, Comments || '', auth!.sub]
      );

      res.json(result.rows[0]);
    } else if (PlanId) {
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
    } else {
      res.status(400).json({ ErrorMessage: 'RequisitionId or PlanId is required.' }); return;
    }
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
