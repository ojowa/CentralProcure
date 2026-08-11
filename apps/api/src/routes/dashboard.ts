import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();

const ROLE_COPY: Record<string, { title: string; subtitle: string }> = {
  admin: { title: 'Administrator Dashboard', subtitle: 'Platform-wide administration and oversight' },
  department_head: { title: 'Department Head Dashboard', subtitle: 'Review and endorse departmental procurement needs' },
  formation_officer: { title: 'Formation Officer Workspace', subtitle: 'Capture procurement needs at formation level' },
  formation_head: { title: 'Formation Head Dashboard', subtitle: 'Review and endorse formation procurement needs' },
  comptroller_procurement: { title: 'Head of Procurement Dashboard', subtitle: 'Oversee procurement planning and committee reviews' },
  procurement_officer: { title: 'Procurement Officer Workspace', subtitle: 'Manage tendering and sourcing operations' },
  planning_officer: { title: 'Planning Officer Dashboard', subtitle: 'Manage budget, planning committee, and annual plan' },
  evaluator: { title: 'Evaluation Workspace', subtitle: 'Run technical and commercial evaluation steps' },
  board_member: { title: 'Board Member Dashboard', subtitle: 'High-value procurement oversight and decisions' },
  accounting_officer: { title: 'CGIS Executive Dashboard', subtitle: 'Direct approval authority and executive oversight' },
  bpp_officer: { title: 'BPP Officer Workspace', subtitle: 'Manage BPP no-objection submissions and reviews' },
  compliance_officer: { title: 'Compliance Officer Workspace', subtitle: 'Handle complaints, legal review, and compliance' },
  post_award_officer: { title: 'Post-Award Workspace', subtitle: 'Manage contracts, inspections, and payments' },
  audit_oversight: { title: 'Audit Oversight Dashboard', subtitle: 'Compliance monitoring and traceability controls' },
  vendor: { title: 'Vendor Portal', subtitle: 'Manage bids, documents, and submissions' }
};

const MODULE_QUICK_ACTIONS: Record<string, { label: string }> = {
  'needs-collection': { label: 'Needs Assessment' },
  'needs-submission': { label: 'Submit Needs' },
  'annual-procurement-plan': { label: 'Annual Procurement Plan' },
  'procurement-method-determination': { label: 'Method Determination' },
  'create-tender': { label: 'Tender Management' },
  'bid-opening-session': { label: 'Bid Opening' },
  'technical-evaluation': { label: 'Technical Evaluation' },
  'financial-evaluation': { label: 'Financial Evaluation' },
  'evaluation-report': { label: 'Evaluation Report' },
  'assigned-tenders': { label: 'Assigned Tenders' },
  'tender-review': { label: 'Tender Review' },
  'approval-rejection': { label: 'Approval Decisions' },
  'high-value-tenders': { label: 'High-Value Tenders' },
  'cgis-approval': { label: 'CGIS Approvals' },
  'tenders-board-approval': { label: 'Board Approvals' },
  'bpp-escalation': { label: 'BPP Escalations' },
  'administrative-review': { label: 'Complaint Handling' },
  'contract-award': { label: 'Contract Award' },
  'contract-management': { label: 'Contract Management' },
  'inspection-acceptance': { label: 'Inspections' },
  'payment-tracking': { label: 'Payment Tracking' },
  'budget-workspace': { label: 'Budget Workspace' },
  'audit-dashboard': { label: 'Audit Dashboard' },
  'audit-trail-viewer': { label: 'Audit Trail' },
  'compliance-reports': { label: 'Compliance Reports' },
  'user-role-management': { label: 'User Management' },
  'vendor-registration-approval': { label: 'Vendor Approval' },
  'threshold-configuration': { label: 'Threshold Configuration' },
  'system-monitoring': { label: 'System Monitoring' },
  'workflow-configuration': { label: 'Workflow Configuration' },
  'user-profile': { label: 'My Profile' },
  'organization-management': { label: 'Organization Management' }
};

const normalizeRole = (value: string): string => value.trim().toLowerCase();

const deriveActivityType = (title: string, message: string): 'approval' | 'tender' | 'bid' | 'system' => {
  const text = `${title} ${message}`.toLowerCase();
  if (text.includes('approval') || text.includes('approved') || text.includes('rejected') || text.includes('endorse')) return 'approval';
  if (text.includes('tender') || text.includes('evaluation') || text.includes('bid opening')) return 'tender';
  if (text.includes('bid') || text.includes('submission') || text.includes('submitted')) return 'bid';
  return 'system';
};

const deriveAlertType = (title: string, message: string, notificationType?: string): 'warning' | 'info' | 'success' => {
  const text = `${title} ${message} ${notificationType ?? ''}`.toLowerCase();
  if (text.includes('urgent') || text.includes('overdue') || text.includes('expir') || text.includes('warning') || text.includes('rejected')) return 'warning';
  if (text.includes('approved') || text.includes('completed') || text.includes('success') || text.includes('resolved')) return 'success';
  return 'info';
};

dashboardRouter.get('/api/Auth/internal/dashboard', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const auth = authReq.auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  const role = normalizeRole(auth.role || '');
  const copy = ROLE_COPY[role] ?? { title: 'Procurement Dashboard', subtitle: 'Welcome to the CentralProcure internal workspace' };

  try {
    const [modulesResult, notificationsResult, thresholdsResult] = await Promise.all([
      pool.query(
        'SELECT im.module_id AS "ModuleId", im.title AS "Title" FROM identity.get_role_modules($1) grm JOIN identity.internal_modules im ON im.module_id = grm.module_id ORDER BY im.title',
        [auth.role || '']
      ),
      pool.query('SELECT * FROM identity.get_internal_notifications_sp($1, $2)', [auth.sub, 20]),
      pool.query(
        `SELECT threshold_name AS "ThresholdName", min_amount AS "MinAmount", max_amount AS "MaxAmount",
                approval_authority_label AS "RequiredApprovalLevel", status AS "IsActive",
                requires_bpp AS "RequiresBpp", estimated_days AS "EstimatedDays",
                escalation_level AS "EscalationLevel"
         FROM procurement_workflow.approval_thresholds
         WHERE status = 'Active'
         ORDER BY min_amount ASC`
      )
    ]);

    const modules = modulesResult.rows as Array<{ ModuleId: string; Title: string }>;
    const notifications = (notificationsResult.rows ?? []) as Array<{
      Title?: string;
      Message?: string;
      NotificationType?: string;
      IsRead?: boolean;
      CreatedAt?: string;
      ActionUrl?: string | null;
    }>;
    const unread = notifications.filter((n) => !n.IsRead);
    const thresholds = thresholdsResult.rows;

    const quickActions = modules
      .map((module) => ({ label: MODULE_QUICK_ACTIONS[module.ModuleId]?.label ?? module.Title, moduleId: module.ModuleId }))
      .slice(0, 8);

    const recentActivity = notifications.slice(0, 10).map((n, index) => {
      const title = n.Title ?? 'Notification';
      const message = n.Message ?? '';
      return {
        id: `activity-${index + 1}`,
        title,
        description: message,
        timestamp: n.CreatedAt ?? new Date().toISOString(),
        status: n.IsRead ? ('completed' as const) : ('pending' as const),
        type: deriveActivityType(title, message),
        actionUrl: n.ActionUrl ?? null
      };
    });

    res.json({
      Title: copy.title,
      Subtitle: copy.subtitle,
      Metrics: [
        { label: 'Accessible Modules', value: String(modules.length) },
        { label: 'Unread Notifications', value: String(unread.length) },
        { label: 'Active Thresholds', value: String(thresholds.length) }
      ],
      QuickActions: quickActions,
      Alerts: unread.slice(0, 5).map((n) => ({
        type: deriveAlertType(n.Title ?? '', n.Message ?? '', n.NotificationType),
        message: n.Message ?? n.Title ?? ''
      })),
      Thresholds: thresholds.map((t) => ({
        id: t.ThresholdName,
        label: t.ThresholdName,
        min: Number(t.MinAmount),
        max: t.MaxAmount == null ? Number.POSITIVE_INFINITY : Number(t.MaxAmount),
        approvalLevel: t.RequiredApprovalLevel ?? t.ThresholdName,
        timeline: t.EstimatedDays ? `${t.EstimatedDays} days` : '',
        requiresBpp: Boolean(t.RequiresBpp),
        escalation: t.EscalationLevel ?? '',
        steps: []
      })),
      RecentActivity: recentActivity
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred loading the dashboard.' });
  }
});
