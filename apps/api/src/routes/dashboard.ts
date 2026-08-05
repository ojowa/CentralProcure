import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { toCanonicalRoleKey } from '../lib/role-canonical.js';

export const dashboardRouter = Router();

const ROLE_COPY: Record<string, { title: string; subtitle: string }> = {
  admin: { title: 'Administrator Dashboard', subtitle: 'Platform-wide administration and oversight' },
  ict_admin: { title: 'ICT Admin Dashboard', subtitle: 'Platform administration and access management' },
  requisitioning_officer: { title: 'Requisitioning Officer Workspace', subtitle: 'Capture and manage departmental procurement needs' },
  department_head: { title: 'Department Head Dashboard', subtitle: 'Review and endorse departmental procurement needs' },
  formation_officer: { title: 'Formation Officer Workspace', subtitle: 'Capture procurement needs at formation level' },
  formation_head: { title: 'Formation Head Dashboard', subtitle: 'Review and endorse formation procurement needs' },
  comptroller_procurement: { title: 'Comptroller Procurement Dashboard', subtitle: 'Oversee procurement planning and committee reviews' },
  procurement_manager: { title: 'Procurement Manager Dashboard', subtitle: 'Manage tendering and sourcing operations' },
  planning_statistics_officer: { title: 'Planning Statistics Dashboard', subtitle: 'Maintain the annual procurement plan' },
  financial_unit_officer: { title: 'Budget Officer Dashboard', subtitle: 'Manage budget alignment and appropriation controls' },
  procurement_secretary: { title: 'Procurement Secretary Workspace', subtitle: 'Record planning committee decisions' },
  technical_evaluator: { title: 'Technical Evaluation Workspace', subtitle: 'Score vendor technical bids' },
  financial_evaluator: { title: 'Financial Evaluation Workspace', subtitle: 'Review commercial bids and pricing' },
  evaluation_committee: { title: 'Evaluation Committee Workspace', subtitle: 'Run technical and commercial evaluation steps' },
  tenders_board: { title: 'Tenders Board Dashboard', subtitle: 'High-value procurement oversight and decisions' },
  tenders_board_secretary: { title: 'Tenders Board Secretary Workspace', subtitle: 'Record board review outcomes' },
  accounting_officer: { title: 'CGIS Executive Dashboard', subtitle: 'Direct approval authority and executive oversight' },
  bpp_liaison: { title: 'BPP Liaison Workspace', subtitle: 'Coordinate BPP no-objection escalations' },
  bpp_reviewer: { title: 'BPP Review Workspace', subtitle: 'Review escalated cases for BPP' },
  complaints_review_officer: { title: 'Complaints Review Workspace', subtitle: 'Process administrative reviews and protests' },
  contract_manager: { title: 'Contract Management Workspace', subtitle: 'Track milestones and contract delivery' },
  inspection_officer: { title: 'Inspection Workspace', subtitle: 'Verify deliveries before acceptance' },
  payment_officer: { title: 'Payment Tracking Workspace', subtitle: 'Monitor payment milestones' },
  audit_oversight: { title: 'Audit Oversight Dashboard', subtitle: 'Compliance monitoring and traceability controls' },
  legal_reviewer: { title: 'Legal Review Workspace', subtitle: 'Legal review of procurement decisions' },
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

const normalizeRole = (value: string): string => toCanonicalRoleKey(value);

dashboardRouter.get('/api/Auth/internal/dashboard', async (req: Request, res: Response) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  const role = normalizeRole(payload.role || payload.CanonicalRoleKey || '');
  const copy = ROLE_COPY[role] ?? { title: 'Procurement Dashboard', subtitle: 'Welcome to the CentralProcure internal workspace' };

  try {
    const [modulesResult, notificationsResult, thresholdsResult] = await Promise.all([
      pool.query(
        'SELECT im.module_id AS "ModuleId", im.title AS "Title" FROM identity.get_role_modules($1) grm JOIN identity.internal_modules im ON im.module_id = grm.module_id ORDER BY im.title',
        [payload.role || payload.CanonicalRoleKey || '']
      ),
      pool.query('SELECT * FROM identity.get_internal_notifications_sp($1)', [payload.sub]),
      pool.query(
        `SELECT threshold_name AS "ThresholdName", min_amount AS "MinAmount", max_amount AS "MaxAmount",
                approval_authority_label AS "RequiredApprovalLevel", status AS "IsActive"
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
      .slice(0, 5);

    const recentActivity = notifications.slice(0, 5).map((n, index) => ({
      id: `activity-${index + 1}`,
      title: n.Title ?? 'Notification',
      description: n.Message ?? '',
      timestamp: n.CreatedAt ?? new Date().toISOString(),
      status: n.IsRead ? ('completed' as const) : ('pending' as const)
    }));

    res.json({
      Role: toCanonicalRoleKey(payload.role || payload.CanonicalRoleKey || ''),
      Title: copy.title,
      Subtitle: copy.subtitle,
      Metrics: [
        { label: 'Accessible Modules', value: String(modules.length) },
        { label: 'Unread Notifications', value: String(unread.length) },
        { label: 'Active Thresholds', value: String(thresholds.length) }
      ],
      QuickActions: quickActions,
      Alerts: unread.slice(0, 3).map((n) => ({
        type: 'info' as const,
        message: n.Message ?? n.Title ?? ''
      })),
      Thresholds: thresholds.map((t) => ({
        id: t.ThresholdName,
        label: t.ThresholdName,
        min: Number(t.MinAmount),
        max: t.MaxAmount == null ? Number.POSITIVE_INFINITY : Number(t.MaxAmount),
        approvalLevel: t.RequiredApprovalLevel ?? t.ThresholdName,
        timeline: '',
        requiresBpp: false,
        escalation: '',
        steps: []
      })),
      RecentActivity: recentActivity
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred loading the dashboard.' });
  }
});