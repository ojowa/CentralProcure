import { useEffect, useMemo, useState } from 'react';
import type {
  InternalModule,
  BidOpeningSessionCreateRequest,
  BidOpeningSessionDetail,
  BidOpeningSessionSummary,
  BidOpeningSessionUpdateRequest,
  BppNoObjectionCreateRequest,
  BppNoObjectionDetail,
  BppNoObjectionUpdateRequest,
  ContractAwardItem,
  ContractManagementItem,
  ContractMilestoneItem,
  InspectionItem,
  AssignedTenderItem,
  EvaluationReportItem,
  ProcurementPlanCreateRequest,
  ProcurementPlanListResponse,
  ProcurementPlanSummary,
  ProcurementPlanUpdateRequest,
  ProcurementPlanItemDetail,
  RequisitionCreateRequest,
  RequisitionDetail,
  RequisitionLineItem,
  RequisitionListResponse,
  RequisitionSummary,
  RequisitionUpdateRequest,
  RoleDefinition,
  RoleKey,
  TenderCreateRequest,
  TenderDetail,
  TenderUpdateRequest,
  TenderSummary,
  TenderPublishRequest,
  BudgetSummaryResponse,
  ApprovalThresholdDetail,
  WorkflowBlueprint,
  WorkflowBlueprintPhase,
  WorkflowBlueprintRoleTask,
  WorkflowBlueprintState,
  WorkflowBlueprintThreshold
} from '../types/internal';
import {
  createProcurementPlan,
  deleteProcurementPlan,
  fetchProcurementPlans,
  updateProcurementPlan
} from '../services/procurementPlanService';
import { createTender, fetchTenderDetail, fetchTenders, publishTender, updateTender } from '../services/tenderService';
import {
  createBidOpeningSession,
  fetchBidOpeningSessionDetail,
  fetchBidOpeningSessions,
  updateBidOpeningSession
} from '../services/bidOpeningService';
import {
  createRequisition,
  fetchRequisitionDetail,
  fetchRequisitions,
  updateRequisition
} from '../services/requisitionService';
import { fetchProcurementPlanItems } from '../services/procurementPlanItemService';
import { fetchBudgetSummary } from '../services/budgetService';
import { resolveApprovalThreshold } from '../services/approvalThresholdService';
import { fetchContractAwardDetail, fetchContractAwards, publishContractAward } from '../services/contractAwardService';
import {
  fetchContractDetail,
  fetchContractMilestones,
  fetchContracts,
  logContractMilestone
} from '../services/contractManagementService';
import { fetchInspectionDetail, fetchInspections } from '../services/inspectionService';
import { fetchEvaluationReportDetail, fetchEvaluationReports } from '../services/evaluationReportService';
import { logEvaluationAction } from '../services/evaluationActionService';
import {
  createBppNoObjection,
  fetchBppNoObjectionDetail,
  fetchBppNoObjections,
  updateBppNoObjection
} from '../services/bppNoObjectionService';
import { fetchWorkflowBlueprint } from '../services/workflowBlueprintService';
import { WorkflowConfigurationModulePage } from './WorkflowConfigurationModulePage';

interface HeaderProps {
  role: RoleDefinition;
  onSignOut: () => void;
}

const toTitle = (value: string) =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const readField = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }
  return undefined;
};

const toText = (value: unknown, fallback = '') => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const toFlag = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
};

const hasModuleAction = (module: InternalModule, action: string) =>
  Array.isArray(module.actions) && module.actions.includes(action);

const adminQuickActions = {
  'user-role-management': [
    { title: 'Provision Internal User', detail: 'Assign role, unit, and approval scope.' },
    { title: 'Create Role Profile', detail: 'Define guardrails and module entitlements.' },
    { title: 'Review Access Requests', detail: 'Resolve escalations and approvals.' }
  ],
  'workflow-configuration': [
    { title: 'Publish Workflow Gate', detail: 'Deploy updated routing rules.' },
    { title: 'Adjust Approval Thresholds', detail: 'Enforce statutory limits.' },
    { title: 'Audit Routing Policy', detail: 'Compare policy against PPA rules.' }
  ],
  'system-monitoring': [
    { title: 'Acknowledge Alerts', detail: 'Resolve critical service issues.' },
    { title: 'Schedule Health Check', detail: 'Run diagnostics across services.' },
    { title: 'Export Incident Report', detail: 'Share compliance-grade logs.' }
  ]
};

const fallbackRoles = [
  { roleName: 'admin', description: 'Administrative oversight across access, workflow policy, and compliance reporting.', isActive: true },
  { roleName: 'ict_admin', description: 'Platform administration and policy enforcement.', isActive: true },
  { roleName: 'department_head', description: 'Department-level review, readiness monitoring, and escalation visibility.', isActive: true },
  { roleName: 'procurement_officer', description: 'Procurement lifecycle management.', isActive: true },
  { roleName: 'procurement_manager', description: 'Operational oversight across planning, tenders, and contract controls.', isActive: true },
  { roleName: 'planning_statistics_officer', description: 'Planning, research, and annual procurement review.', isActive: true },
  { roleName: 'financial_unit_officer', description: 'Budget and financial readiness oversight.', isActive: true },
  { roleName: 'legal_reviewer', description: 'Legal compliance and documentation review.', isActive: true },
  { roleName: 'technical_evaluator', description: 'Technical evaluation and subject-matter scoring.', isActive: true },
  { roleName: 'financial_evaluator', description: 'Commercial and arithmetic bid evaluation.', isActive: true },
  { roleName: 'evaluation_committee', description: 'Committee-level evaluation oversight and reporting.', isActive: true },
  { roleName: 'tenders_board', description: 'Immigration Tender Board approvals and governance.', isActive: true },
  { roleName: 'tenders_board_secretary', description: 'Board submission coordination, recordkeeping, and decision documentation.', isActive: true },
  { roleName: 'bpp_liaison', description: 'BPP intake coordination, submission packaging, and escalation tracking.', isActive: true },
  { roleName: 'bpp_reviewer', description: 'BPP regulatory review, no-objection outcomes, and decision traceability.', isActive: true },
  { roleName: 'complaints_review_officer', description: 'Administrative review and bidder challenge handling.', isActive: true },
  { roleName: 'contract_manager', description: 'Post-award milestone and performance monitoring.', isActive: true },
  { roleName: 'inspection_officer', description: 'Inspection and acceptance recording.', isActive: true },
  { roleName: 'payment_officer', description: 'Payment milestone and disbursement tracking.', isActive: true },
  { roleName: 'audit_oversight', description: 'Compliance and oversight reviews.', isActive: true }
];

const accessRequests = [
  { name: 'Amina Yusuf', role: 'Procurement Officer', reason: 'APP approvals', status: 'Pending' },
  { name: 'Chinedu Okafor', role: 'Evaluation Committee', reason: 'Bid scoring cycle', status: 'Pending' },
  { name: 'Grace Udo', role: 'Audit Oversight', reason: 'Quarterly audit review', status: 'Escalated' }
];

const workflowGates = [
  { gate: 'Threshold Gate', scope: 'NGN 100M+', status: 'Locked' },
  { gate: 'Segregation Check', scope: 'Role separation', status: 'Locked' },
  { gate: 'No-Objection Gate', scope: 'BPP compliance', status: 'Enabled' },
  { gate: 'Document Completeness', scope: 'Tender pack', status: 'Enabled' }
];

const policySignals = [
  { label: 'Active Workflow Versions', value: '6' },
  { label: 'Policy Exceptions', value: '2' },
  { label: 'Pending Updates', value: '3' }
];

const serviceHealth = [
  { service: 'Identity Service', uptime: '99.98%', status: 'Healthy' },
  { service: 'Procurement Workflow', uptime: '99.92%', status: 'Healthy' },
  { service: 'Vendor Sourcing', uptime: '99.61%', status: 'Degraded' },
  { service: 'Post Award', uptime: '99.88%', status: 'Healthy' }
];

const monitoringAlerts = [
  { title: 'Vendor Sourcing latency', detail: 'Average latency 1.9s', status: 'Investigate' },
  { title: 'Workflow retries', detail: '3 retries in last hour', status: 'Watch' },
  { title: 'Audit log backlog', detail: '2,314 events pending', status: 'Escalate' }
];

type BudgetLineItem = {
  id: string;
  title: string;
  planRef: string;
  budgetCode: string;
  department: string;
  fiscalYear: number;
  allocated: number;
  committed: number;
  reserved: number;
  procurementCategory: string;
};

type BudgetUtilizationPoint = {
  period: string;
  committed: number;
  released: number;
  utilization: number;
};

type BudgetAuditAction =
  | 'Availability Check'
  | 'Commitment'
  | 'Hold'
  | 'Release'
  | 'Override'
  | 'BPP No Objection'
  | 'Reversal';

type BudgetAuditStatus = 'Completed' | 'Pending' | 'Escalated' | 'Rejected';

type BudgetAuditEvent = {
  id: string;
  timestamp: string;
  action: BudgetAuditAction;
  status: BudgetAuditStatus;
  budgetCode: string;
  appLineItemId: string;
  amount: number;
  actor: string;
  reference: string;
  notes: string;
};

type ThresholdBand = {
  id: string;
  label: string;
  min: number;
  max: number;
  approvalLevel: string;
  timeline: string;
  requiresBpp: boolean;
  escalation: string;
  steps: string[];
};

const budgetLineItems: BudgetLineItem[] = [
  {
    id: 'APP-ICT-2026-01',
    title: 'Data Center Power Upgrade',
    planRef: 'APP-ICT-2026',
    budgetCode: 'CAP-ICT-2026-04',
    department: 'Infrastructure & ICT',
    fiscalYear: 2026,
    allocated: 150_000_000,
    committed: 60_000_000,
    reserved: 15_000_000,
    procurementCategory: 'Infrastructure'
  },
  {
    id: 'APP-ICT-2026-02',
    title: 'National Network Refresh',
    planRef: 'APP-ICT-2026',
    budgetCode: 'CAP-ICT-2026-09',
    department: 'Infrastructure & ICT',
    fiscalYear: 2026,
    allocated: 220_000_000,
    committed: 110_000_000,
    reserved: 25_000_000,
    procurementCategory: 'Connectivity'
  },
  {
    id: 'APP-FIN-2026-03',
    title: 'Treasury Automation Upgrade',
    planRef: 'APP-FIN-2026',
    budgetCode: 'CAP-FIN-2026-02',
    department: 'Finance',
    fiscalYear: 2026,
    allocated: 95_000_000,
    committed: 42_000_000,
    reserved: 8_500_000,
    procurementCategory: 'Automation'
  },
  {
    id: 'APP-OPS-2026-04',
    title: 'Regional Office Renovations',
    planRef: 'APP-OPS-2026',
    budgetCode: 'CAP-OPS-2026-07',
    department: 'Operations',
    fiscalYear: 2026,
    allocated: 180_000_000,
    committed: 90_000_000,
    reserved: 22_000_000,
    procurementCategory: 'Facilities'
  },
  {
    id: 'APP-SEC-2026-05',
    title: 'Security Screening Equipment',
    planRef: 'APP-SEC-2026',
    budgetCode: 'CAP-SEC-2026-01',
    department: 'Security',
    fiscalYear: 2026,
    allocated: 260_000_000,
    committed: 140_000_000,
    reserved: 35_000_000,
    procurementCategory: 'Security'
  }
];

const budgetUtilizationHistory: Record<string, BudgetUtilizationPoint[]> = {
  'APP-ICT-2026-01': [
    { period: 'Oct 2025', committed: 38_000_000, released: 8_000_000, utilization: 31 },
    { period: 'Nov 2025', committed: 44_000_000, released: 10_000_000, utilization: 36 },
    { period: 'Dec 2025', committed: 52_000_000, released: 14_000_000, utilization: 44 },
    { period: 'Jan 2026', committed: 58_000_000, released: 18_000_000, utilization: 51 },
    { period: 'Feb 2026', committed: 60_000_000, released: 22_000_000, utilization: 55 },
    { period: 'Mar 2026', committed: 62_000_000, released: 24_000_000, utilization: 58 }
  ],
  'APP-ICT-2026-02': [
    { period: 'Oct 2025', committed: 80_000_000, released: 16_000_000, utilization: 36 },
    { period: 'Nov 2025', committed: 95_000_000, released: 20_000_000, utilization: 43 },
    { period: 'Dec 2025', committed: 102_000_000, released: 24_000_000, utilization: 48 },
    { period: 'Jan 2026', committed: 108_000_000, released: 30_000_000, utilization: 55 },
    { period: 'Feb 2026', committed: 110_000_000, released: 34_000_000, utilization: 59 },
    { period: 'Mar 2026', committed: 112_000_000, released: 40_000_000, utilization: 63 }
  ],
  'APP-FIN-2026-03': [
    { period: 'Oct 2025', committed: 28_000_000, released: 6_000_000, utilization: 34 },
    { period: 'Nov 2025', committed: 31_000_000, released: 7_000_000, utilization: 38 },
    { period: 'Dec 2025', committed: 36_000_000, released: 9_000_000, utilization: 42 },
    { period: 'Jan 2026', committed: 38_000_000, released: 10_000_000, utilization: 45 },
    { period: 'Feb 2026', committed: 42_000_000, released: 12_000_000, utilization: 48 },
    { period: 'Mar 2026', committed: 44_000_000, released: 14_000_000, utilization: 52 }
  ],
  'APP-OPS-2026-04': [
    { period: 'Oct 2025', committed: 62_000_000, released: 12_000_000, utilization: 37 },
    { period: 'Nov 2025', committed: 70_000_000, released: 16_000_000, utilization: 42 },
    { period: 'Dec 2025', committed: 76_000_000, released: 18_000_000, utilization: 45 },
    { period: 'Jan 2026', committed: 82_000_000, released: 20_000_000, utilization: 49 },
    { period: 'Feb 2026', committed: 88_000_000, released: 24_000_000, utilization: 53 },
    { period: 'Mar 2026', committed: 90_000_000, released: 28_000_000, utilization: 56 }
  ],
  'APP-SEC-2026-05': [
    { period: 'Oct 2025', committed: 110_000_000, released: 24_000_000, utilization: 41 },
    { period: 'Nov 2025', committed: 120_000_000, released: 28_000_000, utilization: 46 },
    { period: 'Dec 2025', committed: 130_000_000, released: 32_000_000, utilization: 50 },
    { period: 'Jan 2026', committed: 134_000_000, released: 36_000_000, utilization: 53 },
    { period: 'Feb 2026', committed: 140_000_000, released: 40_000_000, utilization: 58 },
    { period: 'Mar 2026', committed: 146_000_000, released: 44_000_000, utilization: 62 }
  ]
};

const budgetAuditEvents: BudgetAuditEvent[] = [
  {
    id: 'AUD-2026-0310',
    timestamp: '2026-03-04T09:15:00Z',
    action: 'Availability Check',
    status: 'Completed',
    budgetCode: 'CAP-ICT-2026-04',
    appLineItemId: 'APP-ICT-2026-01',
    amount: 8_900_000,
    actor: 'Budget Control Desk',
    reference: 'REQ-2026-1182',
    notes: 'Availability confirmed for requisition submission.'
  },
  {
    id: 'AUD-2026-0309',
    timestamp: '2026-03-03T14:42:00Z',
    action: 'Hold',
    status: 'Escalated',
    budgetCode: 'CAP-SEC-2026-01',
    appLineItemId: 'APP-SEC-2026-05',
    amount: 32_000_000,
    actor: 'Audit Oversight',
    reference: 'TEN-SEC-904',
    notes: 'Hold placed pending BPP confirmation.'
  },
  {
    id: 'AUD-2026-0308',
    timestamp: '2026-03-02T11:05:00Z',
    action: 'Commitment',
    status: 'Completed',
    budgetCode: 'CAP-OPS-2026-07',
    appLineItemId: 'APP-OPS-2026-04',
    amount: 18_500_000,
    actor: 'Procurement Unit',
    reference: 'REQ-OPS-412',
    notes: 'Committed for office renovation lot 2.'
  },
  {
    id: 'AUD-2026-0307',
    timestamp: '2026-03-01T16:18:00Z',
    action: 'Release',
    status: 'Completed',
    budgetCode: 'CAP-FIN-2026-02',
    appLineItemId: 'APP-FIN-2026-03',
    amount: 12_000_000,
    actor: 'Finance Director',
    reference: 'REL-FIN-203',
    notes: 'Release approved for phase 1 automation.'
  },
  {
    id: 'AUD-2026-0306',
    timestamp: '2026-02-27T10:52:00Z',
    action: 'Override',
    status: 'Pending',
    budgetCode: 'CAP-ICT-2026-09',
    appLineItemId: 'APP-ICT-2026-02',
    amount: 25_000_000,
    actor: 'Accounting Officer',
    reference: 'OVR-ICT-112',
    notes: 'Pending justification review.'
  },
  {
    id: 'AUD-2026-0305',
    timestamp: '2026-02-25T08:30:00Z',
    action: 'BPP No Objection',
    status: 'Pending',
    budgetCode: 'CAP-SEC-2026-01',
    appLineItemId: 'APP-SEC-2026-05',
    amount: 110_000_000,
    actor: 'BPP Liaison',
    reference: 'BPP-REQ-778',
    notes: 'Awaiting no-objection certificate.'
  },
  {
    id: 'AUD-2026-0304',
    timestamp: '2026-02-21T15:06:00Z',
    action: 'Availability Check',
    status: 'Completed',
    budgetCode: 'CAP-OPS-2026-07',
    appLineItemId: 'APP-OPS-2026-04',
    amount: 45_000_000,
    actor: 'Budget Control Desk',
    reference: 'REQ-OPS-389',
    notes: 'Funds available with 24% headroom.'
  },
  {
    id: 'AUD-2026-0303',
    timestamp: '2026-02-18T12:44:00Z',
    action: 'Reversal',
    status: 'Completed',
    budgetCode: 'CAP-ICT-2026-04',
    appLineItemId: 'APP-ICT-2026-01',
    amount: 6_500_000,
    actor: 'Budget Control Desk',
    reference: 'REV-ICT-052',
    notes: 'Reversal posted after tender cancellation.'
  },
  {
    id: 'AUD-2026-0302',
    timestamp: '2026-02-15T09:58:00Z',
    action: 'Hold',
    status: 'Completed',
    budgetCode: 'CAP-ICT-2026-09',
    appLineItemId: 'APP-ICT-2026-02',
    amount: 40_000_000,
    actor: 'Procurement Unit',
    reference: 'TEN-ICT-241',
    notes: 'Hold placed pending evaluation outcome.'
  },
  {
    id: 'AUD-2026-0301',
    timestamp: '2026-02-12T13:20:00Z',
    action: 'Release',
    status: 'Completed',
    budgetCode: 'CAP-ICT-2026-09',
    appLineItemId: 'APP-ICT-2026-02',
    amount: 22_000_000,
    actor: 'Finance Director',
    reference: 'REL-ICT-083',
    notes: 'Release approved after clarification.'
  },
  {
    id: 'AUD-2026-0299',
    timestamp: '2026-02-08T10:05:00Z',
    action: 'BPP No Objection',
    status: 'Completed',
    budgetCode: 'CAP-OPS-2026-07',
    appLineItemId: 'APP-OPS-2026-04',
    amount: 80_000_000,
    actor: 'BPP Liaison',
    reference: 'BPP-REQ-612',
    notes: 'No-objection certificate issued.'
  },
  {
    id: 'AUD-2026-0297',
    timestamp: '2026-02-04T15:48:00Z',
    action: 'Override',
    status: 'Rejected',
    budgetCode: 'CAP-FIN-2026-02',
    appLineItemId: 'APP-FIN-2026-03',
    amount: 18_000_000,
    actor: 'Accounting Officer',
    reference: 'OVR-FIN-091',
    notes: 'Override rejected due to insufficient release.'
  }
];

const thresholdBands: ThresholdBand[] = [
  {
    id: 'below-50m',
    label: 'Below NGN 50M',
    min: 0,
    max: 50_000_000,
    approvalLevel: 'Departmental Tenders Committee',
    timeline: '30 - 45 days',
    requiresBpp: false,
    escalation: 'Escalate to Immigration Tender Board if above departmental delegation.',
    steps: ['Evaluation Committee Review', 'Departmental Tenders Committee', 'Accounting Officer Sign-off']
  },
  {
    id: '50m-100m',
    label: 'NGN 50M - 100M',
    min: 50_000_000,
    max: 100_000_000,
    approvalLevel: 'Immigration Tender Board',
    timeline: '45 - 60 days',
    requiresBpp: false,
    escalation: 'Escalate to Accounting Officer for final sign-off.',
    steps: ['Evaluation Committee Review', 'Immigration Tender Board Review', 'Accounting Officer Sign-off']
  },
  {
    id: '100m-250m',
    label: 'NGN 100M - 250M',
    min: 100_000_000,
    max: 250_000_000,
    approvalLevel: 'Accounting Officer',
    timeline: '60 - 90 days',
    requiresBpp: true,
    escalation: 'BPP no-objection required before award.',
    steps: ['Evaluation Committee Review', 'Immigration Tender Board Review', 'Accounting Officer Review', 'BPP No Objection']
  },
  {
    id: '250m-plus',
    label: 'NGN 250M+',
    min: 250_000_000,
    max: Number.POSITIVE_INFINITY,
    approvalLevel: 'Federal Executive Council',
    timeline: '90 - 120 days',
    requiresBpp: true,
    escalation: 'BPP no-objection and FEC approval required.',
    steps: ['Evaluation Committee Review', 'Immigration Tender Board Review', 'Accounting Officer Review', 'BPP No Objection', 'FEC Approval']
  }
];

const resolveThresholdRouting = (amount: number) => {
  const safeAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  const band = thresholdBands.find((entry) => safeAmount >= entry.min && safeAmount < entry.max) ?? thresholdBands[0];
  return {
    ...band,
    amount: safeAmount
  };
};

const getBudgetCheck = (
  amount: number,
  appLineItemId?: string,
  budgetCode?: string,
  summary?: BudgetSummaryResponse | null,
  itemOverride?: BudgetLineItem | null
) => {
  const normalizedAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  const match =
    itemOverride ??
    budgetLineItems.find((item) => (appLineItemId ? item.id === appLineItemId : false)) ??
    budgetLineItems.find((item) => (budgetCode ? item.budgetCode === budgetCode : false));

  if (!match && !summary) {
    return {
      status: 'unknown' as const,
      amount: normalizedAmount,
      appropriated: 0,
      released: 0,
      committed: 0,
      spent: 0,
      reserved: 0,
      available: 0,
      variance: 0,
      item: null as BudgetLineItem | null,
      message: 'Select an APP line item to validate availability.'
    };
  }

  const appropriated = summary?.Appropriated ?? match?.allocated ?? 0;
  const released = summary?.Released ?? 0;
  const committed = summary?.Committed ?? match?.committed ?? 0;
  const spent = summary?.Spent ?? 0;
  const reserved = summary ? 0 : match?.reserved ?? 0;
  const available = summary ? summary.Available : appropriated - committed - reserved;

  if (!normalizedAmount) {
    return {
      status: 'unknown' as const,
      amount: normalizedAmount,
      appropriated,
      released,
      committed,
      spent,
      reserved,
      available,
      variance: 0,
      item: match ?? null,
      message: 'Enter an estimated amount to run the availability check.'
    };
  }

  const variance = normalizedAmount - available;
  const status = variance <= 0 ? 'sufficient' : 'insufficient';

  return {
    status,
    amount: normalizedAmount,
    appropriated,
    released,
    committed,
    spent,
    reserved,
    available,
    variance: Math.abs(variance),
    item: match ?? null,
    message:
      status === 'sufficient'
        ? 'Budget availability confirmed for this request.'
        : 'Budget availability shortfall detected.'
  };
};

const resolveBppStatus = (status: string | null | undefined, requiresBpp: boolean) => {
  if (!requiresBpp) {
    return { label: 'Not Required', tone: 'admin-status--good' };
  }
  const normalized = (status ?? '').toLowerCase();
  if (['awarded', 'approved', 'published'].includes(normalized)) {
    return { label: 'Issued', tone: 'admin-status--good' };
  }
  if (['closed', 'under review', 'pending approval'].includes(normalized)) {
    return { label: 'Pending', tone: 'admin-status--warn' };
  }
  return { label: 'Required', tone: 'admin-status--alert' };
};

const InternalHeader = ({ role, onSignOut }: HeaderProps) => {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="portal-topbar">
      <div className="portal-brand">
        <div className="portal-emblem">NIS</div>
        <div>
          <div className="portal-title">NIS e-Procurement</div>
          <div className="portal-subtitle">Internal Control Center</div>
        </div>
      </div>
      <div className="portal-meta">
        <span className="portal-chip">
          Role: <strong>{role.name}</strong>
        </span>
        <span className="portal-chip">
          Today: <strong>{today}</strong>
        </span>
        <button type="button" className="portal-signout" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </header>
  );
};

interface SidebarProps {
  modules: InternalModule[];
  activeModuleId: string;
  onModuleChange: (moduleId: string) => void;
}

const SidebarNav = ({ modules, activeModuleId, onModuleChange }: SidebarProps) => {
  const grouped = modules.reduce<Record<string, InternalModule[]>>((accumulator, module) => {
    accumulator[module.section] = accumulator[module.section] ?? [];
    accumulator[module.section].push(module);
    return accumulator;
  }, {});

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__title">Workflow Modules</div>
      {Object.entries(grouped).map(([section, sectionModules]) => (
        <section key={section} className="portal-sidebar-section">
          <h3>{section}</h3>
          {sectionModules.map((module) => (
            <button
              type="button"
              key={module.id}
              className={module.id === activeModuleId ? 'active' : ''}
              onClick={() => onModuleChange(module.id)}
            >
              {module.title}
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
};

interface DashboardProps {
  modules: InternalModule[];
}

const DashboardPage = ({ modules }: DashboardProps) => {
  const moduleCount = modules.length;
  const sectionCount = new Set(modules.map((module) => module.section)).size;
  const controlCount = new Set(modules.map((module) => module.controlPurpose)).size;
  const topModules = modules.slice(0, 6);

  return (
    <section className="portal-dashboard">
      <h2>Role Dashboard</h2>
      <p>Your access is scoped to modules approved for your role.</p>
      <div className="portal-stats">
        <article className="portal-stat">
          <strong>{moduleCount}</strong>
          <span>Accessible Modules</span>
        </article>
        <article className="portal-stat">
          <strong>{sectionCount}</strong>
          <span>Workflow Sections</span>
        </article>
        <article className="portal-stat">
          <strong>{controlCount}</strong>
          <span>Governance Controls</span>
        </article>
      </div>
      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        {topModules.map((module) => (
          <article key={module.id} className="portal-module-card">
            <h3>{module.title}</h3>
            <p>{module.microservice}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

interface ModulePageProps {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  isLoading: boolean;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
}

const planStatuses = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled'];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTimeShort = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const budgetAuditStatusTone = (status: BudgetAuditStatus) => {
  switch (status) {
    case 'Completed':
      return 'admin-status--good';
    case 'Pending':
      return 'admin-status--warn';
    case 'Escalated':
    case 'Rejected':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const statusTone = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'admin-status--good';
    case 'Submitted':
      return 'admin-status--warn';
    case 'Rejected':
    case 'Cancelled':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const tenderStatuses = ['Draft', 'Published', 'Closed', 'Awarded', 'Cancelled'];

const tenderStatusTone = (status: string) => {
  switch (status) {
    case 'Published':
    case 'Awarded':
      return 'admin-status--good';
    case 'Closed':
      return 'admin-status--warn';
    case 'Cancelled':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const bidOpeningStatuses = ['Scheduled', 'Open', 'Closed', 'Cancelled'];

const bidOpeningStatusTone = (status: string) => {
  switch (status) {
    case 'Open':
      return 'admin-status--warn';
    case 'Closed':
      return 'admin-status--good';
    case 'Cancelled':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const bppNoObjectionStatuses = ['Draft', 'Submitted', 'In Review', 'Approved', 'Rejected', 'Cancelled'];

const bppNoObjectionStatusTone = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'admin-status--good';
    case 'Submitted':
    case 'In Review':
      return 'admin-status--warn';
    case 'Rejected':
    case 'Cancelled':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const contractAwardStatuses = ['Draft', 'Pending Approval', 'Approved', 'Published', 'Cancelled'];

const contractAwardStatusTone = (status: string) => {
  switch (status) {
    case 'Approved':
    case 'Published':
      return 'admin-status--good';
    case 'Pending Approval':
      return 'admin-status--warn';
    case 'Cancelled':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const contractManagementStatuses = ['Active', 'On Hold', 'Completed', 'Terminated'];

const contractManagementStatusTone = (status: string) => {
  switch (status) {
    case 'Active':
      return 'admin-status--good';
    case 'On Hold':
      return 'admin-status--warn';
    case 'Terminated':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const inspectionStatuses = ['Scheduled', 'In Progress', 'Accepted', 'Rejected'];

const inspectionStatusTone = (status: string) => {
  switch (status) {
    case 'Accepted':
      return 'admin-status--good';
    case 'In Progress':
      return 'admin-status--warn';
    case 'Rejected':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const evaluationReportStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Returned'];

const evaluationReportStatusTone = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'admin-status--good';
    case 'Submitted':
    case 'Under Review':
      return 'admin-status--warn';
    case 'Returned':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const requisitionTypes = ['Goods', 'Works', 'Services'];
const requisitionPriorities = ['Normal', 'Urgent', 'Strategic'];
const requisitionFundingSources = ['Capital Budget', 'Recurrent Budget', 'Donor Grant', 'Special Intervention'];

type RequisitionStep = {
  key: RoleKey;
  title: string;
  status: string;
  detail: string;
};

const requisitionSteps: RequisitionStep[] = [
  {
    key: 'requisitioning_officer',
    title: 'Requisitioning Officer',
    status: 'Draft',
    detail: 'Capture need, scope, and budget line.'
  },
  {
    key: 'procurement_officer',
    title: 'Procurement Unit',
    status: 'Pending Review',
    detail: 'Validate method, specs, and thresholds.'
  },
  {
    key: 'evaluation_committee',
    title: 'Evaluation Committee',
    status: 'Queued',
    detail: 'Prepare technical and financial criteria.'
  },
  {
    key: 'tenders_board',
    title: 'Immigration Tender Board',
    status: 'Awaiting',
    detail: 'Review and approve recommendation.'
  },
  {
    key: 'accounting_officer',
    title: 'Accounting Officer',
    status: 'Conditional',
    detail: 'Confirm high-value approvals.'
  },
  {
    key: 'audit_oversight',
    title: 'Audit and Oversight',
    status: 'Monitor',
    detail: 'Track compliance and audit trail.'
  }
];

const requisitionRoleGuidance: Record<
  RoleKey,
  {
    focus: string;
    checks: string[];
  }
> = {
  admin: {
    focus: 'Maintain administrative oversight across access, workflow governance, and compliance monitoring.',
    checks: ['Review role assignments.', 'Check configuration drift and approvals.', 'Monitor audit and exception reporting.']
  },
  requisitioning_officer: {
    focus: 'Frame the need clearly and align with approved budget.',
    checks: ['Attach cost breakdown and scope notes.', 'Confirm APP line and budget code.', 'Set delivery window.']
  },
  department_head: {
    focus: 'Review departmental readiness, business justification, and escalation discipline before wider routing.',
    checks: ['Confirm need aligns with department priorities.', 'Review budget ownership and scope.', 'Escalate gaps before procurement review.']
  },
  procurement_officer: {
    focus: 'Validate method, thresholds, and procurement plan alignment.',
    checks: ['Confirm procurement method.', 'Check market survey assumptions.', 'Align evaluation criteria.']
  },
  procurement_manager: {
    focus: 'Oversee procurement quality, controls, and timely progression across planning and tender stages.',
    checks: ['Review pipeline bottlenecks.', 'Confirm threshold controls are applied.', 'Check readiness before publication or award.']
  },
  planning_statistics_officer: {
    focus: 'Stress-test APP demand timing, phasing, and procurement packaging assumptions.',
    checks: ['Check annual plan sequencing.', 'Review demand aggregation logic.', 'Flag timing conflicts across departments.']
  },
  financial_unit_officer: {
    focus: 'Confirm affordability, release assumptions, and budget control before tendering.',
    checks: ['Match request to budget line.', 'Confirm release availability.', 'Highlight commitment and cash risks.']
  },
  legal_reviewer: {
    focus: 'Review statutory compliance language, bidding conditions, and contract risk exposure.',
    checks: ['Check procurement method legality.', 'Review draft contract clauses.', 'Flag challenge and litigation risks.']
  },
  technical_evaluator: {
    focus: 'Apply objective technical criteria and protect specialist evaluation integrity.',
    checks: ['Verify mandatory technical criteria.', 'Record justification for scores.', 'Separate clarifications from scoring.']
  },
  financial_evaluator: {
    focus: 'Validate commercial responsiveness, arithmetic accuracy, and pricing reasonableness.',
    checks: ['Check arithmetic corrections.', 'Review commercial deviations.', 'Compare prices against benchmarks.']
  },
  evaluation_committee: {
    focus: 'Prepare scoring framework and clarify technical expectations.',
    checks: ['Define technical criteria.', 'Assign evaluation roles.', 'Plan clarification window.']
  },
  tenders_board: {
    focus: 'Govern recommendation integrity and decision documentation.',
    checks: ['Review justification and thresholds.', 'Confirm segregation of duties.', 'Record decision rationale.']
  },
  tenders_board_secretary: {
    focus: 'Prepare board papers, decision records, and documentary completeness for board sittings.',
    checks: ['Confirm agenda pack completeness.', 'Maintain decision register.', 'Capture outcomes and supporting references.']
  },
  accounting_officer: {
    focus: 'Authorize high-value spend and external approvals.',
    checks: ['Validate funding source.', 'Confirm delegated authority.', 'Escalate to BPP if required.']
  },
  bpp_liaison: {
    focus: 'Coordinate BPP escalation records, submission completeness, and regulator-facing documentation.',
    checks: ['Prepare no-objection submission pack.', 'Confirm reference codes and source links.', 'Track intake and escalation status.']
  },
  bpp_reviewer: {
    focus: 'Review no-objection submissions for completeness, threshold basis, and auditability.',
    checks: ['Check escalation basis.', 'Review approval trail completeness.', 'Confirm supporting documents are attached.']
  },
  complaints_review_officer: {
    focus: 'Maintain a defensible review record for complaints, bidder challenges, and escalations.',
    checks: ['Log complaint timeline.', 'Check prior decision rationale.', 'Record findings and closure notes.']
  },
  contract_manager: {
    focus: 'Track performance, milestone slippage, and contract changes after award.',
    checks: ['Log milestone evidence.', 'Monitor progress against dates.', 'Escalate contract risks early.']
  },
  inspection_officer: {
    focus: 'Document delivery inspection results before acceptance and payment progression.',
    checks: ['Verify goods or works delivered.', 'Capture acceptance evidence.', 'Record defects or reservations.']
  },
  payment_officer: {
    focus: 'Track payment readiness against approvals, acceptance, and contract status.',
    checks: ['Confirm acceptance is complete.', 'Match payment stage to contract progress.', 'Flag overdue disbursements.']
  },
  audit_oversight: {
    focus: 'Monitor compliance signals and audit completeness.',
    checks: ['Verify audit trail completeness.', 'Review timelines vs policy.', 'Log exceptions and follow-ups.']
  },
  ict_admin: {
    focus: 'Maintain workflow integrity and access controls.',
    checks: ['Verify role mapping.', 'Check workflow configuration.', 'Review access logs.']
  }
};

const requisitionStatuses = ['Draft', 'Submitted', 'Under Review', 'Evaluation', 'Board Review', 'Approved', 'Rejected'];

const requisitionStatusTone = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'admin-status--good';
    case 'Submitted':
    case 'Under Review':
    case 'Evaluation':
    case 'Board Review':
      return 'admin-status--warn';
    case 'Rejected':
      return 'admin-status--alert';
    default:
      return '';
  }
};

const requisitionStageMap: Record<string, RoleKey> = {
  Draft: 'requisitioning_officer',
  Submitted: 'procurement_officer',
  'Under Review': 'procurement_officer',
  Evaluation: 'evaluation_committee',
  'Board Review': 'tenders_board',
  Approved: 'accounting_officer',
  Rejected: 'requisitioning_officer'
};

const resolveStageKey = (detail?: RequisitionDetail | null): RoleKey => {
  if (!detail) {
    return 'requisitioning_officer';
  }
  const stage = detail.CurrentStage?.trim();
  if (stage) {
    const normalized = stage.toLowerCase().replace(/\s+/g, '_');
    const match = requisitionSteps.find((step) => step.key === (normalized as RoleKey));
    if (match) {
      return match.key;
    }
  }
  return requisitionStageMap[detail.Status] ?? 'requisitioning_officer';
};

const RequisitionModulePage = ({
  module,
  role,
  token
}: {
  module: InternalModule;
  role?: RoleKey | null;
  token?: string | null;
}) => {
  type RequisitionLineItemInput = {
    id: string;
    description: string;
    unit: string;
    quantity: string;
    unitCost: string;
  };

  const activeRoleKey = role ?? 'requisitioning_officer';
  const guidance = requisitionRoleGuidance[activeRoleKey] ?? requisitionRoleGuidance.requisitioning_officer;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeRequisitionId, setActiveRequisitionId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('Draft');
  const [form, setForm] = useState({
    title: '',
    department: '',
    procurementType: requisitionTypes[0],
    priority: requisitionPriorities[0],
    fundingSource: requisitionFundingSources[0],
    appLineItemId: '',
    budgetCode: '',
    projectCode: '',
    requiredBy: '',
    deliveryLocation: '',
    justification: '',
    riskNotes: ''
  });

  const [lineItems, setLineItems] = useState<RequisitionLineItemInput[]>([
    {
      id: 'LI-001',
      description: 'Solar inverter set for regional data center',
      unit: 'Unit',
      quantity: '2',
      unitCost: '3500000'
    },
    {
      id: 'LI-002',
      description: 'Installation, commissioning, and training',
      unit: 'Service',
      quantity: '1',
      unitCost: '850000'
    }
  ]);

  const [formErrors, setFormErrors] = useState<{
    fields: Partial<Record<keyof typeof form, string>>;
    lineItems: Record<string, Partial<Record<keyof RequisitionLineItemInput, string>>>;
    summary?: string;
  }>({ fields: {}, lineItems: {} });

  const [appLineItems, setAppLineItems] = useState<BudgetLineItem[]>(budgetLineItems);
  const [appLoading, setAppLoading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [thresholdRouting, setThresholdRouting] = useState<ThresholdBand | null>(null);
  const [thresholdSource, setThresholdSource] = useState<'api' | 'local'>('local');

  const availableAppItems = useMemo(() => {
    const department = form.department.trim().toLowerCase();
    if (!department) {
      return appLineItems;
    }
    const matches = appLineItems.filter((item) => item.department.toLowerCase().includes(department));
    return matches.length ? matches : appLineItems;
  }, [form.department, appLineItems]);

  const totalEstimate = useMemo(
    () =>
      lineItems.reduce((total, item) => {
        const quantity = Number(item.quantity) || 0;
        const unitCost = Number(item.unitCost) || 0;
        return total + quantity * unitCost;
      }, 0),
    [lineItems]
  );

  const selectedAppItem = useMemo(
    () => appLineItems.find((item) => item.id === form.appLineItemId) ?? null,
    [form.appLineItemId, appLineItems]
  );

  const fiscalYear = useMemo(() => {
    if (selectedAppItem?.fiscalYear) {
      return selectedAppItem.fiscalYear;
    }
    if (form.requiredBy) {
      const parsed = new Date(form.requiredBy);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getFullYear();
      }
    }
    return new Date().getFullYear();
  }, [selectedAppItem?.fiscalYear, form.requiredBy]);

  const planYear = useMemo(() => {
    if (form.requiredBy) {
      const parsed = new Date(form.requiredBy);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getFullYear();
      }
    }
    return new Date().getFullYear();
  }, [form.requiredBy]);

  const budgetCheck = useMemo(
    () => getBudgetCheck(totalEstimate, form.appLineItemId, form.budgetCode, budgetSummary, selectedAppItem),
    [totalEstimate, form.appLineItemId, form.budgetCode, budgetSummary, selectedAppItem]
  );

  const routing = useMemo(
    () => thresholdRouting ?? resolveThresholdRouting(totalEstimate),
    [thresholdRouting, totalEstimate]
  );

  const utilizationPercent = useMemo(() => {
    if (budgetSummary) {
      const base = budgetSummary.Released > 0 ? budgetSummary.Released : budgetSummary.Appropriated;
      if (!base) {
        return 0;
      }
      const consumed = budgetSummary.Committed + budgetSummary.Spent;
      return Math.min(100, Math.round((consumed / base) * 100));
    }
    if (!selectedAppItem) {
      return 0;
    }
    const consumed = selectedAppItem.committed + selectedAppItem.reserved;
    if (!selectedAppItem.allocated) {
      return 0;
    }
    return Math.min(100, Math.round((consumed / selectedAppItem.allocated) * 100));
  }, [selectedAppItem, budgetSummary]);

  const utilizationHistory = useMemo(
    () => (selectedAppItem ? budgetUtilizationHistory[selectedAppItem.id] ?? [] : []),
    [selectedAppItem]
  );

  const isBudgetBlocking = budgetCheck.status === 'insufficient';
  const budgetTone =
    budgetCheck.status === 'sufficient'
      ? 'admin-status--good'
      : budgetCheck.status === 'insufficient'
        ? 'admin-status--alert'
        : 'admin-status--warn';

  useEffect(() => {
    if (!selectedAppItem) {
      return;
    }
    setForm((prev) => {
      if (prev.budgetCode === selectedAppItem.budgetCode) {
        return prev;
      }
      return { ...prev, budgetCode: selectedAppItem.budgetCode };
    });
  }, [selectedAppItem]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const department = form.department.trim();
    const year = planYear;

    setAppLoading(true);
    setAppError(null);

    fetchProcurementPlans(token, {
      department: department || undefined,
      fiscalYear: year,
      page: 1,
      pageSize: 50,
      sortBy: 'created_at',
      sortDir: 'desc'
    })
      .then(async (plans) => {
        if (!plans.Items.length) {
          setAppLineItems(budgetLineItems);
          return;
        }
        const itemsByPlan = await Promise.all(
          plans.Items.map((plan) => fetchProcurementPlanItems(token, plan.PlanId))
        );
        const mapped = plans.Items.flatMap((plan, index) =>
          itemsByPlan[index].map((item: ProcurementPlanItemDetail) => ({
            id: item.PlanItemId,
            title: item.Description,
            planRef: plan.PlanTitle,
            budgetCode: item.BudgetCode,
            department: plan.Department,
            fiscalYear: plan.FiscalYear,
            allocated: Number(item.EstimatedAmount) || 0,
            committed: 0,
            reserved: 0,
            procurementCategory: item.ProcurementType ?? 'Unspecified'
          }))
        );
        setAppLineItems(mapped.length ? mapped : budgetLineItems);
      })
      .catch((err) => {
        setAppError(err instanceof Error ? err.message : 'Unable to load APP line items.');
        setAppLineItems(budgetLineItems);
      })
      .finally(() => {
        setAppLoading(false);
      });
  }, [token, form.department, planYear]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const budgetCode = selectedAppItem?.budgetCode ?? form.budgetCode.trim();
    const department = selectedAppItem?.department ?? form.department.trim();
    const year = selectedAppItem?.fiscalYear ?? fiscalYear;

    if (!budgetCode || !department) {
      setBudgetSummary(null);
      return;
    }

    setBudgetLoading(true);
    setBudgetError(null);
    fetchBudgetSummary(token, { budgetCode, department, fiscalYear: year })
      .then((summary) => {
        setBudgetSummary(summary);
      })
      .catch((err) => {
        setBudgetError(err instanceof Error ? err.message : 'Unable to load budget summary.');
        setBudgetSummary(null);
      })
      .finally(() => {
        setBudgetLoading(false);
      });
  }, [token, selectedAppItem, form.budgetCode, form.department, fiscalYear]);

  useEffect(() => {
    if (!token || totalEstimate <= 0) {
      setThresholdRouting(null);
      setThresholdSource('local');
      return;
    }

    resolveApprovalThreshold(token, { amount: totalEstimate, procurementType: form.procurementType })
      .then((threshold: ApprovalThresholdDetail) => {
        const fallback = resolveThresholdRouting(totalEstimate);
        setThresholdRouting({
          ...fallback,
          label: threshold.MaxAmount
            ? `${formatCurrency(threshold.MinAmount)} - ${formatCurrency(threshold.MaxAmount)}`
            : `${formatCurrency(threshold.MinAmount)}+`,
          approvalLevel: threshold.ApprovalRoute,
          requiresBpp: threshold.RequiresBpp,
          escalation: threshold.Notes ?? fallback.escalation,
          steps: fallback.steps
        });
        setThresholdSource('api');
      })
      .catch(() => {
        setThresholdRouting(null);
        setThresholdSource('local');
      });
  }, [token, totalEstimate, form.procurementType]);

  const handleFormChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      if (!prev.fields[field]) {
        return prev;
      }
      return { ...prev, fields: { ...prev.fields, [field]: undefined } };
    });
  };

  const updateLineItem = (id: string, field: keyof RequisitionLineItemInput, value: string) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    setFormErrors((prev) => {
      const itemErrors = prev.lineItems[id];
      if (!itemErrors?.[field]) {
        return prev;
      }
      return {
        ...prev,
        lineItems: {
          ...prev.lineItems,
          [id]: {
            ...itemErrors,
            [field]: undefined
          }
        }
      };
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => {
      const nextIndex = prev.length + 1;
      return [
        ...prev,
        {
          id: `LI-${String(nextIndex).padStart(3, '0')}`,
          description: '',
          unit: 'Unit',
          quantity: '1',
          unitCost: ''
        }
      ];
    });
    setFormErrors((prev) => (prev.summary ? { ...prev, summary: undefined } : prev));
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
    setFormErrors((prev) => {
      if (!prev.lineItems[id]) {
        return prev;
      }
      const { [id]: _removed, ...rest } = prev.lineItems;
      return {
        ...prev,
        lineItems: rest
      };
    });
  };

  const validateForm = () => {
    const nextErrors: {
      fields: Partial<Record<keyof typeof form, string>>;
      lineItems: Record<string, Partial<Record<keyof RequisitionLineItemInput, string>>>;
      summary?: string;
    } = { fields: {}, lineItems: {} };

    if (!form.title.trim()) {
      nextErrors.fields.title = 'Provide a clear requisition title.';
    }
    if (!form.department.trim()) {
      nextErrors.fields.department = 'Department is required.';
    }
    if (!form.appLineItemId) {
      nextErrors.fields.appLineItemId = 'Select an APP line item.';
    }
    if (!form.budgetCode.trim()) {
      nextErrors.fields.budgetCode = 'Budget code is required.';
    } else if (selectedAppItem && form.budgetCode.trim() !== selectedAppItem.budgetCode) {
      nextErrors.fields.budgetCode = 'Budget code does not match the selected APP line item.';
    }
    if (!form.requiredBy.trim()) {
      nextErrors.fields.requiredBy = 'Required-by date is required.';
    }
    if (!form.deliveryLocation.trim()) {
      nextErrors.fields.deliveryLocation = 'Delivery location is required.';
    }
    if (lineItems.length === 0) {
      nextErrors.summary = 'Add at least one line item.';
    }

    if (budgetCheck.status === 'unknown' && !nextErrors.summary) {
      nextErrors.summary = budgetCheck.message;
    }

    if (budgetCheck.status === 'insufficient') {
      nextErrors.summary = `Budget availability shortfall of ${formatCurrency(budgetCheck.variance)}.`;
    }

    lineItems.forEach((item) => {
      const itemErrors: Partial<Record<keyof RequisitionLineItemInput, string>> = {};
      if (!item.description.trim()) {
        itemErrors.description = 'Describe the item or service.';
      }
      if (!item.unit.trim()) {
        itemErrors.unit = 'Unit is required.';
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        itemErrors.quantity = 'Quantity must be greater than 0.';
      }
      if (!item.unitCost || Number(item.unitCost) <= 0) {
        itemErrors.unitCost = 'Unit cost must be greater than 0.';
      }
      if (Object.keys(itemErrors).length > 0) {
        nextErrors.lineItems[item.id] = itemErrors;
      }
    });

    setFormErrors(nextErrors);
    return (
      Object.keys(nextErrors.fields).length === 0 &&
      Object.keys(nextErrors.lineItems).length === 0 &&
      !nextErrors.summary
    );
  };

  const buildPayload = (status: string): RequisitionCreateRequest => ({
    Title: form.title.trim(),
    Department: form.department.trim(),
    ProcurementType: form.procurementType,
    Priority: form.priority,
    FundingSource: form.fundingSource,
    BudgetCode: form.budgetCode.trim(),
    ProjectCode: form.projectCode.trim() || null,
    RequiredBy: form.requiredBy ? new Date(form.requiredBy).toISOString() : null,
    DeliveryLocation: form.deliveryLocation.trim(),
    Justification: form.justification.trim() || null,
    RiskNotes: form.riskNotes.trim() || null,
    Status: status,
    LineItems: lineItems.map<RequisitionLineItem>((item) => ({
      Description: item.description.trim(),
      Unit: item.unit.trim(),
      Quantity: Number(item.quantity) || 0,
      UnitCost: Number(item.unitCost) || 0
    }))
  });

  const handleSubmit = async (status: 'Draft' | 'Submitted') => {
    if (!token) {
      setActionError('Authentication token missing. Please sign in again.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setIsSaving(true);
    try {
      const payload = buildPayload(status);
      let response: RequisitionDetail;
      if (activeRequisitionId) {
        const updatePayload: RequisitionUpdateRequest = {
          ...payload,
          LineItems: payload.LineItems
        };
        response = await updateRequisition(token, activeRequisitionId, updatePayload);
      } else {
        response = await createRequisition(token, payload);
      }

      setActiveRequisitionId(response.RequisitionId);
      setCurrentStatus(response.Status || status);
      setActionMessage(
        status === 'Submitted'
          ? 'Requisition submitted to Procurement Unit.'
          : 'Draft saved successfully.'
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save requisition.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module requisition-module">
      <div className="requisition-header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="requisition-badges">
          <span className="req-badge">Role: {toTitle(activeRoleKey)}</span>
          <span className="req-badge req-badge--soft">Workflow: Standard PPA</span>
          <span className="req-badge req-badge--accent">{currentStatus} Mode</span>
        </div>
      </div>

      <div className="requisition-grid">
        <div className="requisition-panel requisition-panel--form">
          <article className="requisition-card">
            <div className="requisition-card__header">
              <div>
                <h3>Requisition Summary</h3>
                <p>Capture the request scope, category, and funding details.</p>
              </div>
              <span className="requisition-tag">REQ-NEW</span>
            </div>
            <div className="requisition-form-grid">
              <label className="plan-field plan-field--span">
                <span>Request Title</span>
                <input
                  className="plan-input"
                  value={form.title}
                  onChange={(event) => handleFormChange('title', event.target.value)}
                  placeholder="e.g. Power backup upgrade for headquarters"
                />
                {formErrors.fields.title ? <span className="req-error">{formErrors.fields.title}</span> : null}
              </label>
              <label className="plan-field">
                <span>Department</span>
                <input
                  className="plan-input"
                  value={form.department}
                  onChange={(event) => handleFormChange('department', event.target.value)}
                  placeholder="Infrastructure & ICT"
                />
                {formErrors.fields.department ? <span className="req-error">{formErrors.fields.department}</span> : null}
              </label>
              <label className="plan-field">
                <span>Procurement Type</span>
                <select
                  className="plan-select"
                  value={form.procurementType}
                  onChange={(event) => handleFormChange('procurementType', event.target.value)}
                >
                  {requisitionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Priority</span>
                <select
                  className="plan-select"
                  value={form.priority}
                  onChange={(event) => handleFormChange('priority', event.target.value)}
                >
                  {requisitionPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Funding Source</span>
                <select
                  className="plan-select"
                  value={form.fundingSource}
                  onChange={(event) => handleFormChange('fundingSource', event.target.value)}
                >
                  {requisitionFundingSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field plan-field--span">
                <span>APP Line Item</span>
                <select
                  className="plan-select"
                  value={form.appLineItemId}
                  onChange={(event) => handleFormChange('appLineItemId', event.target.value)}
                >
                  <option value="">Select APP line item</option>
                  {availableAppItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.planRef})
                    </option>
                  ))}
                </select>
                {formErrors.fields.appLineItemId ? (
                  <span className="req-error">{formErrors.fields.appLineItemId}</span>
                ) : null}
                {selectedAppItem ? (
                  <div className="budget-app-summary">
                    <div>
                      <span>Budget Code</span>
                      <strong>{selectedAppItem.budgetCode}</strong>
                    </div>
                    <div>
                      <span>Allocated</span>
                      <strong>{formatCurrency(selectedAppItem.allocated)}</strong>
                    </div>
                    <div>
                      <span>Department</span>
                      <strong>{selectedAppItem.department}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="plan-muted">Select a line item to auto-fill budget details.</div>
                )}
                {appLoading ? <div className="plan-muted">Loading APP line items...</div> : null}
                {appError ? <div className="req-error">{appError}</div> : null}
              </label>
              <label className="plan-field">
                <span>Budget Code</span>
                <input
                  className="plan-input"
                  value={form.budgetCode}
                  onChange={(event) => handleFormChange('budgetCode', event.target.value)}
                  placeholder="e.g. CAP-ICT-2026-04"
                />
                {formErrors.fields.budgetCode ? <span className="req-error">{formErrors.fields.budgetCode}</span> : null}
              </label>
              <label className="plan-field">
                <span>Project Code</span>
                <input
                  className="plan-input"
                  value={form.projectCode}
                  onChange={(event) => handleFormChange('projectCode', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="plan-field">
                <span>Required By</span>
                <input
                  className="plan-input"
                  type="date"
                  value={form.requiredBy}
                  onChange={(event) => handleFormChange('requiredBy', event.target.value)}
                />
                {formErrors.fields.requiredBy ? <span className="req-error">{formErrors.fields.requiredBy}</span> : null}
              </label>
              <label className="plan-field plan-field--span">
                <span>Delivery Location</span>
                <input
                  className="plan-input"
                  value={form.deliveryLocation}
                  onChange={(event) => handleFormChange('deliveryLocation', event.target.value)}
                  placeholder="Main headquarters, Abuja"
                />
                {formErrors.fields.deliveryLocation ? (
                  <span className="req-error">{formErrors.fields.deliveryLocation}</span>
                ) : null}
              </label>
            </div>
          </article>

          <article className="requisition-card">
            <div className="requisition-card__header requisition-card__header--inline">
              <div>
                <h3>Line Items</h3>
                <p>List each item or service with estimated unit costs.</p>
              </div>
              <button type="button" className="plan-button plan-button--secondary" onClick={addLineItem}>
                Add Line
              </button>
            </div>
            <div className="requisition-items">
              <div className="requisition-item-row requisition-item-row--header">
                <span>Item Description</span>
                <span>Unit</span>
                <span>Qty</span>
                <span>Unit Cost (NGN)</span>
                <span>Total</span>
                <span />
              </div>
              {lineItems.map((item) => {
                const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
                const itemErrors = formErrors.lineItems[item.id];
                return (
                  <div key={item.id} className="requisition-item-row">
                    <div className="requisition-item-cell requisition-item-cell--desc">
                      <input
                        className="plan-input"
                        value={item.description}
                        onChange={(event) => updateLineItem(item.id, 'description', event.target.value)}
                        placeholder="Describe item or service"
                      />
                      {itemErrors?.description ? (
                        <span className="req-error">{itemErrors.description}</span>
                      ) : null}
                      <span className="requisition-item-meta">{item.id}</span>
                    </div>
                    <div className="requisition-item-cell">
                      <input
                        className="plan-input"
                        value={item.unit}
                        onChange={(event) => updateLineItem(item.id, 'unit', event.target.value)}
                        placeholder="Unit"
                      />
                      {itemErrors?.unit ? <span className="req-error">{itemErrors.unit}</span> : null}
                    </div>
                    <div className="requisition-item-cell">
                      <input
                        className="plan-input"
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(event) => updateLineItem(item.id, 'quantity', event.target.value)}
                      />
                      {itemErrors?.quantity ? <span className="req-error">{itemErrors.quantity}</span> : null}
                    </div>
                    <div className="requisition-item-cell">
                      <input
                        className="plan-input"
                        type="number"
                        min="0"
                        value={item.unitCost}
                        onChange={(event) => updateLineItem(item.id, 'unitCost', event.target.value)}
                      />
                      {itemErrors?.unitCost ? <span className="req-error">{itemErrors.unitCost}</span> : null}
                    </div>
                    <div className="requisition-item-total">{formatCurrency(itemTotal || 0)}</div>
                    <button
                      type="button"
                      className="plan-link plan-link--danger"
                      onClick={() => removeLineItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            {formErrors.summary ? <div className="req-error req-error--block">{formErrors.summary}</div> : null}
            <div className="requisition-summary">
              <div>
                <span>Total Estimate</span>
                <strong>{formatCurrency(totalEstimate)}</strong>
              </div>
              <div>
                <span>Funding Source</span>
                <strong>{form.fundingSource}</strong>
              </div>
              <div>
                <span>Priority Level</span>
                <strong>{form.priority}</strong>
              </div>
            </div>
          </article>

          <article className="requisition-card">
            <div className="requisition-card__header">
              <div>
                <h3>Justification & Compliance</h3>
                <p>Attach evidence and confirm compliance checks.</p>
              </div>
              <span className="requisition-tag requisition-tag--ghost">Compliance Pack</span>
            </div>
            <div className="requisition-checklist">
              {[
                'Cost breakdown and estimates',
                'Market survey summary',
                'APP alignment confirmation',
                'Technical specifications',
                'Risk and mitigation notes'
              ].map((item) => (
                <label key={item} className="requisition-check">
                  <input type="checkbox" defaultChecked={item === 'Cost breakdown and estimates'} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <div className="requisition-form-grid">
              <label className="plan-field plan-field--span">
                <span>Justification</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={form.justification}
                  onChange={(event) => handleFormChange('justification', event.target.value)}
                  placeholder="Explain the operational need and urgency."
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Risk & Mitigation</span>
                <textarea
                  className="plan-textarea"
                  rows={2}
                  value={form.riskNotes}
                  onChange={(event) => handleFormChange('riskNotes', event.target.value)}
                  placeholder="Highlight any procurement or delivery risks."
                />
              </label>
            </div>
          </article>

          <article className={`budget-check budget-check--${budgetCheck.status}`}>
            <div className="budget-check__header">
              <div>
                <h4>Budget Availability Check</h4>
                <p>{budgetCheck.message}</p>
                {budgetLoading ? <span className="plan-muted">Refreshing budget summary...</span> : null}
                {budgetError ? <span className="req-error">{budgetError}</span> : null}
              </div>
              <span className={`admin-status ${budgetTone}`}>
                {budgetCheck.status === 'sufficient'
                  ? 'Sufficient'
                  : budgetCheck.status === 'insufficient'
                    ? 'Insufficient'
                    : 'Pending'}
              </span>
            </div>
            <div className="budget-check__grid">
              <div>
                <span>Appropriated</span>
                <strong>{budgetCheck.item || budgetSummary ? formatCurrency(budgetCheck.appropriated) : '—'}</strong>
              </div>
              <div>
                <span>Released</span>
                <strong>
                  {budgetCheck.item || budgetSummary ? formatCurrency(budgetCheck.released) : '—'}
                </strong>
              </div>
              <div>
                <span>Committed</span>
                <strong>{budgetCheck.item || budgetSummary ? formatCurrency(budgetCheck.committed) : '—'}</strong>
              </div>
              <div>
                <span>Spent</span>
                <strong>{budgetCheck.item || budgetSummary ? formatCurrency(budgetCheck.spent) : '—'}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{budgetCheck.item || budgetSummary ? formatCurrency(budgetCheck.available) : '—'}</strong>
              </div>
              <div>
                <span>Request Total</span>
                <strong>{formatCurrency(totalEstimate)}</strong>
              </div>
              <div>
                <span>Variance</span>
                <strong>{budgetCheck.item || budgetSummary ? formatCurrency(budgetCheck.variance) : '—'}</strong>
              </div>
            </div>
            {budgetCheck.item ? (
              <div className="budget-check__meta">
                <span>
                  APP Ref: <strong>{budgetCheck.item.planRef}</strong>
                </span>
                <span>
                  Budget Code: <strong>{budgetCheck.item.budgetCode}</strong>
                </span>
                <span>
                  FY: <strong>{budgetCheck.item.fiscalYear}</strong>
                </span>
              </div>
            ) : null}
          </article>

          <div className="requisition-actions">
            <button
              type="button"
              className="plan-button"
              onClick={() => handleSubmit('Submitted')}
              disabled={isSaving || isBudgetBlocking}
            >
              {isSaving ? 'Submitting...' : 'Submit to Procurement Unit'}
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => handleSubmit('Draft')}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button type="button" className="plan-link">
              Preview PDF Summary
            </button>
          </div>
          {actionError ? <div className="portal-alert">{actionError}</div> : null}
          {actionMessage ? <div className="requisition-success">{actionMessage}</div> : null}
        </div>

        <aside className="requisition-panel requisition-panel--side">
          <article className="requisition-card">
            <div className="requisition-card__header">
              <div>
                <h3>Workflow Route</h3>
                <p>Role-based checkpoints for this requisition.</p>
              </div>
              <span className="requisition-tag requisition-tag--accent">Live Route</span>
            </div>
            <div className="requisition-steps">
              {requisitionSteps.map((step) => (
                <div
                  key={step.key}
                  className={`requisition-step ${step.key === activeRoleKey ? 'requisition-step--active' : ''}`}
                >
                  <div>
                    <strong>{step.title}</strong>
                    <span className="requisition-step__detail">{step.detail}</span>
                  </div>
                  <span className="requisition-step__status">{step.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="requisition-card">
            <div className="requisition-card__header">
              <div>
                <h3>Role Guidance</h3>
                <p>Checklist tailored for {toTitle(activeRoleKey)}.</p>
              </div>
              <span className="requisition-tag">Role Lens</span>
            </div>
            <p className="requisition-focus">{guidance.focus}</p>
            <ul className="requisition-list">
              {guidance.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </article>

          <article className="requisition-card requisition-card--metrics">
            <div className="requisition-card__header">
              <div>
                <h3>Budget Snapshot</h3>
                <p>Monitoring threshold and approvals required.</p>
              </div>
              <span className="requisition-tag requisition-tag--ghost">
                {thresholdSource === 'api' ? 'Policy API' : 'Local Policy'}
              </span>
            </div>
            <div className="requisition-metrics">
              <div>
                <span>Threshold Band</span>
                <strong>{routing.label}</strong>
              </div>
              <div>
                <span>Approval Level</span>
                <strong>{routing.approvalLevel}</strong>
              </div>
              <div>
                <span>Budget Utilization</span>
                <strong>{budgetSummary || selectedAppItem ? `${utilizationPercent}%` : '—'}</strong>
              </div>
              <div>
                <span>Available Balance</span>
                <strong>{budgetSummary || selectedAppItem ? formatCurrency(budgetCheck.available) : '—'}</strong>
              </div>
              <div>
                <span>Expected Timeline</span>
                <strong>{routing.timeline}</strong>
              </div>
            </div>
          </article>

          <article className="requisition-card">
            <div className="requisition-card__header">
              <div>
                <h3>Utilization Trend</h3>
                <p>Historical commitment and release movement.</p>
              </div>
              <span className="requisition-tag requisition-tag--ghost">History</span>
            </div>
            {utilizationHistory.length ? (
              <div className="budget-history">
                {utilizationHistory.map((point) => (
                  <div key={`${selectedAppItem?.id ?? 'unknown'}-${point.period}`} className="budget-history-row">
                    <div className="budget-history-header">
                      <span>{point.period}</span>
                      <strong>{point.utilization}%</strong>
                    </div>
                    <div className="budget-history-bar">
                      <span style={{ width: `${Math.min(point.utilization, 100)}%` }} />
                    </div>
                    <div className="budget-history-meta">
                      Committed {formatCurrency(point.committed)} · Released {formatCurrency(point.released)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="plan-muted">
                {selectedAppItem ? 'No utilization history available yet.' : 'Select an APP line item to view utilization history.'}
              </p>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
};

const RequisitionHistoryModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    query: '',
    dateFrom: '',
    dateTo: ''
  });
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequisitionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 8, total: 0 });
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  const refreshRequisitions = async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRequisitions(token, {
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        query: filters.query.trim() || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir
      });
      setRequisitions(data.Items);
      setPagination((prev) => ({
        ...prev,
        page: data.Page,
        pageSize: data.PageSize,
        total: data.Total
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requisitions.');
      setRequisitions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshRequisitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    filters.status,
    filters.priority,
    filters.query,
    filters.dateFrom,
    filters.dateTo,
    pagination.page,
    pagination.pageSize,
    sort.sortBy,
    sort.sortDir
  ]);

  const viewDetail = async (requisitionId: string) => {
    if (!token) {
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await fetchRequisitionDetail(token, requisitionId);
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load requisition.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  return (
    <section className="portal-module requisition-history">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Title or requisition ID"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {requisitionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Priority</span>
            <select
              className="plan-select"
              value={filters.priority}
              onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
            >
              <option value="">All</option>
              {requisitionPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Date From</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </label>
          <label className="plan-field">
            <span>Date To</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </label>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Total</th>
            <th>Required By</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requisitions.map((req) => (
            <tr key={req.RequisitionId}>
              <td>{req.RequisitionId}</td>
              <td>{req.Title}</td>
              <td>
                <span className={`admin-status ${requisitionStatusTone(req.Status)}`}>{req.Status}</span>
              </td>
              <td>{req.Priority ?? '—'}</td>
              <td>{formatCurrency(req.TotalEstimate)}</td>
              <td>{formatDate(req.RequiredBy)}</td>
              <td>{formatDate(req.CreatedAt)}</td>
              <td>
                <button type="button" className="plan-link" onClick={() => viewDetail(req.RequisitionId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!requisitions.length && !isLoading ? (
            <tr>
              <td colSpan={8} className="plan-empty">
                No requisitions match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="plan-pagination">
        <span>
          Showing {pageStart}–{pageEnd} of {pagination.total} requisitions
        </span>
        <div className="plan-pagination__controls">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page <= 1 || isLoading}
          >
            Previous
          </button>
          <span className="plan-pagination__meta">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            disabled={pagination.page >= totalPages || isLoading}
          >
            Next
          </button>
        </div>
      </div>

      {isLoading ? <p>Loading requisitions...</p> : null}
      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.Title : 'Requisition Detail'}</h3>
                <p>{detail ? `Requisition ${detail.RequisitionId}` : 'Loading requisition data.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDetail}>
                Close
              </button>
            </div>

            {detailLoading ? <div className="plan-loading">Loading requisition details...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}

            {detail ? (
              <div className="requisition-detail requisition-detail--modal">
                <div className="requisition-detail-grid">
                  <div>
                    <span>Department</span>
                    <strong>{detail.Department}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{detail.Status}</strong>
                  </div>
                  <div>
                    <span>Procurement Type</span>
                    <strong>{detail.ProcurementType ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Budget Code</span>
                    <strong>{detail.BudgetCode ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Required By</span>
                    <strong>{formatDate(detail.RequiredBy)}</strong>
                  </div>
                  <div>
                    <span>Delivery Location</span>
                    <strong>{detail.DeliveryLocation ?? '—'}</strong>
                  </div>
                </div>
                <div className="requisition-detail-items">
                  <h4>Line Items</h4>
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.LineItems?.map((item, index) => (
                        <tr key={`${detail.RequisitionId}-${index}`}>
                          <td>{item.Description}</td>
                          <td>{item.Unit}</td>
                          <td>{item.Quantity}</td>
                          <td>{formatCurrency(item.UnitCost)}</td>
                          <td>{formatCurrency(item.UnitCost * item.Quantity)}</td>
                        </tr>
                      ))}
                      {!detail.LineItems?.length ? (
                        <tr>
                          <td colSpan={5} className="plan-empty">
                            No line items captured yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {detail.Justification ? (
                  <div className="requisition-detail-note">
                    <h4>Justification</h4>
                    <p>{detail.Justification}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const RequisitionTrackingModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [query, setQuery] = useState('');
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequisitionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRequisitions = async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRequisitions(token, {
        query: query.trim() || undefined,
        page: 1,
        pageSize: 6,
        sortBy: 'created_at',
        sortDir: 'desc'
      });
      setRequisitions(data.Items);
      if (!selected && data.Items.length > 0) {
        await viewTrackingDetail(data.Items[0].RequisitionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requisition tracking.');
      setRequisitions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const viewTrackingDetail = async (requisitionId: string) => {
    if (!token) {
      return;
    }
    setDetailLoading(true);
    try {
      const data = await fetchRequisitionDetail(token, requisitionId);
      setSelected(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requisition detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadRequisitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query]);

  const currentStage = resolveStageKey(selected);
  const currentIndex = requisitionSteps.findIndex((step) => step.key === currentStage);

  return (
    <section className="portal-module requisition-tracking">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="requisition-tracking-grid">
        <div className="requisition-tracking-list">
          <div className="plan-filters">
            <label className="plan-field plan-field--span">
              <span>Track Requisition</span>
              <input
                className="plan-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by requisition ID or title"
              />
            </label>
          </div>
          {error ? <div className="portal-alert">{error}</div> : null}
          <div className="requisition-tracking-cards">
            {requisitions.map((req) => (
              <button
                type="button"
                key={req.RequisitionId}
                className={`requisition-track-card ${
                  selected?.RequisitionId === req.RequisitionId ? 'requisition-track-card--active' : ''
                }`}
                onClick={() => viewTrackingDetail(req.RequisitionId)}
              >
                <div>
                  <h4>{req.Title}</h4>
                  <p>{req.RequisitionId}</p>
                </div>
                <span className={`admin-status ${requisitionStatusTone(req.Status)}`}>{req.Status}</span>
              </button>
            ))}
            {!requisitions.length && !isLoading ? (
              <div className="plan-empty">No requisitions available for tracking.</div>
            ) : null}
          </div>
          {isLoading ? <p>Loading requisitions...</p> : null}
        </div>

        <div className="requisition-tracking-detail">
          {selected ? (
            <>
              <div className="requisition-card">
                <div className="requisition-card__header">
                  <div>
                    <h3>{selected.Title}</h3>
                    <p>Tracking: {selected.RequisitionId}</p>
                  </div>
                  <span className="requisition-tag requisition-tag--accent">{selected.Status}</span>
                </div>
                <div className="requisition-detail-grid">
                  <div>
                    <span>Department</span>
                    <strong>{selected.Department}</strong>
                  </div>
                  <div>
                    <span>Required By</span>
                    <strong>{formatDate(selected.RequiredBy)}</strong>
                  </div>
                  <div>
                    <span>Total Estimate</span>
                    <strong>{formatCurrency(selected.TotalEstimate)}</strong>
                  </div>
                  <div>
                    <span>Priority</span>
                    <strong>{selected.Priority ?? '—'}</strong>
                  </div>
                </div>
              </div>

              <div className="requisition-card">
                <div className="requisition-card__header">
                  <div>
                    <h3>Workflow Progress</h3>
                    <p>Current stage: {toTitle(currentStage)}</p>
                  </div>
                </div>
                <div className="requisition-steps">
                  {requisitionSteps.map((step, index) => {
                    const state =
                      currentIndex === -1
                        ? 'Pending'
                        : index < currentIndex
                        ? 'Completed'
                        : index === currentIndex
                        ? 'In Progress'
                        : 'Pending';
                    const stepClass =
                      index < currentIndex
                        ? 'requisition-step requisition-step--done'
                        : index === currentIndex
                        ? 'requisition-step requisition-step--active'
                        : 'requisition-step';
                    return (
                      <div key={step.key} className={stepClass}>
                        <div>
                          <strong>{step.title}</strong>
                          <span className="requisition-step__detail">{step.detail}</span>
                        </div>
                        <span className="requisition-step__status">{state}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.Justification ? (
                <div className="requisition-card">
                  <div className="requisition-card__header">
                    <div>
                      <h3>Latest Note</h3>
                      <p>Submitted by requisitioning department.</p>
                    </div>
                  </div>
                  <p className="requisition-focus">{selected.Justification}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="plan-empty">Select a requisition to view its workflow.</div>
          )}
          {detailLoading ? <p>Loading tracking detail...</p> : null}
        </div>
      </div>
    </section>
  );
};

const ContractAwardModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({ status: '', query: '' });
  const [awards, setAwards] = useState<ContractAwardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractAwardItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canPublish = hasModuleAction(module, 'contract_award.publish');

  const refreshAwards = async () => {
    if (!token) {
      setAwards([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchContractAwards(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined
      });
      setAwards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load contract awards.');
      setAwards([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAwards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status, filters.query]);

  const viewDetail = async (awardId: string) => {
    if (!token) {
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await fetchContractAwardDetail(token, awardId);
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load contract award detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePublish = async (awardId: string) => {
    if (!token) {
      return;
    }
    setIsPublishing(true);
    setActionError(null);
    try {
      const updated = await publishContractAward(token, awardId);
      setAwards((prev) => prev.map((award) => (award.AwardId === awardId ? updated : award)));
      setDetail((prev) => (prev && prev.AwardId === awardId ? updated : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to publish award.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="portal-module contract-award">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Award ID, tender, or vendor"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {contractAwardStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Award ID</th>
            <th>Tender</th>
            <th>Vendor</th>
            <th>Status</th>
            <th>Award Value</th>
            <th>Award Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {awards.map((award) => (
            <tr key={award.AwardId}>
              <td>{award.AwardId}</td>
              <td>{award.TenderTitle}</td>
              <td>{award.VendorName}</td>
              <td>
                <span className={`admin-status ${contractAwardStatusTone(award.Status)}`}>{award.Status}</span>
              </td>
              <td>{formatCurrency(award.AwardValue)}</td>
              <td>{formatDate(award.AwardDate)}</td>
              <td>
                <button type="button" className="plan-link" onClick={() => viewDetail(award.AwardId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!awards.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No contract awards match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isLoading ? <p>Loading contract awards...</p> : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setDetailOpen(false)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.TenderTitle : 'Contract Award'}</h3>
                <p>{detail ? `Award ${detail.AwardId}` : 'Loading award details.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading award details...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
            {detail ? (
              <div className="requisition-detail requisition-detail--modal">
                <div className="requisition-detail-grid">
                  <div>
                    <span>Vendor</span>
                    <strong>{detail.VendorName}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{detail.Status}</strong>
                  </div>
                  <div>
                    <span>Award Value</span>
                    <strong>{formatCurrency(detail.AwardValue)}</strong>
                  </div>
                  <div>
                    <span>Award Date</span>
                    <strong>{formatDate(detail.AwardDate)}</strong>
                  </div>
                  <div>
                    <span>Contract Start</span>
                    <strong>{formatDate(detail.ContractStart)}</strong>
                  </div>
                  <div>
                    <span>Contract End</span>
                    <strong>{formatDate(detail.ContractEnd)}</strong>
                  </div>
                  <div>
                    <span>Funding Source</span>
                    <strong>{detail.FundingSource}</strong>
                  </div>
                </div>
                <div className="requisition-detail-note">
                  <h4>Notes</h4>
                  <p>{detail.Notes}</p>
                </div>
                <div className="requisition-actions">
                  <button
                    type="button"
                    className="plan-button"
                    disabled={!canPublish || detail.Status === 'Published' || isPublishing}
                    onClick={() => handlePublish(detail.AwardId)}
                  >
                    {isPublishing ? 'Publishing...' : detail.Status === 'Published' ? 'Published' : 'Publish Award'}
                  </button>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    onClick={() => setDetailOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const ContractManagementModulePage = ({
  module,
  token,
  userEmail
}: {
  module: InternalModule;
  token?: string | null;
  userEmail?: string | null;
}) => {
  const [filters, setFilters] = useState({ status: '', query: '' });
  const [contracts, setContracts] = useState<ContractManagementItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractManagementItem | null>(null);
  const [milestones, setMilestones] = useState<ContractMilestoneItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [milestoneSubmitError, setMilestoneSubmitError] = useState<string | null>(null);
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    MilestoneTitle: '',
    Status: 'Active',
    Progress: '0',
    Notes: '',
    ContractManager: '',
    RecordedBy: userEmail ?? ''
  });

  const canManage = hasModuleAction(module, 'contract_management.manage');

  const buildMilestoneForm = (contract?: ContractManagementItem | null) => ({
    MilestoneTitle: '',
    Status: contract?.Status ?? 'Active',
    Progress: String(contract?.Progress ?? 0),
    Notes: '',
    ContractManager: contract?.ContractManager ?? '',
    RecordedBy: userEmail ?? ''
  });

  const refreshContracts = async () => {
    if (!token) {
      setContracts([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchContracts(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined
      });
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load contracts.');
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setMilestones([]);
    setDetailError(null);
    setMilestoneError(null);
    setMilestoneSubmitError(null);
    setMilestoneForm(buildMilestoneForm(null));
  };

  useEffect(() => {
    refreshContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status, filters.query]);

  const viewDetail = async (contractId: string) => {
    if (!token) {
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setMilestones([]);
    setDetailError(null);
    setMilestoneError(null);
    setMilestoneSubmitError(null);
    setDetailLoading(true);
    setMilestoneLoading(true);
    try {
      const data = await fetchContractDetail(token, contractId);
      setDetail(data);
      setMilestoneForm(buildMilestoneForm(data));
      try {
        const history = await fetchContractMilestones(token, contractId);
        setMilestones(history);
      } catch (err) {
        setMilestoneError(err instanceof Error ? err.message : 'Unable to load milestone history.');
      } finally {
        setMilestoneLoading(false);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load contract detail.');
      setMilestoneLoading(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitMilestone = async () => {
    if (!token || !detail) {
      setMilestoneSubmitError('Authentication token or contract detail is missing.');
      return;
    }

    const progress = Number(milestoneForm.Progress);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      setMilestoneSubmitError('Progress must be a whole number between 0 and 100.');
      return;
    }

    if (!milestoneForm.MilestoneTitle.trim()) {
      setMilestoneSubmitError('Milestone title is required.');
      return;
    }

    if (!milestoneForm.Notes.trim()) {
      setMilestoneSubmitError('Update notes are required.');
      return;
    }

    setMilestoneSubmitting(true);
    setMilestoneSubmitError(null);
    try {
      const updated = await logContractMilestone(token, detail.ContractId, {
        MilestoneTitle: milestoneForm.MilestoneTitle.trim(),
        Status: milestoneForm.Status,
        Progress: progress,
        Notes: milestoneForm.Notes.trim(),
        ContractManager: milestoneForm.ContractManager.trim() || undefined,
        RecordedBy: milestoneForm.RecordedBy.trim() || undefined
      });

      setDetail(updated);
      setMilestoneForm(buildMilestoneForm(updated));
      const history = await fetchContractMilestones(token, detail.ContractId);
      setMilestones(history);
      await refreshContracts();
    } catch (err) {
      setMilestoneSubmitError(err instanceof Error ? err.message : 'Unable to log milestone update.');
    } finally {
      setMilestoneSubmitting(false);
    }
  };

  return (
    <section className="portal-module contract-management">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Contract ID, tender, or vendor"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {contractManagementStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Contract ID</th>
            <th>Tender</th>
            <th>Vendor</th>
            <th>Status</th>
            <th>Value</th>
            <th>Progress</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.ContractId}>
              <td>{contract.ContractId}</td>
              <td>{contract.TenderTitle}</td>
              <td>{contract.VendorName}</td>
              <td>
                <span className={`admin-status ${contractManagementStatusTone(contract.Status)}`}>
                  {contract.Status}
                </span>
              </td>
              <td>{formatCurrency(contract.ContractValue)}</td>
              <td>{contract.Progress}%</td>
              <td>
                <button type="button" className="plan-link" onClick={() => viewDetail(contract.ContractId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!contracts.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No contracts match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isLoading ? <p>Loading contracts...</p> : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.TenderTitle : 'Contract Detail'}</h3>
                <p>{detail ? `Contract ${detail.ContractId}` : 'Loading contract data.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDetail}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading contract details...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {detail ? (
              <div className="requisition-detail requisition-detail--modal">
                <div className="requisition-detail-grid">
                  <div>
                    <span>Vendor</span>
                    <strong>{detail.VendorName}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{detail.Status}</strong>
                  </div>
                  <div>
                    <span>Contract Value</span>
                    <strong>{formatCurrency(detail.ContractValue)}</strong>
                  </div>
                  <div>
                    <span>Start Date</span>
                    <strong>{formatDate(detail.StartDate)}</strong>
                  </div>
                  <div>
                    <span>End Date</span>
                    <strong>{formatDate(detail.EndDate)}</strong>
                  </div>
                  <div>
                    <span>Progress</span>
                    <strong>{detail.Progress}%</strong>
                  </div>
                  <div>
                    <span>Contract Manager</span>
                    <strong>{detail.ContractManager}</strong>
                  </div>
                </div>
                <div className="requisition-detail-note">
                  <h4>Notes</h4>
                  <p>{detail.Notes}</p>
                </div>
                <div className="requisition-detail-note contract-milestones">
                  <h4>Milestone History</h4>
                  {milestoneLoading ? <div className="plan-loading">Loading milestone history...</div> : null}
                  {milestoneError ? <div className="portal-alert">{milestoneError}</div> : null}
                  {milestones.length ? (
                    <div className="contract-milestone-list">
                      {milestones.map((milestone) => (
                        <article key={milestone.MilestoneId} className="contract-milestone-item">
                          <div className="contract-milestone-item__header">
                            <strong>{milestone.MilestoneTitle}</strong>
                            <span className={`admin-status ${contractManagementStatusTone(milestone.Status)}`}>
                              {milestone.Status}
                            </span>
                          </div>
                          <div className="contract-milestone-meta">
                            <span>Progress: {milestone.Progress}%</span>
                            <span>Manager: {milestone.ContractManager}</span>
                            <span>Logged by: {milestone.RecordedBy}</span>
                            <span>{formatDateTimeShort(milestone.RecordedAt)}</span>
                          </div>
                          <p>{milestone.Notes}</p>
                        </article>
                      ))}
                    </div>
                  ) : !milestoneLoading ? (
                    <p className="plan-empty">No milestone updates recorded yet.</p>
                  ) : null}
                </div>
                <div className="plan-form plan-form--edit contract-milestone-form">
                  <div className="plan-form__header">
                    <div>
                      <h3>Log Milestone Update</h3>
                      <p>Record progress, update status, and capture the latest delivery note.</p>
                    </div>
                  </div>
                  {milestoneSubmitError ? <div className="portal-alert">{milestoneSubmitError}</div> : null}
                  {!canManage ? (
                    <p className="plan-muted">Your role can view contract history but cannot log milestone updates.</p>
                  ) : null}
                  <fieldset className="plan-fieldset" disabled={!canManage || milestoneSubmitting}>
                    <div className="plan-form-grid">
                      <label className="plan-field plan-field--span">
                        <span>Milestone Title</span>
                        <input
                          className="plan-input"
                          value={milestoneForm.MilestoneTitle}
                          onChange={(event) =>
                            setMilestoneForm((prev) => ({ ...prev, MilestoneTitle: event.target.value }))
                          }
                          placeholder="e.g. Hardware installation completed"
                        />
                      </label>
                      <label className="plan-field">
                        <span>Status</span>
                        <select
                          className="plan-select"
                          value={milestoneForm.Status}
                          onChange={(event) => setMilestoneForm((prev) => ({ ...prev, Status: event.target.value }))}
                        >
                          {contractManagementStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="plan-field">
                        <span>Progress</span>
                        <input
                          className="plan-input"
                          type="number"
                          min={0}
                          max={100}
                          value={milestoneForm.Progress}
                          onChange={(event) => setMilestoneForm((prev) => ({ ...prev, Progress: event.target.value }))}
                        />
                      </label>
                      <label className="plan-field">
                        <span>Contract Manager</span>
                        <input
                          className="plan-input"
                          value={milestoneForm.ContractManager}
                          onChange={(event) =>
                            setMilestoneForm((prev) => ({ ...prev, ContractManager: event.target.value }))
                          }
                        />
                      </label>
                      <label className="plan-field">
                        <span>Recorded By</span>
                        <input
                          className="plan-input"
                          value={milestoneForm.RecordedBy}
                          onChange={(event) => setMilestoneForm((prev) => ({ ...prev, RecordedBy: event.target.value }))}
                        />
                      </label>
                      <label className="plan-field plan-field--span">
                        <span>Update Notes</span>
                        <textarea
                          className="plan-textarea"
                          rows={4}
                          value={milestoneForm.Notes}
                          onChange={(event) => setMilestoneForm((prev) => ({ ...prev, Notes: event.target.value }))}
                          placeholder="Describe what was delivered, delayed, or escalated."
                        />
                      </label>
                    </div>
                  </fieldset>
                </div>
                <div className="requisition-actions">
                  <button type="button" className="plan-button" onClick={submitMilestone} disabled={!canManage || milestoneSubmitting}>
                    {milestoneSubmitting ? 'Saving Update...' : 'Log Milestone Update'}
                  </button>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    onClick={closeDetail}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const InspectionAcceptanceModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({ status: '', query: '' });
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<InspectionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refreshInspections = async () => {
    if (!token) {
      setInspections([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInspections(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined
      });
      setInspections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inspections.');
      setInspections([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshInspections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status, filters.query]);

  const viewDetail = async (inspectionId: string) => {
    if (!token) {
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await fetchInspectionDetail(token, inspectionId);
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load inspection detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="portal-module inspection-acceptance">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Inspection ID, contract, or vendor"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {inspectionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Inspection ID</th>
            <th>Contract</th>
            <th>Vendor</th>
            <th>Status</th>
            <th>Scheduled</th>
            <th>Outcome</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {inspections.map((inspection) => (
            <tr key={inspection.InspectionId}>
              <td>{inspection.InspectionId}</td>
              <td>{inspection.ContractCode}</td>
              <td>{inspection.VendorName}</td>
              <td>
                <span className={`admin-status ${inspectionStatusTone(inspection.Status)}`}>
                  {inspection.Status}
                </span>
              </td>
              <td>{formatDate(inspection.ScheduledDate)}</td>
              <td>{inspection.Outcome ?? '—'}</td>
              <td>
                <button type="button" className="plan-link" onClick={() => viewDetail(inspection.InspectionId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!inspections.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No inspections match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isLoading ? <p>Loading inspections...</p> : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setDetailOpen(false)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.TenderTitle : 'Inspection Detail'}</h3>
                <p>{detail ? `Inspection ${detail.InspectionId}` : 'Loading inspection data.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading inspection details...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {detail ? (
              <div className="requisition-detail requisition-detail--modal">
                <div className="requisition-detail-grid">
                  <div>
                    <span>Contract Code</span>
                    <strong>{detail.ContractCode}</strong>
                  </div>
                  <div>
                    <span>Vendor</span>
                    <strong>{detail.VendorName}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{detail.Status}</strong>
                  </div>
                  <div>
                    <span>Scheduled Date</span>
                    <strong>{formatDate(detail.ScheduledDate)}</strong>
                  </div>
                  <div>
                    <span>Completed Date</span>
                    <strong>{formatDate(detail.CompletedDate ?? null)}</strong>
                  </div>
                  <div>
                    <span>Inspector</span>
                    <strong>{detail.InspectorName}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{detail.Location}</strong>
                  </div>
                  <div>
                    <span>Outcome</span>
                    <strong>{detail.Outcome ?? '—'}</strong>
                  </div>
                </div>
                {detail.Notes ? (
                  <div className="requisition-detail-note">
                    <h4>Notes</h4>
                    <p>{detail.Notes}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const EvaluationReportModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({ status: '', query: '' });
  const [reports, setReports] = useState<EvaluationReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvaluationReportItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refreshReports = async () => {
    if (!token) {
      setReports([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchEvaluationReports(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined
      });
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load evaluation reports.');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status, filters.query]);

  const viewDetail = async (reportId: string) => {
    if (!token) {
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await fetchEvaluationReportDetail(token, reportId);
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load evaluation report detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="portal-module evaluation-report">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Report ID, tender, or lead"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {evaluationReportStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Report ID</th>
            <th>Tender</th>
            <th>Recommendation</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Lead</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.ReportId}>
              <td>{report.ReportId}</td>
              <td>{report.TenderTitle}</td>
              <td>{report.Recommendation}</td>
              <td>
                <span className={`admin-status ${evaluationReportStatusTone(report.Status)}`}>{report.Status}</span>
              </td>
              <td>{formatDate(report.SubmittedAt)}</td>
              <td>{report.CommitteeLead}</td>
              <td>
                <button type="button" className="plan-link" onClick={() => viewDetail(report.ReportId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!reports.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No evaluation reports match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isLoading ? <p>Loading evaluation reports...</p> : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setDetailOpen(false)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.TenderTitle : 'Evaluation Report'}</h3>
                <p>{detail ? `Evaluation Report ${detail.ReportId}` : 'Loading evaluation report.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading evaluation report...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {detail ? (
              <div className="requisition-detail requisition-detail--modal">
                <div className="requisition-detail-grid">
                  <div>
                    <span>Report ID</span>
                    <strong>{detail.ReportId}</strong>
                  </div>
                  <div>
                    <span>Tender ID</span>
                    <strong>{detail.TenderId}</strong>
                  </div>
                  <div>
                    <span>Committee Lead</span>
                    <strong>{detail.CommitteeLead}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{detail.Status}</strong>
                  </div>
                  <div>
                    <span>Recommendation</span>
                    <strong>{detail.Recommendation}</strong>
                  </div>
                  <div>
                    <span>Score Summary</span>
                    <strong>{detail.ScoreSummary}</strong>
                  </div>
                  <div>
                    <span>Submitted</span>
                    <strong>{formatDate(detail.SubmittedAt)}</strong>
                  </div>
                </div>
                <div className="requisition-detail-note">
                  <h4>Notes</h4>
                  <p>{detail.Notes}</p>
                </div>
                <div className="requisition-actions">
                  <button type="button" className="plan-button plan-button--secondary">
                    Export Report
                  </button>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    onClick={() => setDetailOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const AssignedTendersModulePage = ({
  module,
  moduleData,
  moduleError,
  isLoading,
  token
}: {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  isLoading: boolean;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({ query: '', status: '', category: '' });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState<AssignedTenderItem | null>(null);
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [nonComplianceReason, setNonComplianceReason] = useState('');
  const [conflictReason, setConflictReason] = useState('');
  const [recommendation, setRecommendation] = useState<'Award' | 'ReTender'>('Award');
  const [recommendationJustification, setRecommendationJustification] = useState('');
  const [thresholdNote, setThresholdNote] = useState('');
  const [lockedTenders, setLockedTenders] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenderDetail | null>(null);
  const [detailThreshold, setDetailThreshold] = useState<ThresholdBand | null>(null);
  const [detailThresholdSource, setDetailThresholdSource] = useState<'api' | 'local'>('local');

  const detailBudget = detail?.Budget ?? null;
  const detailRouting = useMemo(() => {
    if (detailBudget === null || detailBudget === undefined || detailBudget <= 0) {
      return null;
    }
    return detailThreshold ?? resolveThresholdRouting(detailBudget);
  }, [detailBudget, detailThreshold]);

  const bppStatus = useMemo(() => {
    if (!detailRouting) {
      return null;
    }
    return resolveBppStatus(detail?.Status, detailRouting.requiresBpp);
  }, [detailRouting, detail?.Status]);

  useEffect(() => {
    if (!token || !detailBudget || detailBudget <= 0) {
      setDetailThreshold(null);
      setDetailThresholdSource('local');
      return;
    }

    resolveApprovalThreshold(token, { amount: detailBudget })
      .then((threshold: ApprovalThresholdDetail) => {
        const fallback = resolveThresholdRouting(detailBudget);
        setDetailThreshold({
          ...fallback,
          label: threshold.MaxAmount
            ? `${formatCurrency(threshold.MinAmount)} - ${formatCurrency(threshold.MaxAmount)}`
            : `${formatCurrency(threshold.MinAmount)}+`,
          approvalLevel: threshold.ApprovalRoute,
          requiresBpp: threshold.RequiresBpp,
          escalation: threshold.Notes ?? fallback.escalation,
          steps: fallback.steps
        });
        setDetailThresholdSource('api');
      })
      .catch(() => {
        setDetailThreshold(null);
        setDetailThresholdSource('local');
      });
  }, [token, detailBudget]);

  const rawRows = useMemo(() => {
    if (Array.isArray(moduleData)) {
      return moduleData as Record<string, unknown>[];
    }
    if (moduleData && typeof moduleData === 'object' && Array.isArray((moduleData as { Items?: unknown }).Items)) {
      return (moduleData as { Items: Record<string, unknown>[] }).Items;
    }
    return [];
  }, [moduleData]);

  const rows = useMemo<AssignedTenderItem[]>(() => {
    return rawRows.map((row) => {
      const reportCode = toText(readField(row, ['ReportCode', 'report_code', 'reportCode']), '—');
      const tenderId = toText(readField(row, ['TenderId', 'tender_id', 'tenderId']), '—');
      const tenderTitle = toText(readField(row, ['TenderTitle', 'tender_title', 'tenderTitle']), 'Untitled Tender');
      const committeeLead = toText(readField(row, ['CommitteeLead', 'committee_lead', 'committeeLead']), '—');
      const evaluationStatus = toText(readField(row, ['EvaluationStatus', 'evaluation_status', 'Status', 'status']), 'Pending');
      const tenderStatus = toText(readField(row, ['TenderStatus', 'tender_status', 'TenderState', 'tenderStatus']), 'Unknown');
      const procurementCategory = toText(readField(row, ['ProcurementCategory', 'procurement_category', 'Category', 'category']), 'Unspecified');
      const submissionDeadline = toText(readField(row, ['SubmissionDeadline', 'closing_date', 'ClosingDate', 'submission_deadline']), '');
      const openingDate = toText(readField(row, ['OpeningDate', 'opening_date', 'openingDate']), '');
      const submittedAt = toText(readField(row, ['SubmittedAt', 'submitted_at', 'submittedAt']), '');
      const lockedValue = readField(row, ['IsLocked', 'is_locked', 'Locked', 'locked']);
      const isLocked =
        lockedValue === true || lockedValue === 'true' || lockedValue === 1 || lockedValue === '1';

      return {
        ReportCode: reportCode,
        TenderId: tenderId,
        TenderTitle: tenderTitle,
        CommitteeLead: committeeLead,
        EvaluationStatus: evaluationStatus,
        TenderStatus: tenderStatus,
        ProcurementCategory: procurementCategory,
        SubmissionDeadline: submissionDeadline || null,
        OpeningDate: openingDate || null,
        SubmittedAt: submittedAt,
        IsLocked: isLocked
      };
    });
  }, [rawRows]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      if (row.ProcurementCategory) {
        values.add(row.ProcurementCategory);
      }
    });
    return Array.from(values).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return rows
      .filter((row) => (filters.status ? row.EvaluationStatus === filters.status : true))
      .filter((row) => (filters.category ? row.ProcurementCategory === filters.category : true))
      .filter((row) => {
        if (!query) {
          return true;
        }
        return (
          row.TenderTitle.toLowerCase().includes(query) ||
          row.ReportCode.toLowerCase().includes(query) ||
          row.CommitteeLead.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aTime = a.SubmittedAt ? new Date(a.SubmittedAt).getTime() : 0;
        const bTime = b.SubmittedAt ? new Date(b.SubmittedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [rows, filters]);

  const summary = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const dueSoon = rows.filter((row) => {
      if (!row.SubmissionDeadline) {
        return false;
      }
      const deadline = new Date(row.SubmissionDeadline).getTime();
      return !Number.isNaN(deadline) && deadline - now <= weekMs && deadline - now >= 0;
    }).length;
    const inReview = rows.filter((row) =>
      ['Submitted', 'Under Review'].includes(row.EvaluationStatus)
    ).length;
    const completed = rows.filter((row) => ['Approved', 'Returned'].includes(row.EvaluationStatus)).length;
    return { total: rows.length, dueSoon, inReview, completed };
  }, [rows]);

  const canActOnRow = (row: AssignedTenderItem) => {
    return !row.IsLocked && !lockedTenders.has(row.TenderId);
  };

  const resetActionForm = () => {
    setClarificationNotes('');
    setNonComplianceReason('');
    setConflictReason('');
    setRecommendation('Award');
    setRecommendationJustification('');
    setThresholdNote('');
    setActionType(null);
  };

  const openActionModal = (row: AssignedTenderItem, type: string) => {
    setActionMessage(null);
    setActionError(null);
    resetActionForm();
    setActiveRow(row);
    setActionType(type);
    setActionModalOpen(true);
  };

  const closeActionModal = () => {
    setActionModalOpen(false);
    setActiveRow(null);
    resetActionForm();
  };

  const handleTenderDetail = async (row: AssignedTenderItem) => {
    if (!row.TenderId) {
      return;
    }
    if (!token) {
      setDetailError('Authentication token is missing.');
      setDetailOpen(true);
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await fetchTenderDetail(token, row.TenderId);
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load tender details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      'Tender Title',
      'Report Code',
      'Category',
      'Evaluation Status',
      'Tender Status',
      'Submission Deadline',
      'Opening Date',
      'Committee Lead'
    ];
    const rowsToExport = filteredRows.map((row) => [
      row.TenderTitle,
      row.ReportCode,
      row.ProcurementCategory,
      row.EvaluationStatus,
      row.TenderStatus,
      row.SubmissionDeadline ? formatDate(row.SubmissionDeadline) : '—',
      row.OpeningDate ? formatDate(row.OpeningDate) : '—',
      row.CommitteeLead
    ]);
    const csv = [headers, ...rowsToExport]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `assigned-tenders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const submitAction = async () => {
    if (!activeRow) {
      return;
    }
    if (!token) {
      setActionError('Authentication token is missing.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      let payload = {
        ActionType: '',
        TenderId: activeRow.TenderId,
        ReportCode: activeRow.ReportCode
      } as {
        ActionType: string;
        TenderId: string;
        ReportCode?: string;
        Notes?: string;
        Reason?: string;
        Justification?: string;
        Recommendation?: string;
        ThresholdNote?: string;
        RequestedBy?: string;
      };

      const requestedBy =
        typeof window !== 'undefined' ? window.localStorage.getItem('internalAuthEmail') ?? undefined : undefined;

      if (actionType === 'RequestClarification') {
        if (!clarificationNotes.trim()) {
          throw new Error('Clarification notes are required.');
        }
        payload = { ...payload, ActionType: 'RequestClarification', Notes: clarificationNotes.trim(), RequestedBy: requestedBy };
      } else if (actionType === 'RecordNonCompliance') {
        if (!nonComplianceReason.trim()) {
          throw new Error('Non-compliance reason is required.');
        }
        payload = { ...payload, ActionType: 'RecordNonCompliance', Reason: nonComplianceReason.trim(), RequestedBy: requestedBy };
      } else if (actionType === 'ConflictOfInterest') {
        if (!conflictReason.trim()) {
          throw new Error('Conflict of interest reason is required.');
        }
        payload = { ...payload, ActionType: 'ConflictOfInterest', Reason: conflictReason.trim(), RequestedBy: requestedBy };
      } else if (actionType === 'RecommendAward' || actionType === 'RecommendReTender') {
        if (!recommendationJustification.trim()) {
          throw new Error('Justification is required.');
        }
        payload = {
          ...payload,
          ActionType: recommendation === 'Award' ? 'RecommendAward' : 'RecommendReTender',
          Recommendation: recommendation,
          Justification: recommendationJustification.trim(),
          RequestedBy: requestedBy
        };
      } else if (actionType === 'EscalateToBoard') {
        if (!thresholdNote.trim()) {
          throw new Error('Threshold note is required.');
        }
        payload = {
          ...payload,
          ActionType: 'EscalateToBoard',
          ThresholdNote: thresholdNote.trim(),
          RequestedBy: requestedBy
        };
      } else if (actionType === 'StartEvaluation') {
        payload = { ...payload, ActionType: 'StartEvaluation', RequestedBy: requestedBy };
      } else {
        throw new Error('Select a valid action.');
      }

      await logEvaluationAction(token, payload);

      if (actionType === 'ConflictOfInterest') {
        setLockedTenders((prev) => new Set(prev).add(activeRow.TenderId));
      }

      setActionMessage('Action recorded successfully.');
      closeActionModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to record action.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="portal-module assigned-tenders">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="admin-metric">
          <strong>{summary.total}</strong>
          <span>Assigned tenders</span>
        </article>
        <article className="admin-metric">
          <strong>{summary.dueSoon}</strong>
          <span>Due within 7 days</span>
        </article>
        <article className="admin-metric">
          <strong>{summary.inReview}</strong>
          <span>Under review</span>
        </article>
      </div>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Tender title, report, or lead"
            />
          </label>
          <label className="plan-field">
            <span>Evaluation Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              {evaluationReportStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Category</span>
            <select
              className="plan-select"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="plan-actions">
          <button type="button" className="plan-button plan-button--secondary" onClick={handleExport}>
            Export CSV
          </button>
        </div>
      </div>

      {moduleError ? <div className="portal-alert">{moduleError}</div> : null}
      {actionError ? <div className="portal-alert">{actionError}</div> : null}
      {actionMessage ? <div className="portal-alert" style={{ borderColor: '#c7ebd8', background: '#eefbf3', color: '#0b5d3b' }}>{actionMessage}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Tender</th>
            <th>Category</th>
            <th>Evaluation</th>
            <th>Tender Status</th>
            <th>Submission Deadline</th>
            <th>Opening Date</th>
            <th>Committee Lead</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={`${row.ReportCode}-${row.TenderId}`}>
              <td>
                <strong>{row.TenderTitle}</strong>
                <div className="plan-muted">Report {row.ReportCode}</div>
              </td>
              <td>
                <span className="admin-tag">{row.ProcurementCategory}</span>
              </td>
              <td>
                <span className={`admin-status ${evaluationReportStatusTone(row.EvaluationStatus)}`}>
                  {row.EvaluationStatus}
                </span>
                {(!canActOnRow(row)) && (
                  <div className="plan-muted">Locked</div>
                )}
              </td>
              <td>
                <span className={`admin-status ${tenderStatusTone(row.TenderStatus)}`}>{row.TenderStatus}</span>
              </td>
              <td>{formatDate(row.SubmissionDeadline)}</td>
              <td>{formatDate(row.OpeningDate)}</td>
              <td>{row.CommitteeLead}</td>
              <td>
                <div className="eval-actions">
                  <button type="button" className="plan-link" onClick={() => handleTenderDetail(row)}>
                    Open Detail
                  </button>
                  <button
                    type="button"
                    className="plan-link"
                    disabled={!canActOnRow(row)}
                    onClick={() => openActionModal(row, 'StartEvaluation')}
                  >
                    Start Evaluation
                  </button>
                  <button
                    type="button"
                    className="plan-link"
                    disabled={!canActOnRow(row)}
                    onClick={() => openActionModal(row, 'RequestClarification')}
                  >
                    Request Clarification
                  </button>
                  <button
                    type="button"
                    className="plan-link"
                    disabled={!canActOnRow(row)}
                    onClick={() => openActionModal(row, 'RecordNonCompliance')}
                  >
                    Record NonCompliance
                  </button>
                  <button
                    type="button"
                    className="plan-link"
                    disabled={!canActOnRow(row)}
                    onClick={() => openActionModal(row, 'ConflictOfInterest')}
                  >
                    Flag Conflict
                  </button>
                  <button
                    type="button"
                    className="plan-link"
                    disabled={!canActOnRow(row)}
                    onClick={() => openActionModal(row, 'RecommendAward')}
                  >
                    Recommend
                  </button>
                  <button
                    type="button"
                    className="plan-link"
                    disabled={!canActOnRow(row)}
                    onClick={() => openActionModal(row, 'EscalateToBoard')}
                  >
                    Escalate
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!filteredRows.length && !isLoading ? (
            <tr>
              <td colSpan={8} className="plan-empty">
                No assigned tenders match the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isLoading ? <p>Loading assigned tenders...</p> : null}

      {actionModalOpen && activeRow ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeActionModal} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>PPA Action</h3>
                <p>{activeRow.TenderTitle}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeActionModal}>
                Close
              </button>
            </div>

            {actionType === 'RequestClarification' && (
              <div className="plan-fieldset">
                <label className="plan-field">
                  <span>Clarification notes</span>
                  <textarea
                    className="plan-textarea"
                    rows={4}
                    value={clarificationNotes}
                    onChange={(event) => setClarificationNotes(event.target.value)}
                  />
                </label>
              </div>
            )}

            {actionType === 'RecordNonCompliance' && (
              <div className="plan-fieldset">
                <label className="plan-field">
                  <span>Non-compliance reason</span>
                  <textarea
                    className="plan-textarea"
                    rows={4}
                    value={nonComplianceReason}
                    onChange={(event) => setNonComplianceReason(event.target.value)}
                  />
                </label>
              </div>
            )}

            {actionType === 'ConflictOfInterest' && (
              <div className="plan-fieldset">
                <label className="plan-field">
                  <span>Conflict of interest reason</span>
                  <textarea
                    className="plan-textarea"
                    rows={4}
                    value={conflictReason}
                    onChange={(event) => setConflictReason(event.target.value)}
                  />
                </label>
              </div>
            )}

            {(actionType === 'RecommendAward' || actionType === 'RecommendReTender') && (
              <div className="plan-fieldset">
                <label className="plan-field">
                  <span>Recommendation</span>
                  <select
                    className="plan-select"
                    value={recommendation}
                    onChange={(event) => setRecommendation(event.target.value as 'Award' | 'ReTender')}
                  >
                    <option value="Award">Recommend Award</option>
                    <option value="ReTender">Recommend Re-Tender</option>
                  </select>
                </label>
                <label className="plan-field">
                  <span>Justification</span>
                  <textarea
                    className="plan-textarea"
                    rows={4}
                    value={recommendationJustification}
                    onChange={(event) => setRecommendationJustification(event.target.value)}
                  />
                </label>
              </div>
            )}

            {actionType === 'EscalateToBoard' && (
              <div className="plan-fieldset">
                <label className="plan-field">
                  <span>Threshold note</span>
                  <textarea
                    className="plan-textarea"
                    rows={4}
                    value={thresholdNote}
                    onChange={(event) => setThresholdNote(event.target.value)}
                  />
                </label>
              </div>
            )}

            {actionType === 'StartEvaluation' && (
              <div className="plan-fieldset">
                <p className="plan-muted">
                  This will log the start of evaluation for this tender. Continue?
                </p>
              </div>
            )}

            <div className="plan-actions">
              <button type="button" className="plan-button plan-button--secondary" onClick={closeActionModal}>
                Cancel
              </button>
              <button type="button" className="plan-button" onClick={submitAction} disabled={actionLoading}>
                {actionLoading ? 'Recording...' : 'Record Action'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setDetailOpen(false)} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail ? detail.Title : 'Tender Detail'}</h3>
                <p>{detail ? detail.TenderId : 'Loading tender detail...'}</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading tender detail...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {detail ? (
              <div className="requisition-detail requisition-detail--modal">
                <div className="requisition-detail-grid">
                  <div>
                    <span>Category</span>
                    <strong>{detail.Category}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{detail.Status}</strong>
                  </div>
                  <div>
                    <span>Budget</span>
                    <strong>
                      {detail.Budget !== null && detail.Budget !== undefined
                        ? formatCurrency(detail.Budget)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Budget Code</span>
                    <strong>{detail.BudgetCode ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Department</span>
                    <strong>{detail.Department ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Opening Date</span>
                    <strong>{formatDate(detail.OpeningDate ?? null)}</strong>
                  </div>
                  <div>
                    <span>Closing Date</span>
                    <strong>{formatDate(detail.ClosingDate ?? null)}</strong>
                  </div>
                  <div className="requisition-detail__span">
                    <span>Description</span>
                    <strong>{detail.Description}</strong>
                  </div>
                  {detail.EvaluationCriteria ? (
                    <div className="requisition-detail__span">
                      <span>Evaluation Criteria</span>
                      <strong>{detail.EvaluationCriteria}</strong>
                    </div>
                  ) : null}
                </div>
                {detailRouting ? (
                  <div className="routing-panel">
                    <div className="routing-panel__header">
                      <div>
                        <h4>Approval Routing</h4>
                        <p>Threshold-based approval path and escalation visibility.</p>
                      </div>
                      <div className="routing-panel__badges">
                        <span className="admin-status admin-status--good">
                          {detailThresholdSource === 'api' ? 'Policy API' : 'Local Policy'}
                        </span>
                        {bppStatus ? (
                          <span className={`admin-status ${bppStatus.tone}`}>No Objection: {bppStatus.label}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="routing-panel__grid">
                      <div>
                        <span>Threshold Band</span>
                        <strong>{detailRouting.label}</strong>
                      </div>
                      <div>
                        <span>Approval Level</span>
                        <strong>{detailRouting.approvalLevel}</strong>
                      </div>
                      <div>
                        <span>Expected Timeline</span>
                        <strong>{detailRouting.timeline}</strong>
                      </div>
                      <div>
                        <span>Escalation</span>
                        <strong>{detailRouting.escalation}</strong>
                      </div>
                    </div>
                    <div className="routing-steps">
                      {detailRouting.steps.map((step, index) => (
                        <div key={`${detailRouting.id}-${step}`} className="routing-step">
                          <span className="routing-step__index">{String(index + 1).padStart(2, '0')}</span>
                          <div>
                            <strong>{step}</strong>
                            <span className="routing-step__meta">
                              {detailRouting.requiresBpp && step.includes('BPP')
                                ? 'Mandatory prior review'
                                : 'Standard approval gate'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="routing-panel routing-panel--empty">
                    <h4>Approval Routing</h4>
                    <p className="plan-muted">Budget data is required to compute routing thresholds.</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const WorkflowBlueprintModulePage = ({
  module,
  token,
  role
}: {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
}) => {
  const [blueprint, setBlueprint] = useState<WorkflowBlueprint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setBlueprint(null);
      setError('Authentication token is missing.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchWorkflowBlueprint(token)
      .then((result) => {
        if (isMounted) {
          setBlueprint(result);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setBlueprint(null);
          setError(err instanceof Error ? err.message : 'Unable to load workflow blueprint.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const phases = useMemo(
    () => [...(blueprint?.Phases ?? [])].sort((left, right) => left.Sequence - right.Sequence),
    [blueprint]
  );

  const statesByPhase = useMemo(() => {
    const groups = new Map<string, WorkflowBlueprintState[]>();
    for (const state of blueprint?.States ?? []) {
      const existing = groups.get(state.PhaseId) ?? [];
      existing.push(state);
      groups.set(state.PhaseId, existing);
    }

    for (const states of groups.values()) {
      states.sort((left, right) => left.Sequence - right.Sequence);
    }

    return groups;
  }, [blueprint]);

  const stateLookup = useMemo(() => new Map((blueprint?.States ?? []).map((state) => [state.Id, state])), [blueprint]);

  const currentRoleTasks = useMemo(() => {
    if (!blueprint || !role) {
      return [] as WorkflowBlueprintRoleTask[];
    }

    return blueprint.RoleTasks.filter((task) => task.Role === role);
  }, [blueprint, role]);

  const otherRoleTasks = useMemo(() => {
    if (!blueprint) {
      return [] as WorkflowBlueprintRoleTask[];
    }

    return blueprint.RoleTasks.filter((task) => task.Role !== role);
  }, [blueprint, role]);

  const formatThresholdRange = (threshold: WorkflowBlueprintThreshold) => {
    const min = formatCurrency(threshold.MinAmount);
    const max = threshold.MaxAmount == null ? 'and above' : formatCurrency(threshold.MaxAmount);
    return `${min} - ${max}`;
  };

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      {error ? <div className="portal-alert">{error}</div> : null}
      {isLoading ? <p>Loading workflow blueprint...</p> : null}

      {blueprint ? (
        <>
          <div className="portal-alert">
            <strong>{blueprint.Title}</strong>: {blueprint.Summary}
            <br />
            Threshold source: {blueprint.ThresholdSource === 'database' ? 'Live threshold table' : 'Catalog fallback'}
          </div>

          <section className="portal-section">
            <h3>Current Role Focus</h3>
            <p>{role ? `Active role: ${toTitle(role)}` : 'No active role found.'}</p>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Task</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {currentRoleTasks.map((task) => (
                  <tr key={`${task.Role}-${task.StateId}-${task.Task}`}>
                    <td>{stateLookup.get(task.StateId)?.Title ?? task.StateId}</td>
                    <td>{task.Task}</td>
                    <td>{task.ExpectedOutcome}</td>
                  </tr>
                ))}
                {!currentRoleTasks.length ? (
                  <tr>
                    <td colSpan={3} className="plan-empty">
                      No role-specific workflow tasks are mapped for the current session.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="portal-section">
            <h3>Workflow Phases</h3>
            {phases.map((phase: WorkflowBlueprintPhase) => {
              const states = statesByPhase.get(phase.Id) ?? [];
              return (
                <div key={phase.Id}>
                  <h4>{phase.Title}</h4>
                  <p>{phase.Description}</p>
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Owners</th>
                        <th>Actions</th>
                        <th>Gate</th>
                        <th>PPA Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {states.map((state) => (
                        <tr key={state.Id}>
                          <td>
                            {state.Title}
                            {state.IsStart ? ' (Start)' : ''}
                            {state.IsTerminal ? ' (End)' : ''}
                          </td>
                          <td>{state.PrimaryOwners.map((owner) => toTitle(owner)).join(', ')}</td>
                          <td>{state.Actions.join(', ')}</td>
                          <td>{state.IsDecisionGate ? 'Decision Gate' : 'Process Step'}</td>
                          <td>{state.PpaReference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>

          <section className="portal-section">
            <h3>State Transitions</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {blueprint.Transitions.map((transition) => (
                  <tr key={`${transition.FromStateId}-${transition.ToStateId}-${transition.Condition}`}>
                    <td>{stateLookup.get(transition.FromStateId)?.Title ?? transition.FromStateId}</td>
                    <td>{stateLookup.get(transition.ToStateId)?.Title ?? transition.ToStateId}</td>
                    <td>{transition.Condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="portal-section">
            <h3>Threshold Bands</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Procurement Type</th>
                  <th>Band</th>
                  <th>Approval Route</th>
                  <th>Board</th>
                  <th>BPP</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {blueprint.Thresholds.map((threshold, index) => (
                  <tr key={`${threshold.ProcurementType}-${threshold.MinAmount}-${index}`}>
                    <td>{threshold.ProcurementType}</td>
                    <td>{formatThresholdRange(threshold)}</td>
                    <td>{threshold.ApprovalRoute}</td>
                    <td>{threshold.RequiresBoard ? 'Required' : 'Not required'}</td>
                    <td>{threshold.RequiresBpp ? 'Required' : 'Not required'}</td>
                    <td>{threshold.Notes || 'No note provided.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="portal-section">
            <h3>Role Task Matrix</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>Task</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {otherRoleTasks.map((task) => (
                  <tr key={`${task.Role}-${task.StateId}-${task.Task}`}>
                    <td>{task.DisplayName}</td>
                    <td>{stateLookup.get(task.StateId)?.Title ?? task.StateId}</td>
                    <td>{task.Task}</td>
                    <td>{task.ExpectedOutcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="portal-section">
            <h3>Database Tables</h3>
            <p>{blueprint.DatabaseTables.join(', ')}</p>
          </section>
        </>
      ) : null}
    </section>
  );
};

const ProcurementPlansModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({ fiscalYear: '', department: '', status: '' });
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProcurementPlanSummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });

  const canManage = hasModuleAction(module, 'procurement_plan.manage');

  const [createForm, setCreateForm] = useState({
    planTitle: '',
    department: '',
    fiscalYear: String(new Date().getFullYear()),
    totalBudget: '',
    status: 'Draft',
    notes: ''
  });

  const [editForm, setEditForm] = useState({
    planTitle: '',
    department: '',
    fiscalYear: '',
    totalBudget: '',
    status: '',
    notes: '',
    submittedAt: '',
    approvedAt: ''
  });

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2];
  }, []);

  const refreshPlans = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fiscalYear = filters.fiscalYear ? Number(filters.fiscalYear) : undefined;
      const department = filters.department.trim() || undefined;
      const status = filters.status.trim() || undefined;
      const data = await fetchProcurementPlans(token, {
        fiscalYear,
        department,
        status,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir
      });
      setPlans(data.Items);
      setPagination((prev) => ({
        ...prev,
        page: data.Page,
        pageSize: data.PageSize,
        total: data.Total
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load procurement plans.');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    filters.fiscalYear,
    filters.department,
    filters.status,
    pagination.page,
    pagination.pageSize,
    sort.sortBy,
    sort.sortDir
  ]);

  const handleCreate = async () => {
    if (!token || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      const payload: ProcurementPlanCreateRequest = {
        PlanTitle: createForm.planTitle.trim(),
        Department: createForm.department.trim(),
        FiscalYear: Number(createForm.fiscalYear),
        TotalBudget: Number(createForm.totalBudget || 0),
        Notes: createForm.notes.trim() || null,
        Status: createForm.status || null
      };

      await createProcurementPlan(token, payload);
      setCreateForm({
        planTitle: '',
        department: '',
        fiscalYear: String(new Date().getFullYear()),
        totalBudget: '',
        status: 'Draft',
        notes: ''
      });
      setShowCreateForm(false);
      await refreshPlans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create procurement plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (plan: ProcurementPlanSummary) => {
    if (!canManage) {
      return;
    }
    setEditingPlanId(plan.PlanId);
    setActionError(null);
    setEditForm({
      planTitle: plan.PlanTitle,
      department: plan.Department,
      fiscalYear: String(plan.FiscalYear),
      totalBudget: String(plan.TotalBudget),
      status: plan.Status,
      notes: '',
      submittedAt: '',
      approvedAt: ''
    });
  };

  const cancelEdit = () => {
    setEditingPlanId(null);
    setEditForm({
      planTitle: '',
      department: '',
      fiscalYear: '',
      totalBudget: '',
      status: '',
      notes: '',
      submittedAt: '',
      approvedAt: ''
    });
  };

  const handleUpdate = async () => {
    if (!token || !editingPlanId || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      const payload: ProcurementPlanUpdateRequest = {
        PlanTitle: editForm.planTitle.trim() || null,
        Department: editForm.department.trim() || null,
        FiscalYear: editForm.fiscalYear ? Number(editForm.fiscalYear) : null,
        Status: editForm.status || null,
        TotalBudget: editForm.totalBudget ? Number(editForm.totalBudget) : null,
        Notes: editForm.notes.trim() || null,
        SubmittedAt: editForm.submittedAt ? new Date(editForm.submittedAt).toISOString() : null,
        ApprovedAt: editForm.approvedAt ? new Date(editForm.approvedAt).toISOString() : null
      };

      await updateProcurementPlan(token, editingPlanId, payload);
      cancelEdit();
      await refreshPlans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update procurement plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      await deleteProcurementPlan(token, deleteTarget.PlanId);
      setDeleteTarget(null);
      await refreshPlans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete procurement plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const pageStart = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Fiscal Year</span>
            <select
              className="plan-select"
              value={filters.fiscalYear}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, fiscalYear: event.target.value }));
              }}
            >
              <option value="">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Department</span>
            <input
              className="plan-input"
              type="text"
              placeholder="Filter by department"
              value={filters.department}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, department: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, status: event.target.value }));
              }}
            >
              <option value="">All statuses</option>
              {planStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Sort By</span>
            <select
              className="plan-select"
              value={sort.sortBy}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setSort((prev) => ({ ...prev, sortBy: event.target.value }));
              }}
            >
              <option value="created_at">Created Date</option>
              <option value="plan_title">Title</option>
              <option value="department">Department</option>
              <option value="fiscal_year">Fiscal Year</option>
              <option value="status">Status</option>
              <option value="total_budget">Total Budget</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Direction</span>
            <select
              className="plan-select"
              value={sort.sortDir}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setSort((prev) => ({ ...prev, sortDir: event.target.value }));
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Page Size</span>
            <select
              className="plan-select"
              value={String(pagination.pageSize)}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(event.target.value) }));
              }}
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="plan-actions">
            <button
              type="button"
              className="plan-button"
              onClick={() => {
                setActionError(null);
                if (canManage) {
                  setShowCreateForm(true);
                }
              }}
              disabled={!canManage}
            >
              Create Plan
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => {
                setFilters({ fiscalYear: '', department: '', status: '' });
                setSort({ sortBy: 'created_at', sortDir: 'desc' });
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Clear
            </button>
            <button type="button" className="plan-button" onClick={refreshPlans} disabled={isLoading}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}
      {!canManage ? (
        <div className="portal-alert">
          You have view-only access for procurement plans. Contact an administrator to make changes.
        </div>
      ) : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Department</th>
            <th>Year</th>
            <th>Status</th>
            <th>Total Budget</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.PlanId}>
              <td>{plan.PlanTitle}</td>
              <td>{plan.Department}</td>
              <td>{plan.FiscalYear}</td>
              <td>
                <span className={`admin-status ${statusTone(plan.Status)}`}>{plan.Status}</span>
              </td>
              <td>{formatCurrency(plan.TotalBudget)}</td>
              <td>{new Date(plan.CreatedAt).toLocaleDateString()}</td>
              <td>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      className="plan-link"
                      onClick={() => startEdit(plan)}
                      disabled={isSaving}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="plan-link plan-link--danger"
                      onClick={() => setDeleteTarget(plan)}
                      disabled={isSaving}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <span className="plan-muted">View</span>
                )}
              </td>
            </tr>
          ))}
          {!plans.length && !isLoading ? (
            <tr>
              <td colSpan={7} className="plan-empty">
                No procurement plans match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="plan-pagination">
        <span>
          Showing {pageStart}–{pageEnd} of {pagination.total} plans
        </span>
        <div className="plan-pagination__controls">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page <= 1 || isLoading}
          >
            Previous
          </button>
          <span className="plan-pagination__meta">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            disabled={pagination.page >= totalPages || isLoading}
          >
            Next
          </button>
        </div>
      </div>

      {isLoading ? <p>Loading procurement plans...</p> : null}

      {showCreateForm ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setShowCreateForm(false)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Create Procurement Plan</h3>
                <p>Capture a new annual procurement plan record.</p>
              </div>
              <button
                type="button"
                className="plan-link"
                onClick={() => setShowCreateForm(false)}
              >
                Close
              </button>
            </div>
            <div className="plan-form-grid">
              <label className="plan-field">
                <span>Title</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.planTitle}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, planTitle: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Department</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.department}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, department: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Fiscal Year</span>
                <input
                  className="plan-input"
                  type="number"
                  min="2000"
                  max="2100"
                  value={createForm.fiscalYear}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, fiscalYear: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Total Budget (NGN)</span>
                <input
                  className="plan-input"
                  type="number"
                  min="0"
                  value={createForm.totalBudget}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, totalBudget: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Status</span>
                <select
                  className="plan-select"
                  value={createForm.status}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {planStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field plan-field--span">
                <span>Notes</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Create Plan'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}

      {editingPlanId ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={cancelEdit} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Update Procurement Plan</h3>
                <p>Adjust status, budget, or metadata for the selected plan.</p>
              </div>
              <button type="button" className="plan-link" onClick={cancelEdit}>
                Close
              </button>
            </div>
            <div className="plan-form-grid">
              <label className="plan-field">
                <span>Title</span>
                <input
                  className="plan-input"
                  type="text"
                  value={editForm.planTitle}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, planTitle: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Department</span>
                <input
                  className="plan-input"
                  type="text"
                  value={editForm.department}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, department: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Fiscal Year</span>
                <input
                  className="plan-input"
                  type="number"
                  min="2000"
                  max="2100"
                  value={editForm.fiscalYear}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, fiscalYear: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Total Budget (NGN)</span>
                <input
                  className="plan-input"
                  type="number"
                  min="0"
                  value={editForm.totalBudget}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, totalBudget: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Status</span>
                <select
                  className="plan-select"
                  value={editForm.status}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {planStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Submitted At</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={editForm.submittedAt}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, submittedAt: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Approved At</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={editForm.approvedAt}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, approvedAt: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Notes</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={editForm.notes}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Update Plan'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setDeleteTarget(null)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Delete Procurement Plan</h3>
                <p>
                  This action cannot be undone. Confirm deletion of{' '}
                  <strong>{deleteTarget.PlanTitle}</strong>.
                </p>
              </div>
              <button type="button" className="plan-link" onClick={() => setDeleteTarget(null)}>
                Close
              </button>
            </div>
            <div className="plan-actions">
              <button
                type="button"
                className="plan-button plan-button--secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button type="button" className="plan-button plan-button--danger" onClick={handleDelete}>
                Delete Plan
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const TenderModulePage = ({
  module,
  token,
  mode
}: {
  module: InternalModule;
  token?: string | null;
  mode: 'create' | 'publish';
}) => {
  const [filters, setFilters] = useState({ status: '', category: '', query: '' });
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [publishTarget, setPublishTarget] = useState<TenderSummary | null>(null);
  const [editTarget, setEditTarget] = useState<TenderSummary | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });

  const canManage = hasModuleAction(module, 'tender.manage');

  const [createForm, setCreateForm] = useState({
    title: '',
    category: '',
    status: 'Draft',
    appLineItemId: '',
    budgetCode: '',
    budget: '',
    description: '',
    specifications: '',
    eligibilityCriteria: '',
    evaluationCriteria: '',
    publishDate: '',
    openingDate: '',
    closingDate: ''
  });

  const [publishForm, setPublishForm] = useState({
    publishDate: '',
    openingDate: '',
    closingDate: ''
  });

  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    status: '',
    appLineItemId: '',
    budgetCode: '',
    budget: '',
    description: '',
    specifications: '',
    eligibilityCriteria: '',
    evaluationCriteria: '',
    publishDate: '',
    openingDate: '',
    closingDate: ''
  });

  const [appLineItems, setAppLineItems] = useState<BudgetLineItem[]>(budgetLineItems);
  const [appLoading, setAppLoading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [createBudgetSummary, setCreateBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [createBudgetLoading, setCreateBudgetLoading] = useState(false);
  const [createBudgetError, setCreateBudgetError] = useState<string | null>(null);
  const [editBudgetSummary, setEditBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [editBudgetLoading, setEditBudgetLoading] = useState(false);
  const [editBudgetError, setEditBudgetError] = useState<string | null>(null);

  const createAppItems = useMemo(() => {
    const category = createForm.category.trim().toLowerCase();
    if (!category) {
      return appLineItems;
    }
    const matches = appLineItems.filter((item) => item.procurementCategory.toLowerCase().includes(category));
    return matches.length ? matches : appLineItems;
  }, [createForm.category, appLineItems]);

  const editAppItems = useMemo(() => {
    const category = editForm.category.trim().toLowerCase();
    if (!category) {
      return appLineItems;
    }
    const matches = appLineItems.filter((item) => item.procurementCategory.toLowerCase().includes(category));
    return matches.length ? matches : appLineItems;
  }, [editForm.category, appLineItems]);

  const createAppItem = useMemo(
    () => appLineItems.find((item) => item.id === createForm.appLineItemId) ?? null,
    [createForm.appLineItemId, appLineItems]
  );

  const editAppItem = useMemo(
    () => appLineItems.find((item) => item.id === editForm.appLineItemId) ?? null,
    [editForm.appLineItemId, appLineItems]
  );

  const createBudgetCheck = useMemo(
    () =>
      getBudgetCheck(
        Number(createForm.budget) || 0,
        createForm.appLineItemId,
        createForm.budgetCode,
        createBudgetSummary,
        createAppItem
      ),
    [createForm.budget, createForm.appLineItemId, createForm.budgetCode, createBudgetSummary, createAppItem]
  );

  const editBudgetCheck = useMemo(
    () =>
      getBudgetCheck(
        Number(editForm.budget) || 0,
        editForm.appLineItemId,
        editForm.budgetCode,
        editBudgetSummary,
        editAppItem
      ),
    [editForm.budget, editForm.appLineItemId, editForm.budgetCode, editBudgetSummary, editAppItem]
  );

  const createBudgetTone =
    createBudgetCheck.status === 'sufficient'
      ? 'admin-status--good'
      : createBudgetCheck.status === 'insufficient'
        ? 'admin-status--alert'
        : 'admin-status--warn';

  const editBudgetTone =
    editBudgetCheck.status === 'sufficient'
      ? 'admin-status--good'
      : editBudgetCheck.status === 'insufficient'
        ? 'admin-status--alert'
        : 'admin-status--warn';

  useEffect(() => {
    if (!createAppItem) {
      return;
    }
    setCreateForm((prev) => {
      if (prev.budgetCode === createAppItem.budgetCode) {
        return prev;
      }
      return { ...prev, budgetCode: createAppItem.budgetCode };
    });
  }, [createAppItem]);

  useEffect(() => {
    if (!editAppItem) {
      return;
    }
    setEditForm((prev) => {
      if (prev.budgetCode === editAppItem.budgetCode) {
        return prev;
      }
      return { ...prev, budgetCode: editAppItem.budgetCode };
    });
  }, [editAppItem]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setAppLoading(true);
    setAppError(null);

    fetchProcurementPlans(token, {
      fiscalYear: new Date().getFullYear(),
      page: 1,
      pageSize: 50,
      sortBy: 'created_at',
      sortDir: 'desc'
    })
      .then(async (plans) => {
        if (!plans.Items.length) {
          setAppLineItems(budgetLineItems);
          return;
        }
        const itemsByPlan = await Promise.all(
          plans.Items.map((plan) => fetchProcurementPlanItems(token, plan.PlanId))
        );
        const mapped = plans.Items.flatMap((plan, index) =>
          itemsByPlan[index].map((item: ProcurementPlanItemDetail) => ({
            id: item.PlanItemId,
            title: item.Description,
            planRef: plan.PlanTitle,
            budgetCode: item.BudgetCode,
            department: plan.Department,
            fiscalYear: plan.FiscalYear,
            allocated: Number(item.EstimatedAmount) || 0,
            committed: 0,
            reserved: 0,
            procurementCategory: item.ProcurementType ?? 'Unspecified'
          }))
        );
        setAppLineItems(mapped.length ? mapped : budgetLineItems);
      })
      .catch((err) => {
        setAppError(err instanceof Error ? err.message : 'Unable to load APP line items.');
        setAppLineItems(budgetLineItems);
      })
      .finally(() => {
        setAppLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (editForm.appLineItemId || !editForm.budgetCode || !appLineItems.length) {
      return;
    }
    const match = appLineItems.find((item) => item.budgetCode === editForm.budgetCode);
    if (!match) {
      return;
    }
    setEditForm((prev) => ({ ...prev, appLineItemId: match.id }));
  }, [editForm.appLineItemId, editForm.budgetCode, appLineItems]);

  useEffect(() => {
    if (!token || !createAppItem || !createForm.budgetCode.trim()) {
      setCreateBudgetSummary(null);
      return;
    }
    setCreateBudgetLoading(true);
    setCreateBudgetError(null);
    fetchBudgetSummary(token, {
      budgetCode: createForm.budgetCode.trim(),
      department: createAppItem.department,
      fiscalYear: createAppItem.fiscalYear
    })
      .then((summary) => {
        setCreateBudgetSummary(summary);
      })
      .catch((err) => {
        setCreateBudgetError(err instanceof Error ? err.message : 'Unable to load budget summary.');
        setCreateBudgetSummary(null);
      })
      .finally(() => {
        setCreateBudgetLoading(false);
      });
  }, [token, createAppItem, createForm.budgetCode]);

  useEffect(() => {
    if (!token || !editAppItem || !editForm.budgetCode.trim()) {
      setEditBudgetSummary(null);
      return;
    }
    setEditBudgetLoading(true);
    setEditBudgetError(null);
    fetchBudgetSummary(token, {
      budgetCode: editForm.budgetCode.trim(),
      department: editAppItem.department,
      fiscalYear: editAppItem.fiscalYear
    })
      .then((summary) => {
        setEditBudgetSummary(summary);
      })
      .catch((err) => {
        setEditBudgetError(err instanceof Error ? err.message : 'Unable to load budget summary.');
        setEditBudgetSummary(null);
      })
      .finally(() => {
        setEditBudgetLoading(false);
      });
  }, [token, editAppItem, editForm.budgetCode]);

  const refreshTenders = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTenders(token, {
        status: filters.status || undefined,
        category: filters.category.trim() || undefined,
        query: filters.query.trim() || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir
      });

      setTenders(data.Items);
      setPagination((prev) => ({
        ...prev,
        page: data.Page,
        pageSize: data.PageSize,
        total: data.Total
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tenders.');
      setTenders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    filters.status,
    filters.category,
    filters.query,
    pagination.page,
    pagination.pageSize,
    sort.sortBy,
    sort.sortDir
  ]);

  const toIso = (value: string) => (value ? new Date(value).toISOString() : null);

  const handleCreate = async () => {
    if (!token || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      if (!createForm.appLineItemId) {
        setActionError('Select an APP line item to validate budget availability.');
        return;
      }
      if (!createForm.budgetCode.trim()) {
        setActionError('Budget code is required for tender creation.');
        return;
      }
      if (createAppItem && createForm.budgetCode.trim() !== createAppItem.budgetCode) {
        setActionError('Budget code does not match the selected APP line item.');
        return;
      }
      if (createBudgetCheck.status === 'unknown') {
        setActionError(createBudgetCheck.message);
        return;
      }
      if (createBudgetCheck.status === 'insufficient') {
        setActionError(`Budget availability shortfall of ${formatCurrency(createBudgetCheck.variance)}.`);
        return;
      }

      const payload: TenderCreateRequest = {
        Title: createForm.title.trim(),
        Description: createForm.description.trim(),
        Category: createForm.category.trim(),
        Status: createForm.status || null,
        Budget: createForm.budget ? Number(createForm.budget) : null,
        Department: createAppItem?.department ?? null,
        BudgetCode: createForm.budgetCode.trim() || null,
        FiscalYear: createAppItem?.fiscalYear ?? null,
        Specifications: createForm.specifications.trim() || null,
        EligibilityCriteria: createForm.eligibilityCriteria.trim() || null,
        EvaluationCriteria: createForm.evaluationCriteria.trim() || null,
        PublishDate: toIso(createForm.publishDate),
        OpeningDate: toIso(createForm.openingDate),
        ClosingDate: toIso(createForm.closingDate)
      };

      await createTender(token, payload);
      setCreateForm({
        title: '',
        category: '',
        status: 'Draft',
        appLineItemId: '',
        budgetCode: '',
        budget: '',
        description: '',
        specifications: '',
        eligibilityCriteria: '',
        evaluationCriteria: '',
        publishDate: '',
        openingDate: '',
        closingDate: ''
      });
      setShowCreateForm(false);
      await refreshTenders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create tender.');
    } finally {
      setIsSaving(false);
    }
  };

  const startPublish = (tender: TenderSummary) => {
    if (!canManage) {
      return;
    }
    setPublishTarget(tender);
    setPublishForm({
      publishDate: tender.PublishDate ? tender.PublishDate.slice(0, 16) : '',
      openingDate: tender.OpeningDate ? tender.OpeningDate.slice(0, 16) : '',
      closingDate: tender.ClosingDate ? tender.ClosingDate.slice(0, 16) : ''
    });
  };

  const handlePublish = async () => {
    if (!token || !publishTarget || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      const payload: TenderPublishRequest = {
        PublishDate: toIso(publishForm.publishDate),
        OpeningDate: toIso(publishForm.openingDate),
        ClosingDate: toIso(publishForm.closingDate)
      };

      await publishTender(token, publishTarget.TenderId, payload);
      setPublishTarget(null);
      await refreshTenders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to publish tender.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (tender: TenderSummary) => {
    if (!canManage) {
      return;
    }
    setEditTarget(tender);
    setActionError(null);
    setIsDetailLoading(true);

    fetchTenderDetail(token ?? '', tender.TenderId)
      .then((detail) => {
        setEditForm({
          title: detail.Title,
          category: detail.Category,
          status: detail.Status,
          appLineItemId: '',
          budgetCode: detail.BudgetCode ?? '',
          budget: detail.Budget !== null && detail.Budget !== undefined ? String(detail.Budget) : '',
          description: detail.Description ?? '',
          specifications: detail.Specifications ?? '',
          eligibilityCriteria: detail.EligibilityCriteria ?? '',
          evaluationCriteria: detail.EvaluationCriteria ?? '',
          publishDate: detail.PublishDate ? detail.PublishDate.slice(0, 16) : '',
          openingDate: detail.OpeningDate ? detail.OpeningDate.slice(0, 16) : '',
          closingDate: detail.ClosingDate ? detail.ClosingDate.slice(0, 16) : ''
        });
      })
      .catch((err) => {
        setActionError(err instanceof Error ? err.message : 'Unable to load tender details.');
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  };

  const handleUpdate = async () => {
    if (!token || !editTarget || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      if (!editForm.appLineItemId) {
        setActionError('Select an APP line item to validate budget availability.');
        return;
      }
      if (!editForm.budgetCode.trim()) {
        setActionError('Budget code is required for tender updates.');
        return;
      }
      if (editAppItem && editForm.budgetCode.trim() !== editAppItem.budgetCode) {
        setActionError('Budget code does not match the selected APP line item.');
        return;
      }
      if (editBudgetCheck.status === 'unknown') {
        setActionError(editBudgetCheck.message);
        return;
      }
      if (editBudgetCheck.status === 'insufficient') {
        setActionError(`Budget availability shortfall of ${formatCurrency(editBudgetCheck.variance)}.`);
        return;
      }

      const payload: TenderUpdateRequest = {
        Title: editForm.title.trim() || null,
        Description: editForm.description.trim() || null,
        Category: editForm.category.trim() || null,
        Status: editForm.status || null,
        Budget: editForm.budget ? Number(editForm.budget) : null,
        Department: editAppItem?.department ?? null,
        BudgetCode: editForm.budgetCode.trim() || null,
        FiscalYear: editAppItem?.fiscalYear ?? null,
        Specifications: editForm.specifications.trim() || null,
        EligibilityCriteria: editForm.eligibilityCriteria.trim() || null,
        EvaluationCriteria: editForm.evaluationCriteria.trim() || null,
        PublishDate: toIso(editForm.publishDate),
        OpeningDate: toIso(editForm.openingDate),
        ClosingDate: toIso(editForm.closingDate)
      };

      await updateTender(token, editTarget.TenderId, payload);
      setEditTarget(null);
      await refreshTenders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update tender.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const pageStart = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {!canManage ? (
        <div className="portal-alert">You have view-only access for tender management.</div>
      ) : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, status: event.target.value }));
              }}
            >
              <option value="">All statuses</option>
              {tenderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Category</span>
            <input
              className="plan-input"
              type="text"
              placeholder="Filter by category"
              value={filters.category}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, category: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              type="text"
              placeholder="Search title or description"
              value={filters.query}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, query: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Sort By</span>
            <select
              className="plan-select"
              value={sort.sortBy}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setSort((prev) => ({ ...prev, sortBy: event.target.value }));
              }}
            >
              <option value="created_at">Created Date</option>
              <option value="title">Title</option>
              <option value="category">Category</option>
              <option value="status">Status</option>
              <option value="budget">Budget</option>
              <option value="publish_date">Publish Date</option>
              <option value="closing_date">Closing Date</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Direction</span>
            <select
              className="plan-select"
              value={sort.sortDir}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setSort((prev) => ({ ...prev, sortDir: event.target.value }));
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Page Size</span>
            <select
              className="plan-select"
              value={String(pagination.pageSize)}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(event.target.value) }));
              }}
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="plan-actions">
            {mode === 'create' ? (
              <button
                type="button"
                className="plan-button"
                onClick={() => {
                  setActionError(null);
                  if (canManage) {
                    setShowCreateForm(true);
                  }
                }}
                disabled={!canManage}
              >
                Create Tender
              </button>
            ) : null}
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => {
                setFilters({ status: '', category: '', query: '' });
                setSort({ sortBy: 'created_at', sortDir: 'desc' });
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Clear
            </button>
            <button type="button" className="plan-button" onClick={refreshTenders} disabled={isLoading}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      <table className="plan-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Budget</th>
            <th>Closing Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tenders.map((tender) => (
            <tr key={tender.TenderId}>
              <td>{tender.Title}</td>
              <td>{tender.Category}</td>
              <td>
                <span className={`admin-status ${tenderStatusTone(tender.Status)}`}>{tender.Status}</span>
              </td>
              <td>{tender.Budget !== null && tender.Budget !== undefined ? formatCurrency(tender.Budget) : '—'}</td>
              <td>{tender.ClosingDate ? new Date(tender.ClosingDate).toLocaleDateString() : '—'}</td>
              <td>
                {canManage ? (
                  <>
                    {mode === 'publish' ? (
                      <button
                        type="button"
                        className="plan-link"
                        onClick={() => startPublish(tender)}
                        disabled={isSaving}
                      >
                        Publish
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="plan-link"
                      onClick={() => startEdit(tender)}
                      disabled={isSaving}
                    >
                      Update
                    </button>
                  </>
                ) : (
                  <span className="plan-muted">View</span>
                )}
              </td>
            </tr>
          ))}
          {!tenders.length && !isLoading ? (
            <tr>
              <td colSpan={6} className="plan-empty">
                No tenders match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="plan-pagination">
        <span>
          Showing {pageStart}–{pageEnd} of {pagination.total} tenders
        </span>
        <div className="plan-pagination__controls">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page <= 1 || isLoading}
          >
            Previous
          </button>
          <span className="plan-pagination__meta">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            disabled={pagination.page >= totalPages || isLoading}
          >
            Next
          </button>
        </div>
      </div>

      {isLoading ? <p>Loading tenders...</p> : null}

      {showCreateForm ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setShowCreateForm(false)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Create Tender</h3>
                <p>Define a new tender package for publication.</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setShowCreateForm(false)}>
                Close
              </button>
            </div>
            <div className="plan-form-grid">
              <label className="plan-field plan-field--span">
                <span>Title</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Category</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.category}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Status</span>
                <select
                  className="plan-select"
                  value={createForm.status}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {tenderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field plan-field--span">
                <span>APP Line Item</span>
                <select
                  className="plan-select"
                  value={createForm.appLineItemId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, appLineItemId: event.target.value }))}
                >
                  <option value="">Select APP line item</option>
                  {createAppItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.planRef})
                    </option>
                  ))}
                </select>
                {createAppItem ? (
                  <div className="budget-app-summary">
                    <div>
                      <span>Budget Code</span>
                      <strong>{createAppItem.budgetCode}</strong>
                    </div>
                    <div>
                      <span>Allocated</span>
                      <strong>{formatCurrency(createAppItem.allocated)}</strong>
                    </div>
                    <div>
                      <span>Department</span>
                      <strong>{createAppItem.department}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="plan-muted">Select a line item to align tender with the APP.</div>
                )}
                {appLoading ? <div className="plan-muted">Loading APP line items...</div> : null}
                {appError ? <div className="req-error">{appError}</div> : null}
              </label>
              <label className="plan-field">
                <span>Budget Code</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.budgetCode}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, budgetCode: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Budget (NGN)</span>
                <input
                  className="plan-input"
                  type="number"
                  min="0"
                  value={createForm.budget}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, budget: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Description</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Specifications</span>
                <textarea
                  className="plan-textarea"
                  rows={2}
                  value={createForm.specifications}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, specifications: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Eligibility Criteria</span>
                <textarea
                  className="plan-textarea"
                  rows={2}
                  value={createForm.eligibilityCriteria}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, eligibilityCriteria: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Evaluation Criteria</span>
                <textarea
                  className="plan-textarea"
                  rows={2}
                  value={createForm.evaluationCriteria}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, evaluationCriteria: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Publish Date</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={createForm.publishDate}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, publishDate: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Opening Date</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={createForm.openingDate}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, openingDate: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Closing Date</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={createForm.closingDate}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, closingDate: event.target.value }))}
                />
              </label>
            </div>
            <div className={`budget-check budget-check--${createBudgetCheck.status}`}>
              <div className="budget-check__header">
                <div>
                  <h4>Budget Availability</h4>
                  <p>{createBudgetCheck.message}</p>
                  {createBudgetLoading ? <span className="plan-muted">Refreshing budget summary...</span> : null}
                  {createBudgetError ? <span className="req-error">{createBudgetError}</span> : null}
                </div>
                <span className={`admin-status ${createBudgetTone}`}>
                  {createBudgetCheck.status === 'sufficient'
                    ? 'Sufficient'
                    : createBudgetCheck.status === 'insufficient'
                      ? 'Insufficient'
                      : 'Pending'}
                </span>
              </div>
              <div className="budget-check__grid">
                <div>
                  <span>Appropriated</span>
                  <strong>
                    {createBudgetCheck.item || createBudgetSummary
                      ? formatCurrency(createBudgetCheck.appropriated)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Released</span>
                  <strong>
                    {createBudgetCheck.item || createBudgetSummary
                      ? formatCurrency(createBudgetCheck.released)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Committed</span>
                  <strong>
                    {createBudgetCheck.item || createBudgetSummary
                      ? formatCurrency(createBudgetCheck.committed)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Spent</span>
                  <strong>
                    {createBudgetCheck.item || createBudgetSummary
                      ? formatCurrency(createBudgetCheck.spent)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Available</span>
                  <strong>
                    {createBudgetCheck.item || createBudgetSummary
                      ? formatCurrency(createBudgetCheck.available)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Requested</span>
                  <strong>{formatCurrency(createBudgetCheck.amount)}</strong>
                </div>
                <div>
                  <span>Variance</span>
                  <strong>
                    {createBudgetCheck.item || createBudgetSummary
                      ? formatCurrency(createBudgetCheck.variance)
                      : '—'}
                  </strong>
                </div>
              </div>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Create Tender'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}

      {publishTarget ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setPublishTarget(null)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Publish Tender</h3>
                <p>
                  Set publication dates for <strong>{publishTarget.Title}</strong>.
                </p>
              </div>
              <button type="button" className="plan-link" onClick={() => setPublishTarget(null)}>
                Close
              </button>
            </div>
            <div className="plan-form-grid">
              <label className="plan-field">
                <span>Publish Date</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={publishForm.publishDate}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, publishDate: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Opening Date</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={publishForm.openingDate}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, openingDate: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Closing Date</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={publishForm.closingDate}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, closingDate: event.target.value }))}
                />
              </label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handlePublish} disabled={isSaving}>
                {isSaving ? 'Publishing...' : 'Publish Tender'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setEditTarget(null)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Update Tender</h3>
                <p>
                  Edit tender details for <strong>{editTarget.Title}</strong>.
                </p>
              </div>
              <button type="button" className="plan-link" onClick={() => setEditTarget(null)}>
                Close
              </button>
            </div>
            {isDetailLoading ? <div className="plan-loading">Loading tender details...</div> : null}
            <fieldset className="plan-fieldset" disabled={isDetailLoading || isSaving}>
              <div className="plan-form-grid">
                <label className="plan-field plan-field--span">
                  <span>Title</span>
                  <input
                    className="plan-input"
                    type="text"
                    value={editForm.title}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Category</span>
                  <input
                    className="plan-input"
                    type="text"
                    value={editForm.category}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Status</span>
                  <select
                    className="plan-select"
                    value={editForm.status}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    {tenderStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="plan-field plan-field--span">
                  <span>APP Line Item</span>
                  <select
                    className="plan-select"
                    value={editForm.appLineItemId}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, appLineItemId: event.target.value }))}
                  >
                    <option value="">Select APP line item</option>
                    {editAppItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.planRef})
                      </option>
                    ))}
                  </select>
                {editAppItem ? (
                  <div className="budget-app-summary">
                    <div>
                      <span>Budget Code</span>
                      <strong>{editAppItem.budgetCode}</strong>
                      </div>
                      <div>
                        <span>Allocated</span>
                        <strong>{formatCurrency(editAppItem.allocated)}</strong>
                      </div>
                      <div>
                        <span>Department</span>
                        <strong>{editAppItem.department}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="plan-muted">Select a line item to align tender with the APP.</div>
                )}
                {appLoading ? <div className="plan-muted">Loading APP line items...</div> : null}
                {appError ? <div className="req-error">{appError}</div> : null}
              </label>
                <label className="plan-field">
                  <span>Budget Code</span>
                  <input
                    className="plan-input"
                    type="text"
                    value={editForm.budgetCode}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, budgetCode: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Budget (NGN)</span>
                  <input
                    className="plan-input"
                    type="number"
                    min="0"
                    value={editForm.budget}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, budget: event.target.value }))}
                  />
                </label>
                <label className="plan-field plan-field--span">
                  <span>Description</span>
                  <textarea
                    className="plan-textarea"
                    rows={3}
                    value={editForm.description}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>
                <label className="plan-field plan-field--span">
                  <span>Specifications</span>
                  <textarea
                    className="plan-textarea"
                    rows={2}
                    value={editForm.specifications}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, specifications: event.target.value }))}
                  />
                </label>
                <label className="plan-field plan-field--span">
                  <span>Eligibility Criteria</span>
                  <textarea
                    className="plan-textarea"
                    rows={2}
                    value={editForm.eligibilityCriteria}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, eligibilityCriteria: event.target.value }))}
                  />
                </label>
                <label className="plan-field plan-field--span">
                  <span>Evaluation Criteria</span>
                  <textarea
                    className="plan-textarea"
                    rows={2}
                    value={editForm.evaluationCriteria}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, evaluationCriteria: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Publish Date</span>
                  <input
                    className="plan-input"
                    type="datetime-local"
                    value={editForm.publishDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, publishDate: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Opening Date</span>
                  <input
                    className="plan-input"
                    type="datetime-local"
                    value={editForm.openingDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, openingDate: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Closing Date</span>
                  <input
                    className="plan-input"
                    type="datetime-local"
                    value={editForm.closingDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, closingDate: event.target.value }))}
                  />
                </label>
              </div>
            </fieldset>
            <div className={`budget-check budget-check--${editBudgetCheck.status}`}>
              <div className="budget-check__header">
                <div>
                  <h4>Budget Availability</h4>
                  <p>{editBudgetCheck.message}</p>
                  {editBudgetLoading ? <span className="plan-muted">Refreshing budget summary...</span> : null}
                  {editBudgetError ? <span className="req-error">{editBudgetError}</span> : null}
                </div>
                <span className={`admin-status ${editBudgetTone}`}>
                  {editBudgetCheck.status === 'sufficient'
                    ? 'Sufficient'
                    : editBudgetCheck.status === 'insufficient'
                      ? 'Insufficient'
                      : 'Pending'}
                </span>
              </div>
              <div className="budget-check__grid">
                <div>
                  <span>Appropriated</span>
                  <strong>
                    {editBudgetCheck.item || editBudgetSummary
                      ? formatCurrency(editBudgetCheck.appropriated)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Released</span>
                  <strong>
                    {editBudgetCheck.item || editBudgetSummary
                      ? formatCurrency(editBudgetCheck.released)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Committed</span>
                  <strong>
                    {editBudgetCheck.item || editBudgetSummary
                      ? formatCurrency(editBudgetCheck.committed)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Spent</span>
                  <strong>
                    {editBudgetCheck.item || editBudgetSummary ? formatCurrency(editBudgetCheck.spent) : '—'}
                  </strong>
                </div>
                <div>
                  <span>Available</span>
                  <strong>
                    {editBudgetCheck.item || editBudgetSummary
                      ? formatCurrency(editBudgetCheck.available)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Requested</span>
                  <strong>{formatCurrency(editBudgetCheck.amount)}</strong>
                </div>
                <div>
                  <span>Variance</span>
                  <strong>
                    {editBudgetCheck.item || editBudgetSummary
                      ? formatCurrency(editBudgetCheck.variance)
                      : '—'}
                  </strong>
                </div>
              </div>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Update Tender'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const BidOpeningModulePage = ({
  module,
  token
}: {
  module: InternalModule;
  token?: string | null;
}) => {
  const [filters, setFilters] = useState({
    status: '',
    tenderId: '',
    query: '',
    dateFrom: '',
    dateTo: ''
  });
  const [sessions, setSessions] = useState<BidOpeningSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTarget, setEditTarget] = useState<BidOpeningSessionSummary | null>(null);
  const [detailTarget, setDetailTarget] = useState<BidOpeningSessionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [sort, setSort] = useState({ sortBy: 'scheduled_at', sortDir: 'asc' });

  const canManage = hasModuleAction(module, 'bid_opening.manage');
  const isFinancialEvaluator = hasModuleAction(module, 'bid_opening.financial_view');
  const canReviewDetails = hasModuleAction(module, 'bid_opening.view_detail');

  const [createForm, setCreateForm] = useState({
    tenderId: '',
    sessionTitle: '',
    location: '',
    scheduledAt: '',
    status: 'Scheduled',
    openedAt: '',
    closedAt: '',
    notes: ''
  });

  const [editForm, setEditForm] = useState({
    sessionTitle: '',
    location: '',
    scheduledAt: '',
    status: '',
    openedAt: '',
    closedAt: '',
    notes: ''
  });

  const toIso = (value: string) => (value ? new Date(value).toISOString() : null);

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFinancialEvaluatorReadiness = (session?: BidOpeningSessionSummary | BidOpeningSessionDetail | null) => {
    if (!session) {
      return {
        label: 'Waiting for session',
        tone: '',
        note: 'Select a bid opening session to inspect its commercial opening record.'
      };
    }

    switch (session.Status) {
      case 'Closed':
        return {
          label: 'Commercial review ready',
          tone: 'admin-status--good',
          note: 'Opening timestamps are complete. Financial evaluation can proceed from the official opening record.'
        };
      case 'Open':
        return {
          label: 'Opening in progress',
          tone: 'admin-status--warn',
          note: 'Observe price disclosures and capture any commercial notes before the session is closed.'
        };
      case 'Cancelled':
        return {
          label: 'Session cancelled',
          tone: 'admin-status--alert',
          note: 'Do not rely on this session for commercial evaluation until procurement reschedules it.'
        };
      default:
        return {
          label: 'Prepare for opening',
          tone: '',
          note: 'Confirm the session window, location, and tender reference before commercial review starts.'
        };
    }
  };

  const getFinancialEvaluatorChecklist = (session?: BidOpeningSessionSummary | BidOpeningSessionDetail | null) => {
    const status = session?.Status ?? 'Scheduled';

    if (status === 'Closed') {
      return [
        'Confirm the opening and closing timestamps are populated.',
        'Use the official opening record as the commercial baseline.',
        'Flag missing price schedules or irregular commercial disclosures.'
      ];
    }

    if (status === 'Open') {
      return [
        'Observe announced prices, discounts, and key commercial declarations.',
        'Watch for missing commercial forms before the session is closed.',
        'Do not start comparative pricing until the opening record is finalized.'
      ];
    }

    if (status === 'Cancelled') {
      return [
        'Check procurement notes for the cancellation reason.',
        'Avoid using any draft opening information for financial scoring.',
        'Wait for the replacement session before continuing commercial review.'
      ];
    }

    return [
      'Confirm your attendance window and tender reference.',
      'Prepare the commercial evaluation worksheet ahead of the opening.',
      'Check the location and scheduled time against the session notice.'
    ];
  };

  const evaluatorSummary = useMemo(() => {
    const scheduled = sessions.filter((session) => session.Status === 'Scheduled').length;
    const open = sessions.filter((session) => session.Status === 'Open').length;
    const closed = sessions.filter((session) => session.Status === 'Closed').length;
    const nextSession = [...sessions]
      .filter((session) => session.Status !== 'Cancelled')
      .sort((left, right) => new Date(left.ScheduledAt).getTime() - new Date(right.ScheduledAt).getTime())[0];

    return { scheduled, open, closed, nextSession };
  }, [sessions]);

  const refreshSessions = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBidOpeningSessions(token, {
        status: filters.status || undefined,
        tenderId: filters.tenderId.trim() || undefined,
        query: filters.query.trim() || undefined,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir
      });

      setSessions(data.Items);
      setPagination((prev) => ({
        ...prev,
        page: data.Page,
        pageSize: data.PageSize,
        total: data.Total
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bid opening sessions.');
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    filters.status,
    filters.tenderId,
    filters.query,
    filters.dateFrom,
    filters.dateTo,
    pagination.page,
    pagination.pageSize,
    sort.sortBy,
    sort.sortDir
  ]);

  const handleCreate = async () => {
    if (!token || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      if (!createForm.tenderId.trim()) {
        setActionError('Tender ID is required.');
        return;
      }

      if (createForm.sessionTitle.trim().length < 5) {
        setActionError('Session title must be at least 5 characters.');
        return;
      }

      if (!createForm.scheduledAt) {
        setActionError('Scheduled date/time is required.');
        return;
      }

      const payload: BidOpeningSessionCreateRequest = {
        TenderId: createForm.tenderId.trim(),
        SessionTitle: createForm.sessionTitle.trim(),
        Location: createForm.location.trim() || null,
        ScheduledAt: new Date(createForm.scheduledAt).toISOString(),
        Status: createForm.status || null,
        OpenedAt: toIso(createForm.openedAt),
        ClosedAt: toIso(createForm.closedAt),
        Notes: createForm.notes.trim() || null
      };

      await createBidOpeningSession(token, payload);
      setCreateForm({
        tenderId: '',
        sessionTitle: '',
        location: '',
        scheduledAt: '',
        status: 'Scheduled',
        openedAt: '',
        closedAt: '',
        notes: ''
      });
      setShowCreateForm(false);
      await refreshSessions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create bid opening session.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (session: BidOpeningSessionSummary) => {
    if (!canManage) {
      return;
    }
    setEditTarget(session);
    setActionError(null);
    setIsDetailLoading(true);

    fetchBidOpeningSessionDetail(token ?? '', session.SessionId)
      .then((detail) => {
        setEditForm({
          sessionTitle: detail.SessionTitle,
          location: detail.Location ?? '',
          scheduledAt: detail.ScheduledAt ? detail.ScheduledAt.slice(0, 16) : '',
          status: detail.Status,
          openedAt: detail.OpenedAt ? detail.OpenedAt.slice(0, 16) : '',
          closedAt: detail.ClosedAt ? detail.ClosedAt.slice(0, 16) : '',
          notes: detail.Notes ?? ''
        });
      })
      .catch((err) => {
        setActionError(err instanceof Error ? err.message : 'Unable to load session details.');
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  };

  const openDetail = async (session: BidOpeningSessionSummary) => {
    if (!token || !canReviewDetails) {
      return;
    }

    setDetailOpen(true);
    setDetailTarget(null);
    setDetailError(null);
    setIsDetailLoading(true);
    try {
      const detail = await fetchBidOpeningSessionDetail(token, session.SessionId);
      setDetailTarget(detail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load session details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailTarget(null);
    setDetailError(null);
  };

  const handleUpdate = async () => {
    if (!token || !editTarget || !canManage) {
      return;
    }

    setActionError(null);
    setIsSaving(true);
    try {
      const payload: BidOpeningSessionUpdateRequest = {
        SessionTitle: editForm.sessionTitle.trim() || null,
        Location: editForm.location.trim() || null,
        ScheduledAt: editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : null,
        Status: editForm.status || null,
        OpenedAt: toIso(editForm.openedAt),
        ClosedAt: toIso(editForm.closedAt),
        Notes: editForm.notes.trim() || null
      };

      await updateBidOpeningSession(token, editTarget.SessionId, payload);
      setEditTarget(null);
      await refreshSessions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update bid opening session.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const pageStart = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {isFinancialEvaluator ? (
        <div className="portal-module-grid">
          <article className="portal-module-card">
            <h3>Financial Evaluator Focus</h3>
            <p>Use this workspace to confirm opening timelines, inspect commercial opening notes, and identify sessions ready for pricing review.</p>
          </article>
          <article className="portal-module-card">
            <h3>Session Mix</h3>
            <p>
              Scheduled: <strong>{evaluatorSummary.scheduled}</strong> | Open: <strong>{evaluatorSummary.open}</strong> |
              Closed: <strong>{evaluatorSummary.closed}</strong>
            </p>
          </article>
          <article className="portal-module-card">
            <h3>Next Session</h3>
            <p>
              {evaluatorSummary.nextSession
                ? `${evaluatorSummary.nextSession.SessionTitle} on ${formatDateTime(evaluatorSummary.nextSession.ScheduledAt)}`
                : 'No active bid opening session is currently scheduled.'}
            </p>
          </article>
        </div>
      ) : null}
      {!canManage ? (
        <div className="portal-alert">You have view-only access for bid opening sessions.</div>
      ) : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, status: event.target.value }));
              }}
            >
              <option value="">All statuses</option>
              {bidOpeningStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Tender ID</span>
            <input
              className="plan-input"
              type="text"
              placeholder="Filter by tender ID"
              value={filters.tenderId}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, tenderId: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              type="text"
              placeholder="Search title or location"
              value={filters.query}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, query: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Date From</span>
            <input
              className="plan-input"
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, dateFrom: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Date To</span>
            <input
              className="plan-input"
              type="datetime-local"
              value={filters.dateTo}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, dateTo: event.target.value }));
              }}
            />
          </label>
          <label className="plan-field">
            <span>Sort By</span>
            <select
              className="plan-select"
              value={sort.sortBy}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setSort((prev) => ({ ...prev, sortBy: event.target.value }));
              }}
            >
              <option value="scheduled_at">Scheduled Date</option>
              <option value="session_title">Session Title</option>
              <option value="location">Location</option>
              <option value="status">Status</option>
              <option value="created_at">Created Date</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Direction</span>
            <select
              className="plan-select"
              value={sort.sortDir}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setSort((prev) => ({ ...prev, sortDir: event.target.value }));
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Page Size</span>
            <select
              className="plan-select"
              value={String(pagination.pageSize)}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(event.target.value) }));
              }}
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="plan-actions">
            <button
              type="button"
              className="plan-button"
              onClick={() => {
                setActionError(null);
                if (canManage) {
                  setShowCreateForm((prev) => !prev);
                }
              }}
              disabled={!canManage}
            >
              {showCreateForm ? 'Close Form' : 'Create Session'}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}

      {isLoading ? <div className="plan-muted">Loading sessions...</div> : null}

      {!isLoading ? (
        <table className="plan-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Tender</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="plan-empty">
                  No bid opening sessions found.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.SessionId}>
                  <td>
                    <strong>{session.SessionTitle}</strong>
                    <div className="plan-muted">{session.SessionId.slice(0, 8)}...</div>
                  </td>
                  <td>
                    <div>{session.TenderId.slice(0, 8)}...</div>
                  </td>
                  <td>
                    <div>{formatDateTime(session.ScheduledAt)}</div>
                    <div className="plan-muted">
                      Opened: {formatDateTime(session.OpenedAt)} | Closed: {formatDateTime(session.ClosedAt)}
                    </div>
                  </td>
                  <td>
                    <span className={`admin-status ${bidOpeningStatusTone(session.Status)}`}>{session.Status}</span>
                  </td>
                  <td>{session.Location || '—'}</td>
                  <td>
                    <div className="plan-actions">
                      {canReviewDetails ? (
                        <button type="button" className="plan-link" onClick={() => openDetail(session)}>
                          View
                        </button>
                      ) : (
                        <span className="plan-muted">View only</span>
                      )}
                      {canManage ? (
                        <button type="button" className="plan-link" onClick={() => startEdit(session)}>
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      <div className="plan-pagination">
        <div>
          Showing <span className="plan-pagination__meta">{pageStart}</span> to{' '}
          <span className="plan-pagination__meta">{pageEnd}</span> of{' '}
          <span className="plan-pagination__meta">{pagination.total}</span> sessions
        </div>
        <div className="plan-pagination__controls">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {totalPages}
          </span>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            disabled={pagination.page >= totalPages}
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
          >
            Next
          </button>
        </div>
      </div>

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detailTarget?.SessionTitle ?? 'Bid Opening Session'}</h3>
                <p>{detailTarget ? `Tender ${detailTarget.TenderId}` : 'Loading session detail.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDetail}>
                Close
              </button>
            </div>
            {isDetailLoading ? <div className="plan-loading">Loading session details...</div> : null}
            {detailError ? <div className="portal-alert">{detailError}</div> : null}
            {detailTarget ? (
              <>
                <div className="requisition-detail-grid">
                  <div className="requisition-card">
                    <h4>Session Status</h4>
                    <p>
                      <span className={`admin-status ${bidOpeningStatusTone(detailTarget.Status)}`}>{detailTarget.Status}</span>
                    </p>
                    <p className="plan-muted">Session ID: {detailTarget.SessionId}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Location</h4>
                    <p>{detailTarget.Location || 'No location recorded.'}</p>
                    <p className="plan-muted">Tender reference: {detailTarget.TenderId}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Timeline</h4>
                    <p>Scheduled: {formatDateTime(detailTarget.ScheduledAt)}</p>
                    <p>Opened: {formatDateTime(detailTarget.OpenedAt)}</p>
                    <p>Closed: {formatDateTime(detailTarget.ClosedAt)}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Record Freshness</h4>
                    <p>Created: {formatDateTime(detailTarget.CreatedAt)}</p>
                    <p>Updated: {formatDateTime(detailTarget.UpdatedAt)}</p>
                  </div>
                </div>
                {isFinancialEvaluator ? (
                  <div className="portal-module-grid">
                    <article className="portal-module-card">
                      <h3>Commercial Readiness</h3>
                      <p>
                        <span className={`admin-status ${getFinancialEvaluatorReadiness(detailTarget).tone}`}>
                          {getFinancialEvaluatorReadiness(detailTarget).label}
                        </span>
                      </p>
                      <p>{getFinancialEvaluatorReadiness(detailTarget).note}</p>
                    </article>
                    <article className="portal-module-card admin-card--wide">
                      <h3>Financial Evaluator Checklist</h3>
                      <ul className="requisition-list">
                        {getFinancialEvaluatorChecklist(detailTarget).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  </div>
                ) : null}
                <div className="requisition-detail-note">
                  <h4>Session Notes</h4>
                  <p>{detailTarget.Notes?.trim() ? detailTarget.Notes : 'No additional notes recorded for this session.'}</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCreateForm ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setShowCreateForm(false)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Create Bid Opening Session</h3>
                <p>Register committee session details for bid opening.</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setShowCreateForm(false)}>
                Close
              </button>
            </div>
            <div className="plan-form-grid">
              <label className="plan-field plan-field--span">
                <span>Session Title</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.sessionTitle}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, sessionTitle: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Tender ID</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.tenderId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tenderId: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Status</span>
                <select
                  className="plan-select"
                  value={createForm.status}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {bidOpeningStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Location</span>
                <input
                  className="plan-input"
                  type="text"
                  value={createForm.location}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Scheduled At</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={createForm.scheduledAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Opened At</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={createForm.openedAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, openedAt: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Closed At</span>
                <input
                  className="plan-input"
                  type="datetime-local"
                  value={createForm.closedAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, closedAt: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Notes</span>
                <textarea
                  className="plan-textarea"
                  rows={3}
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Create Session'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setEditTarget(null)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Update Bid Opening Session</h3>
                <p>
                  Edit session details for <strong>{editTarget.SessionTitle}</strong>.
                </p>
              </div>
              <button type="button" className="plan-link" onClick={() => setEditTarget(null)}>
                Close
              </button>
            </div>
            {isDetailLoading ? <div className="plan-loading">Loading session details...</div> : null}
            <fieldset className="plan-fieldset" disabled={isDetailLoading || isSaving}>
              <div className="plan-form-grid">
                <label className="plan-field plan-field--span">
                  <span>Session Title</span>
                  <input
                    className="plan-input"
                    type="text"
                    value={editForm.sessionTitle}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, sessionTitle: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Status</span>
                  <select
                    className="plan-select"
                    value={editForm.status}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    {bidOpeningStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="plan-field">
                  <span>Location</span>
                  <input
                    className="plan-input"
                    type="text"
                    value={editForm.location}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Scheduled At</span>
                  <input
                    className="plan-input"
                    type="datetime-local"
                    value={editForm.scheduledAt}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Opened At</span>
                  <input
                    className="plan-input"
                    type="datetime-local"
                    value={editForm.openedAt}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, openedAt: event.target.value }))}
                  />
                </label>
                <label className="plan-field">
                  <span>Closed At</span>
                  <input
                    className="plan-input"
                    type="datetime-local"
                    value={editForm.closedAt}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, closedAt: event.target.value }))}
                  />
                </label>
                <label className="plan-field plan-field--span">
                  <span>Notes</span>
                  <textarea
                    className="plan-textarea"
                    rows={3}
                    value={editForm.notes}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
              </div>
            </fieldset>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Update Session'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const BppEscalationModulePage = ({
  module,
  token,
  userEmail
}: {
  module: InternalModule;
  token?: string | null;
  userEmail?: string | null;
}) => {
  const [filters, setFilters] = useState({ status: '', requisitionId: '', tenderId: '' });
  const [records, setRecords] = useState<BppNoObjectionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<BppNoObjectionDetail | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const canCreate = hasModuleAction(module, 'bpp.create');
  const canReview = hasModuleAction(module, 'bpp.review');

  const [createForm, setCreateForm] = useState({
    requisitionId: '',
    tenderId: '',
    amount: '',
    procurementType: '',
    status: 'Submitted',
    referenceCode: '',
    requestedBy: userEmail ?? ''
  });

  const [reviewForm, setReviewForm] = useState({
    status: 'In Review',
    decisionBy: userEmail ?? '',
    decisionAt: '',
    decisionNotes: '',
    referenceCode: ''
  });

  const refreshRecords = async () => {
    if (!token) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBppNoObjections(token, {
        status: filters.status || undefined,
        requisitionId: filters.requisitionId.trim() || undefined,
        tenderId: filters.tenderId.trim() || undefined
      });
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load BPP no-objection records.');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status, filters.requisitionId, filters.tenderId]);

  const summary = useMemo(() => {
    const submitted = records.filter((item) => item.Status === 'Submitted').length;
    const inReview = records.filter((item) => item.Status === 'In Review').length;
    const approved = records.filter((item) => item.Status === 'Approved').length;
    const rejected = records.filter((item) => item.Status === 'Rejected').length;
    return { submitted, inReview, approved, rejected };
  }, [records]);

  const openDetail = async (recordId: string) => {
    if (!token) {
      return;
    }

    setDetailOpen(true);
    setDetail(null);
    setActionError(null);
    setDetailLoading(true);
    try {
      const data = await fetchBppNoObjectionDetail(token, recordId);
      setDetail(data);
      setReviewForm({
        status: data.Status === 'Submitted' ? 'In Review' : data.Status,
        decisionBy: data.DecisionBy ?? userEmail ?? '',
        decisionAt: data.DecisionAt ? data.DecisionAt.slice(0, 16) : '',
        decisionNotes: data.DecisionNotes ?? '',
        referenceCode: data.ReferenceCode ?? ''
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load BPP record detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setActionError(null);
  };

  const handleCreate = async () => {
    if (!token || !canCreate) {
      return;
    }

    const amount = Number(createForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Amount must be greater than 0.');
      return;
    }

    if (!createForm.requisitionId.trim() && !createForm.tenderId.trim()) {
      setActionError('Provide either a requisition ID or a tender ID.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      const payload: BppNoObjectionCreateRequest = {
        RequisitionId: createForm.requisitionId.trim() || undefined,
        TenderId: createForm.tenderId.trim() || undefined,
        Amount: amount,
        ProcurementType: createForm.procurementType.trim() || undefined,
        Status: createForm.status || undefined,
        RequestedBy: createForm.requestedBy.trim() || undefined,
        RequestedAt: new Date().toISOString(),
        ReferenceCode: createForm.referenceCode.trim() || undefined
      };

      await createBppNoObjection(token, payload);
      setCreateForm({
        requisitionId: '',
        tenderId: '',
        amount: '',
        procurementType: '',
        status: 'Submitted',
        referenceCode: '',
        requestedBy: userEmail ?? ''
      });
      setShowCreateForm(false);
      await refreshRecords();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create BPP no-objection request.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async () => {
    if (!token || !detail || !canReview) {
      return;
    }

    if ((reviewForm.status === 'Approved' || reviewForm.status === 'Rejected' || reviewForm.status === 'Cancelled') && !reviewForm.decisionNotes.trim()) {
      setActionError('Decision notes are required for a final BPP outcome.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      const payload: BppNoObjectionUpdateRequest = {
        Status: reviewForm.status,
        DecisionBy: reviewForm.decisionBy.trim() || undefined,
        DecisionAt: reviewForm.decisionAt ? new Date(reviewForm.decisionAt).toISOString() : new Date().toISOString(),
        DecisionNotes: reviewForm.decisionNotes.trim() || undefined,
        ReferenceCode: reviewForm.referenceCode.trim() || undefined
      };

      const updated = await updateBppNoObjection(token, detail.NoObjectionId, payload);
      setDetail(updated);
      await refreshRecords();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update BPP review record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Submitted</h3>
          <p>{summary.submitted} requests awaiting BPP intake.</p>
        </article>
        <article className="portal-module-card">
          <h3>In Review</h3>
          <p>{summary.inReview} requests currently under no-objection review.</p>
        </article>
        <article className="portal-module-card">
          <h3>Resolved</h3>
          <p>{summary.approved} approved and {summary.rejected} rejected or stopped.</p>
        </article>
      </div>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {bppNoObjectionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Requisition ID</span>
            <input
              className="plan-input"
              value={filters.requisitionId}
              onChange={(event) => setFilters((prev) => ({ ...prev, requisitionId: event.target.value }))}
              placeholder="Filter by requisition"
            />
          </label>
          <label className="plan-field">
            <span>Tender ID</span>
            <input
              className="plan-input"
              value={filters.tenderId}
              onChange={(event) => setFilters((prev) => ({ ...prev, tenderId: event.target.value }))}
              placeholder="Filter by tender"
            />
          </label>
          <div className="plan-actions">
            <button
              type="button"
              className="plan-button"
              disabled={!canCreate}
              onClick={() => {
                setActionError(null);
                if (canCreate) {
                  setShowCreateForm((prev) => !prev);
                }
              }}
            >
              {showCreateForm ? 'Close Form' : 'Raise BPP Request'}
            </button>
          </div>
        </div>
      </div>

      {!canCreate && !canReview ? (
        <div className="portal-alert">Your role can view BPP records but cannot initiate or decide them.</div>
      ) : null}

      {error ? <div className="portal-alert">{error}</div> : null}
      {isLoading ? <div className="plan-muted">Loading BPP records...</div> : null}

      {!isLoading ? (
        <table className="plan-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Source</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="plan-empty">
                  No BPP no-objection records found.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.NoObjectionId}>
                  <td>
                    <strong>{record.ReferenceCode || `BPP-${record.NoObjectionId.slice(0, 8)}`}</strong>
                    <div className="plan-muted">{record.ProcurementType || 'Unspecified type'}</div>
                  </td>
                  <td>
                    <div>{record.RequisitionId ? `Req: ${record.RequisitionId.slice(0, 8)}...` : '—'}</div>
                    <div className="plan-muted">{record.TenderId ? `Tender: ${record.TenderId.slice(0, 8)}...` : 'No tender linked'}</div>
                  </td>
                  <td>{formatCurrency(record.Amount)}</td>
                  <td>
                    <span className={`admin-status ${bppNoObjectionStatusTone(record.Status)}`}>{record.Status}</span>
                  </td>
                  <td>
                    <div>{record.RequestedBy || 'System'}</div>
                    <div className="plan-muted">{formatDateTimeShort(record.RequestedAt)}</div>
                  </td>
                  <td>
                    <button type="button" className="plan-link" onClick={() => openDetail(record.NoObjectionId)}>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      {showCreateForm ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setShowCreateForm(false)} />
          <div className="plan-modal__content">
            <div className="plan-form__header">
              <div>
                <h3>Raise BPP No-Objection Request</h3>
                <p>Prepare or coordinate an escalation record for procurement requiring BPP review.</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setShowCreateForm(false)}>
                Close
              </button>
            </div>
            <div className="plan-form-grid">
              <label className="plan-field">
                <span>Requisition ID</span>
                <input
                  className="plan-input"
                  value={createForm.requisitionId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, requisitionId: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Tender ID</span>
                <input
                  className="plan-input"
                  value={createForm.tenderId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tenderId: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Amount</span>
                <input
                  className="plan-input"
                  type="number"
                  min={0}
                  value={createForm.amount}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: event.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Procurement Type</span>
                <input
                  className="plan-input"
                  value={createForm.procurementType}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, procurementType: event.target.value }))}
                  placeholder="Goods, Works, Services"
                />
              </label>
              <label className="plan-field">
                <span>Status</span>
                <select
                  className="plan-select"
                  value={createForm.status}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {['Draft', 'Submitted'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Requested By</span>
                <input
                  className="plan-input"
                  value={createForm.requestedBy}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, requestedBy: event.target.value }))}
                />
              </label>
              <label className="plan-field plan-field--span">
                <span>Reference Code</span>
                <input
                  className="plan-input"
                  value={createForm.referenceCode}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, referenceCode: event.target.value }))}
                  placeholder="e.g. BPP-REQ-2026-0041"
                />
              </label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Create BPP Request'}
              </button>
            </div>
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail?.ReferenceCode || 'BPP Review Record'}</h3>
                <p>{detail ? `Request ${detail.NoObjectionId}` : 'Loading review record.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDetail}>
                Close
              </button>
            </div>
            {detailLoading ? <div className="plan-loading">Loading BPP record...</div> : null}
            {detail ? (
              <>
                <div className="requisition-detail-grid">
                  <div className="requisition-card">
                    <h4>Status</h4>
                    <p>
                      <span className={`admin-status ${bppNoObjectionStatusTone(detail.Status)}`}>{detail.Status}</span>
                    </p>
                    <p className="plan-muted">{detail.ProcurementType || 'Procurement type not specified'}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Amount</h4>
                    <p>{formatCurrency(detail.Amount)}</p>
                    <p className="plan-muted">Requested {formatDateTimeShort(detail.RequestedAt)}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Source Link</h4>
                    <p>{detail.RequisitionId ? `Requisition ${detail.RequisitionId}` : 'No requisition linked'}</p>
                    <p>{detail.TenderId ? `Tender ${detail.TenderId}` : 'No tender linked'}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Decision Trail</h4>
                    <p>{detail.DecisionBy || 'No BPP decision officer recorded yet.'}</p>
                    <p className="plan-muted">{formatDateTimeShort(detail.DecisionAt)}</p>
                  </div>
                </div>
                <div className="requisition-detail-note">
                  <h4>Decision Notes</h4>
                  <p>{detail.DecisionNotes?.trim() ? detail.DecisionNotes : 'No decision notes captured yet.'}</p>
                </div>
                {canReview ? (
                  <div className="plan-form plan-form--edit">
                    <div className="plan-form__header">
                      <div>
                        <h3>BPP Reviewer Decision</h3>
                        <p>Record no-objection outcomes, decision notes, and regulatory remarks.</p>
                      </div>
                    </div>
                    <div className="plan-form-grid">
                      <label className="plan-field">
                        <span>Status</span>
                        <select
                          className="plan-select"
                          value={reviewForm.status}
                          onChange={(event) => setReviewForm((prev) => ({ ...prev, status: event.target.value }))}
                        >
                          {['In Review', 'Approved', 'Rejected', 'Cancelled'].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="plan-field">
                        <span>Decision By</span>
                        <input
                          className="plan-input"
                          value={reviewForm.decisionBy}
                          onChange={(event) => setReviewForm((prev) => ({ ...prev, decisionBy: event.target.value }))}
                        />
                      </label>
                      <label className="plan-field">
                        <span>Decision At</span>
                        <input
                          className="plan-input"
                          type="datetime-local"
                          value={reviewForm.decisionAt}
                          onChange={(event) => setReviewForm((prev) => ({ ...prev, decisionAt: event.target.value }))}
                        />
                      </label>
                      <label className="plan-field">
                        <span>Reference Code</span>
                        <input
                          className="plan-input"
                          value={reviewForm.referenceCode}
                          onChange={(event) => setReviewForm((prev) => ({ ...prev, referenceCode: event.target.value }))}
                        />
                      </label>
                      <label className="plan-field plan-field--span">
                        <span>Decision Notes</span>
                        <textarea
                          className="plan-textarea"
                          rows={4}
                          value={reviewForm.decisionNotes}
                          onChange={(event) => setReviewForm((prev) => ({ ...prev, decisionNotes: event.target.value }))}
                          placeholder="Record review observations, completeness gaps, or no-objection decision."
                        />
                      </label>
                    </div>
                    <div className="plan-actions">
                      <button type="button" className="plan-button" onClick={handleReview} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Update BPP Review'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            {actionError ? <div className="portal-alert">{actionError}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const AuditDashboardModulePage = ({ module }: { module: InternalModule }) => {
  const summary = useMemo(() => {
    const total = budgetAuditEvents.length;
    const holds = budgetAuditEvents.filter((event) => event.action === 'Hold').length;
    const releases = budgetAuditEvents.filter((event) => event.action === 'Release').length;
    const overrides = budgetAuditEvents.filter((event) => event.action === 'Override').length;
    const bpp = budgetAuditEvents.filter((event) => event.action === 'BPP No Objection').length;
    const escalations = budgetAuditEvents.filter((event) => event.status === 'Escalated').length;
    return { total, holds, releases, overrides, bpp, escalations };
  }, []);

  const recentEvents = useMemo(() => {
    return [...budgetAuditEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, []);

  const escalationEvents = useMemo(() => {
    return budgetAuditEvents.filter(
      (event) =>
        event.status === 'Escalated' ||
        (event.action === 'Override' && event.status !== 'Completed') ||
        (event.action === 'BPP No Objection' && event.status !== 'Completed')
    );
  }, []);

  return (
    <section className="portal-module audit-dashboard">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Total Events</h3>
          <p>{summary.total} budget controls logged</p>
        </article>
        <article className="portal-module-card">
          <h3>Holds & Releases</h3>
          <p>
            {summary.holds} holds · {summary.releases} releases
          </p>
        </article>
        <article className="portal-module-card">
          <h3>Overrides & BPP</h3>
          <p>
            {summary.overrides} overrides · {summary.bpp} BPP actions
          </p>
        </article>
      </div>

      {summary.escalations ? (
        <div className="portal-alert" style={{ marginTop: '16px' }}>
          {summary.escalations} escalations require immediate audit attention.
        </div>
      ) : null}

      <div className="admin-grid" style={{ marginTop: '16px' }}>
        <article className="admin-card admin-card--wide">
          <h3>Recent Budget Events</h3>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Budget Code</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTimeShort(event.timestamp)}</td>
                  <td>{event.action}</td>
                  <td>{event.budgetCode}</td>
                  <td>{formatCurrency(event.amount)}</td>
                  <td>
                    <span className={`admin-status ${budgetAuditStatusTone(event.status)}`}>{event.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="admin-card admin-card--mid">
          <h3>Escalations Queue</h3>
          <ul className="admin-list">
            {escalationEvents.length ? (
              escalationEvents.map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{event.action}</strong>
                    <span>{event.reference}</span>
                  </div>
                  <span className={`admin-status ${budgetAuditStatusTone(event.status)}`}>{event.status}</span>
                </li>
              ))
            ) : (
              <li>
                <div>
                  <strong>No escalations</strong>
                  <span>All budget controls are resolved.</span>
                </div>
                <span className="admin-status admin-status--good">Clear</span>
              </li>
            )}
          </ul>
        </article>
      </div>
    </section>
  );
};

const AuditTrailModulePage = ({ module }: { module: InternalModule }) => {
  const [filters, setFilters] = useState({
    action: '',
    status: '',
    query: '',
    dateFrom: '',
    dateTo: ''
  });

  const filteredEvents = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return budgetAuditEvents
      .filter((event) => (filters.action ? event.action === filters.action : true))
      .filter((event) => (filters.status ? event.status === filters.status : true))
      .filter((event) => {
        if (!filters.dateFrom && !filters.dateTo) {
          return true;
        }
        const eventDate = new Date(event.timestamp).getTime();
        if (filters.dateFrom) {
          const from = new Date(filters.dateFrom).getTime();
          if (eventDate < from) {
            return false;
          }
        }
        if (filters.dateTo) {
          const to = new Date(filters.dateTo).getTime();
          if (eventDate > to) {
            return false;
          }
        }
        return true;
      })
      .filter((event) => {
        if (!query) {
          return true;
        }
        return (
          event.budgetCode.toLowerCase().includes(query) ||
          event.appLineItemId.toLowerCase().includes(query) ||
          event.actor.toLowerCase().includes(query) ||
          event.reference.toLowerCase().includes(query) ||
          event.notes.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [filters]);

  const handleExport = () => {
    const headers = [
      'Timestamp',
      'Action',
      'Status',
      'Budget Code',
      'APP Line Item',
      'Amount',
      'Actor',
      'Reference',
      'Notes'
    ];
    const rows = filteredEvents.map((event) => [
      formatDateTimeShort(event.timestamp),
      event.action,
      event.status,
      event.budgetCode,
      event.appLineItemId,
      formatCurrency(event.amount),
      event.actor,
      event.reference,
      event.notes
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `budget-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="portal-module audit-trail">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Action</span>
            <select
              className="plan-select"
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
            >
              <option value="">All actions</option>
              {Array.from(new Set(budgetAuditEvents.map((event) => event.action))).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {Array.from(new Set(budgetAuditEvents.map((event) => event.status))).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Budget code, APP, reference"
            />
          </label>
          <label className="plan-field">
            <span>Date From</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </label>
          <label className="plan-field">
            <span>Date To</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" onClick={handleExport}>
              Export CSV
            </button>
            <button
              type="button"
              className="plan-button"
              onClick={() => setFilters({ action: '', status: '', query: '', dateFrom: '', dateTo: '' })}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Status</th>
            <th>Budget Code</th>
            <th>APP Line</th>
            <th>Amount</th>
            <th>Actor</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {filteredEvents.map((event) => (
            <tr key={event.id}>
              <td>{formatDateTimeShort(event.timestamp)}</td>
              <td>{event.action}</td>
              <td>
                <span className={`admin-status ${budgetAuditStatusTone(event.status)}`}>{event.status}</span>
              </td>
              <td>{event.budgetCode}</td>
              <td>{event.appLineItemId}</td>
              <td>{formatCurrency(event.amount)}</td>
              <td>{event.actor}</td>
              <td>{event.reference}</td>
            </tr>
          ))}
          {!filteredEvents.length ? (
            <tr>
              <td colSpan={8} className="plan-empty">
                No audit events match the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
};

const ComplianceReportsModulePage = ({ module }: { module: InternalModule }) => {
  const summary = useMemo(() => {
    const pendingBpp = budgetAuditEvents.filter(
      (event) => event.action === 'BPP No Objection' && event.status !== 'Completed'
    ).length;
    const overrides = budgetAuditEvents.filter((event) => event.action === 'Override').length;
    const holds = budgetAuditEvents.filter((event) => event.action === 'Hold').length;
    const releases = budgetAuditEvents.filter((event) => event.action === 'Release').length;
    return { pendingBpp, overrides, holds, releases };
  }, []);

  const flagged = useMemo(() => {
    return budgetAuditEvents.filter(
      (event) => event.status === 'Escalated' || event.status === 'Rejected' || event.action === 'Override'
    );
  }, []);

  return (
    <section className="portal-module compliance-reports">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Pending BPP</h3>
          <p>{summary.pendingBpp} requests awaiting no-objection</p>
        </article>
        <article className="portal-module-card">
          <h3>Overrides</h3>
          <p>{summary.overrides} override requests logged</p>
        </article>
        <article className="portal-module-card">
          <h3>Holds & Releases</h3>
          <p>
            {summary.holds} holds · {summary.releases} releases
          </p>
        </article>
      </div>

      <div className="admin-card admin-card--full" style={{ marginTop: '16px' }}>
        <h3>Flagged Budget Events</h3>
        <table className="plan-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Status</th>
              <th>Budget Code</th>
              <th>Amount</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {flagged.length ? (
              flagged.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTimeShort(event.timestamp)}</td>
                  <td>{event.action}</td>
                  <td>
                    <span className={`admin-status ${budgetAuditStatusTone(event.status)}`}>{event.status}</span>
                  </td>
                  <td>{event.budgetCode}</td>
                  <td>{formatCurrency(event.amount)}</td>
                  <td>{event.reference}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="plan-empty">
                  No flagged events in the current period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const SystemAdminModulePage = ({ module, moduleData, moduleError, isLoading }: ModulePageProps) => {
  const moduleKey = module.id as keyof typeof adminQuickActions;
  const actions = adminQuickActions[moduleKey] ?? adminQuickActions['system-monitoring'];
  const roleRows = Array.isArray(moduleData) ? (moduleData as Record<string, unknown>[]) : [];
  const roleSource = roleRows.length ? roleRows : fallbackRoles;

  const roleCards = roleSource.slice(0, 6).map((role) => {
    const roleName = toText(readField(role, ['roleName', 'role_name', 'RoleName']), 'Role');
    const roleDescription = toText(readField(role, ['description', 'Description']), 'Governance role profile.');
    const activeFlag = toFlag(readField(role, ['isActive', 'is_active', 'IsActive']), true);
    return {
      name: toTitle(roleName),
      description: roleDescription,
      isActive: activeFlag
    };
  });

  return (
    <section className="admin-hub">
      <div className="admin-hero">
        <div>
          <div className="admin-kicker">System Administration</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{module.microservice}</span>
            <span className="admin-tag">{module.controlPurpose}</span>
          </div>
        </div>
        <div className="admin-metrics">
          <div className="admin-metric">
            <strong>24</strong>
            <span>Policy checks enforced</span>
          </div>
          <div className="admin-metric">
            <strong>7</strong>
            <span>Active guardrails</span>
          </div>
          <div className="admin-metric">
            <strong>2</strong>
            <span>Escalations in review</span>
          </div>
        </div>
      </div>

      {moduleError ? <div className="portal-alert">{moduleError}</div> : null}

      <div className="admin-actions" style={{ marginTop: '16px' }}>
        {actions.map((action) => (
          <article key={action.title} className="admin-action">
            <h4>{action.title}</h4>
            <p>{action.detail}</p>
          </article>
        ))}
      </div>

      {module.id === 'user-role-management' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Role Directory</h3>
            <ul className="admin-list">
              {roleCards.map((role) => (
                <li key={role.name}>
                  <div>
                    <strong>{role.name}</strong>
                    <span>{role.description}</span>
                  </div>
                  <span className={`admin-status ${role.isActive ? 'admin-status--good' : 'admin-status--alert'}`}>
                    {role.isActive ? 'Active' : 'Disabled'}
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Access Requests</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.map((request) => (
                  <tr key={request.name}>
                    <td>
                      {request.name}
                      <div style={{ color: 'var(--portal-slate)', fontSize: '12px' }}>{request.reason}</div>
                    </td>
                    <td>{request.role}</td>
                    <td>
                      <span
                        className={`admin-status ${
                          request.status === 'Pending' ? 'admin-status--warn' : 'admin-status--alert'
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article className="admin-card admin-card--full">
            <h3>Governance Notes</h3>
            <p>
              All access changes are recorded in the audit trail. Approval routing is enforced by segregation of
              duties and statutory thresholds.
            </p>
          </article>
        </div>
      ) : null}

      {module.id === 'workflow-configuration' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Workflow Gates</h3>
            <ul className="admin-list">
              {workflowGates.map((gate) => (
                <li key={gate.gate}>
                  <div>
                    <strong>{gate.gate}</strong>
                    <span>{gate.scope}</span>
                  </div>
                  <span className={`admin-status ${gate.status === 'Locked' ? 'admin-status--good' : 'admin-status--warn'}`}>
                    {gate.status}
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Policy Signals</h3>
            <ul className="admin-list">
              {policySignals.map((signal) => (
                <li key={signal.label}>
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="admin-card admin-card--full">
            <h3>Workflow Notes</h3>
            <p>
              Routing gates are synchronized with the PPA thresholds. Any policy change triggers automatic
              compliance checks and notification to audit oversight.
            </p>
          </article>
        </div>
      ) : null}

      {module.id === 'system-monitoring' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Service Health</h3>
            <ul className="admin-list">
              {serviceHealth.map((service) => (
                <li key={service.service}>
                  <div>
                    <strong>{service.service}</strong>
                    <span>{service.uptime} uptime</span>
                  </div>
                  <span
                    className={`admin-status ${
                      service.status === 'Healthy' ? 'admin-status--good' : 'admin-status--warn'
                    }`}
                  >
                    {service.status}
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Integration Alerts</h3>
            <ul className="admin-list">
              {monitoringAlerts.map((alert) => (
                <li key={alert.title}>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </div>
                  <span className="admin-status admin-status--warn">{alert.status}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="admin-card admin-card--full">
            <h3>Operational Note</h3>
            <p>
              Monitoring feeds are aligned with statutory uptime requirements. Critical alerts trigger audit
              notifications within five minutes.
            </p>
          </article>
        </div>
      ) : null}

      {isLoading ? <p>Loading module data...</p> : null}
      {!isLoading ? (
        <div className="admin-response">
          {JSON.stringify(moduleData ?? { message: 'No live data available yet.' }, null, 2)}
        </div>
      ) : null}
    </section>
  );
};

const ModulePage = ({ module, moduleData, moduleError, isLoading, token, role, userEmail }: ModulePageProps) => {
  if (module.id === 'workflow-blueprint') {
    return <WorkflowBlueprintModulePage module={module} token={token} role={role} />;
  }

  if (module.id === 'workflow-configuration') {
    return <WorkflowConfigurationModulePage module={module} moduleData={moduleData} moduleError={moduleError} token={token} />;
  }

  if (module.id === 'create-requisition') {
    return <RequisitionModulePage module={module} role={role} token={token} />;
  }

  if (module.id === 'requisition-history') {
    return <RequisitionHistoryModulePage module={module} token={token} />;
  }

  if (module.id === 'requisition-tracking') {
    return <RequisitionTrackingModulePage module={module} token={token} />;
  }

  if (module.id === 'contract-award') {
    return <ContractAwardModulePage module={module} token={token} />;
  }

  if (module.id === 'contract-management') {
    return <ContractManagementModulePage module={module} token={token} userEmail={userEmail} />;
  }

  if (module.id === 'inspection-acceptance') {
    return <InspectionAcceptanceModulePage module={module} token={token} />;
  }

  if (module.id === 'evaluation-report') {
    return <EvaluationReportModulePage module={module} token={token} />;
  }

  if (module.id === 'assigned-tenders' || module.id === 'technical-evaluation' || module.id === 'financial-evaluation') {
    return (
      <AssignedTendersModulePage
        module={module}
        moduleData={moduleData}
        moduleError={moduleError}
        isLoading={isLoading}
        token={token}
      />
    );
  }

  if (module.id === 'annual-procurement-plan') {
    return <ProcurementPlansModulePage module={module} token={token} />;
  }

  if (module.id === 'create-tender') {
    return <TenderModulePage module={module} token={token} mode="create" />;
  }

  if (module.id === 'publish-tender') {
    return <TenderModulePage module={module} token={token} mode="publish" />;
  }

  if (module.id === 'bid-opening-session') {
    return <BidOpeningModulePage module={module} token={token} />;
  }

  if (module.id === 'bpp-escalation') {
    return <BppEscalationModulePage module={module} token={token} userEmail={userEmail} />;
  }

  if (module.id === 'audit-dashboard') {
    return <AuditDashboardModulePage module={module} />;
  }

  if (module.id === 'audit-trail-viewer') {
    return <AuditTrailModulePage module={module} />;
  }

  if (module.id === 'compliance-reports') {
    return <ComplianceReportsModulePage module={module} />;
  }

  if (module.section === 'System Administration') {
    return (
      <SystemAdminModulePage
        module={module}
        moduleData={moduleData}
        moduleError={moduleError}
        isLoading={isLoading}
      />
    );
  }

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="portal-module-grid">
        <article className="portal-module-card">
          <h3>Governing Microservice</h3>
          <p>{module.microservice}</p>
        </article>
        <article className="portal-module-card">
          <h3>Control Objective</h3>
          <p>{module.controlPurpose}</p>
        </article>
        <article className="portal-module-card">
          <h3>Compliance Guardrail</h3>
          <p>
            Actions remain constrained to this workflow stage. Cross-role bypass is not available from this
            interface.
          </p>
        </article>
      </div>

      {moduleError ? <div className="portal-alert">{moduleError}</div> : null}

      <div className="admin-response">
        {isLoading ? 'Loading module data...' : JSON.stringify(moduleData, null, 2)}
      </div>
    </section>
  );
};

export { InternalHeader, SidebarNav, DashboardPage, ModulePage };
