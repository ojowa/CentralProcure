import { Router } from 'express';
import { pool, checkDatabase } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const monitoringRouter = Router();

// GET /api/monitoring
monitoringRouter.get('/api/monitoring', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }
  try {
    const dbStatus = await checkDatabase();

    let activeConnections = 0;
    let totalConnections = 0;

    if (pool) {
      try {
        const statsResult = await pool.query(
          `SELECT
            (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active,
            (SELECT COUNT(*) FROM pg_stat_activity) AS total`
        );
        activeConnections = parseInt(statsResult.rows[0]?.active || '0', 10);
        totalConnections = parseInt(statsResult.rows[0]?.total || '0', 10);
      } catch {
        activeConnections = 0;
        totalConnections = 0;
      }
    }

    // Build Services array
    const services = [
      {
        Key: 'database',
        Label: 'Database',
        Status: dbStatus === 'reachable' ? 'Operational' : dbStatus === 'not_configured' ? 'Not Configured' : 'Unreachable',
        Summary: `${activeConnections} active / ${totalConnections} total connections`,
        Count: totalConnections,
      },
      {
        Key: 'api',
        Label: 'API Server',
        Status: 'Operational',
        Summary: `Uptime: ${Math.floor(process.uptime() / 60)} minutes`,
        Count: 1,
      },
      {
        Key: 'memory',
        Label: 'Memory',
        Status: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal > 0.85 ? 'Warning' : 'Operational',
        Summary: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB heap`,
        Count: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    ];

    // Check workflow runtime
    let workflowActive = 0;
    let pendingApprovals = 0;
    let overdueItems = 0;

    if (pool) {
      try {
        const wfResult = await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'Active') AS active,
            COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
            COUNT(*) AS total
           FROM procurement_workflow.workflow_runtime`
        );
        workflowActive = parseInt(wfResult.rows[0]?.active || '0', 10);
        pendingApprovals = parseInt(wfResult.rows[0]?.pending || '0', 10);
      } catch {
        // Table may not exist
      }
    }

    // Check needs collections
    let draftCollections = 0;
    let submittedCollections = 0;
    let endorsedCollections = 0;

    if (pool) {
      try {
        const ncResult = await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'Draft') AS draft,
            COUNT(*) FILTER (WHERE status = 'Submitted') AS submitted,
            COUNT(*) FILTER (WHERE status = 'Endorsed') AS endorsed
           FROM procurement_workflow.needs_collection`
        );
        draftCollections = parseInt(ncResult.rows[0]?.draft || '0', 10);
        submittedCollections = parseInt(ncResult.rows[0]?.submitted || '0', 10);
        endorsedCollections = parseInt(ncResult.rows[0]?.endorsed || '0', 10);
      } catch {
        // Table may not exist
      }
    }

    // Check assessments
    let draftAssessments = 0;
    let endorsedAssessments = 0;

    if (pool) {
      try {
        const assessResult = await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'Draft') AS draft,
            COUNT(*) FILTER (WHERE status = 'Endorsed') AS endorsed
           FROM procurement_workflow.needs_assessment`
        );
        draftAssessments = parseInt(assessResult.rows[0]?.draft || '0', 10);
        endorsedAssessments = parseInt(assessResult.rows[0]?.endorsed || '0', 10);
      } catch {
        // Table may not exist
      }
    }

    // Check tenders
    let activeTenders = 0;

    if (pool) {
      try {
        const tenderResult = await pool.query(
          `SELECT COUNT(*) AS count FROM vendor_sourcing.tenders WHERE status != 'Closed'`
        );
        activeTenders = parseInt(tenderResult.rows[0]?.count || '0', 10);
      } catch {
        // Table may not exist
      }
    }

    // Build Integrations array
    const integrations = [
      {
        Key: 'workflow_engine',
        Label: 'Workflow Engine',
        Status: workflowActive > 0 ? 'Operational' : 'Idle',
        Summary: `${workflowActive} active records, ${pendingApprovals} pending approvals`,
        Count: workflowActive,
      },
      {
        Key: 'needs_pipeline',
        Label: 'Needs Pipeline',
        Status: submittedCollections > 0 ? 'Active' : 'Idle',
        Summary: `${draftCollections} draft, ${submittedCollections} submitted, ${endorsedCollections} endorsed`,
        Count: submittedCollections + endorsedCollections,
      },
      {
        Key: 'assessment_pipeline',
        Label: 'Assessment Pipeline',
        Status: draftAssessments > 0 ? 'Active' : 'Idle',
        Summary: `${draftAssessments} draft, ${endorsedAssessments} endorsed assessments`,
        Count: draftAssessments + endorsedAssessments,
      },
      {
        Key: 'tender_management',
        Label: 'Tender Management',
        Status: activeTenders > 0 ? 'Active' : 'Idle',
        Summary: `${activeTenders} active tenders`,
        Count: activeTenders,
      },
    ];

    // Build Alerts array
    const alerts = [];

    if (submittedCollections > 0) {
      alerts.push({
        Severity: 'Warning',
        Source: 'Needs Pipeline',
        Title: 'Pending Collection Endorsements',
        Detail: `${submittedCollections} needs collections are submitted and awaiting endorsement by department/formation heads.`,
        AffectedCount: submittedCollections,
        OldestAgeDays: null,
      });
    }

    if (draftAssessments > 0) {
      alerts.push({
        Severity: 'Warning',
        Source: 'Assessment Pipeline',
        Title: 'Draft Assessments Pending Review',
        Detail: `${draftAssessments} assessments are in draft status and need to be reviewed and endorsed.`,
        AffectedCount: draftAssessments,
        OldestAgeDays: null,
      });
    }

    if (pendingApprovals > 10) {
      alerts.push({
        Severity: 'Critical',
        Source: 'Workflow Engine',
        Title: 'High Volume of Pending Approvals',
        Detail: `${pendingApprovals} workflow records are pending approval. Consider reviewing the approval queue.`,
        AffectedCount: pendingApprovals,
        OldestAgeDays: null,
      });
    }

    // Build StageLoad array
    const stageLoad = [];

    if (workflowActive > 0) {
      try {
        if (pool) {
          const stageResult = await pool.query(
            `SELECT stage_key, stage_title, COUNT(*) AS active_count
             FROM procurement_workflow.workflow_runtime
             WHERE status = 'Active'
             GROUP BY stage_key, stage_title
             ORDER BY active_count DESC
             LIMIT 10`
          );
          for (const row of stageResult.rows) {
            stageLoad.push({
              StageKey: row.stage_key,
              StageTitle: row.stage_title,
              ActiveCount: parseInt(row.active_count, 10),
            });
          }
        }
      } catch {
        // Query may fail if columns don't exist
      }
    }

    res.json({
      GeneratedAtUtc: new Date().toISOString(),
      TotalAlerts: alerts.length,
      CriticalAlerts: alerts.filter(a => a.Severity === 'Critical').length,
      WarningAlerts: alerts.filter(a => a.Severity === 'Warning').length,
      Services: services,
      Integrations: integrations,
      Alerts: alerts,
      StageLoad: stageLoad,
    });
  } catch (error: any) {
    res.status(500).json({
      Status: 'Error',
      ErrorMessage: error.message || 'An error occurred fetching system status.',
    });
  }
});
