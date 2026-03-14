'use client';

import type { InternalModule, RoleDefinition, RoleKey } from '../types/internal';

export type ThresholdBand = {
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

export type BudgetLineItem = {
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

export const roles: RoleDefinition[] = [
  {
    key: 'requisitioning_officer',
    name: 'Requisitioning Officer',
    description: 'Originates requisitions and confirms APP and budget alignment.'
  },
  {
    key: 'department_head',
    name: 'Department Head',
    description: 'Confirms business need, scope, and readiness.'
  },
  {
    key: 'procurement_officer',
    name: 'Procurement Officer',
    description: 'Reviews method, market approach, and procedural compliance.'
  },
  {
    key: 'evaluation_committee',
    name: 'Evaluation Committee',
    description: 'Runs technical and commercial evaluation steps.'
  },
  {
    key: 'tenders_board',
    name: 'Tenders Board',
    description: 'Reviews submissions and issues board decisions.'
  },
  {
    key: 'accounting_officer',
    name: 'Accounting Officer',
    description: 'Approves high-value awards and delegated controls.'
  },
  {
    key: 'audit_oversight',
    name: 'Audit Oversight',
    description: 'Monitors compliance, traceability, and exceptions.'
  },
  {
    key: 'ict_admin',
    name: 'ICT Admin',
    description: 'Maintains platform access, routing, and technical integrity.'
  }
];

const requisitionDepartmentModules: InternalModule[] = [
  {
    id: 'create-requisition',
    title: 'Create Requisition',
    section: 'Requisitioning Departments',
    description: 'Submit procurement requests with budget and justification metadata.',
    microservice: 'Requisition Service',
    controlPurpose: 'Controlled initiation of procurement.',
    actions: ['requisition.create'],
    allowedRoles: ['requisitioning_officer', 'department_head']
  },
  {
    id: 'requisition-history',
    title: 'Requisition History',
    section: 'Requisitioning Departments',
    description: 'View historical department requests and current workflow states.',
    microservice: 'Requisition Service',
    controlPurpose: 'Visibility without unauthorized control.',
    actions: ['requisition.view'],
    allowedRoles: ['requisitioning_officer', 'department_head']
  },
  {
    id: 'requisition-tracking',
    title: 'Requisition Tracking',
    section: 'Requisitioning Departments',
    description: 'Track routing progress across procurement, evaluation, and approvals.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Read-only timeline for accountable traceability.',
    actions: ['requisition.track'],
    allowedRoles: ['requisitioning_officer', 'department_head', 'complaints_review_officer', 'audit_oversight', 'admin']
  }
];

export const roleModuleFallbacks: Partial<Record<RoleKey, InternalModule[]>> = {
  requisitioning_officer: requisitionDepartmentModules,
  department_head: requisitionDepartmentModules
};

export const requisitionTypes = ['Goods', 'Works', 'Services'];
export const requisitionPriorities = ['Normal', 'Urgent', 'Strategic'];
export const requisitionFundingSources = [
  'Capital Budget',
  'Recurrent Budget',
  'Donor Grant',
  'Special Intervention'
];
export const requisitionStatuses = [
  'Draft',
  'Submitted',
  'Under Review',
  'Evaluation',
  'Board Review',
  'Approved',
  'Rejected'
];
export const editableRequisitionStatuses = new Set(['Draft', 'Rejected']);

export const requisitionSteps: Array<{
  key: RoleKey;
  title: string;
  status: string;
  detail: string;
}> = [
  {
    key: 'requisitioning_officer',
    title: 'Requisitioning Officer',
    status: 'Draft',
    detail: 'Capture need, scope, APP linkage, and budget basis.'
  },
  {
    key: 'procurement_officer',
    title: 'Procurement Unit',
    status: 'Pending Review',
    detail: 'Validate specifications, method, and threshold routing.'
  },
  {
    key: 'evaluation_committee',
    title: 'Evaluation Committee',
    status: 'Queued',
    detail: 'Prepare or execute evaluation based on workflow stage.'
  },
  {
    key: 'tenders_board',
    title: 'Tenders Board',
    status: 'Awaiting',
    detail: 'Review recommendation and approve board-level decisions.'
  },
  {
    key: 'accounting_officer',
    title: 'Accounting Officer',
    status: 'Conditional',
    detail: 'Confirm delegated or escalated approvals.'
  },
  {
    key: 'audit_oversight',
    title: 'Audit and Oversight',
    status: 'Monitor',
    detail: 'Observe traceability and compliance after movement.'
  }
];

export const requisitionRoleGuidance: Partial<
  Record<
    RoleKey,
    {
      focus: string;
      checks: string[];
    }
  >
> = {
  requisitioning_officer: {
    focus: 'Frame the need clearly and anchor it to the approved plan and budget.',
    checks: [
      'Use a live APP line item.',
      'Match the budget code to the selected APP item.',
      'Capture delivery timing, justification, and risk notes.'
    ]
  },
  procurement_officer: {
    focus: 'Check completeness, routing basis, and procurement method readiness.',
    checks: [
      'Validate specifications and scope clarity.',
      'Confirm threshold route and approval path.',
      'Return incomplete drafts with actionable comments.'
    ]
  },
  evaluation_committee: {
    focus: 'Prepare evaluation criteria that are defensible and aligned to scope.',
    checks: [
      'Review scope and technical requirements.',
      'Confirm evaluation inputs are complete.',
      'Document committee decisions clearly.'
    ]
  },
  tenders_board: {
    focus: 'Exercise approval oversight on board-routed cases.',
    checks: [
      'Check completeness of supporting documentation.',
      'Confirm recommendation basis.',
      'Record decision outcomes clearly.'
    ]
  },
  accounting_officer: {
    focus: 'Confirm financial authority and escalated approval readiness.',
    checks: [
      'Validate budget basis and threshold route.',
      'Confirm supporting approvals are complete.',
      'Record final decision traceably.'
    ]
  },
  audit_oversight: {
    focus: 'Monitor compliance, traceability, and stage movement.',
    checks: [
      'Check audit trail completeness.',
      'Review turnaround times and exceptions.',
      'Flag non-compliant routing or actions.'
    ]
  }
};

export const thresholdBands: ThresholdBand[] = [
  {
    id: 'below-50m',
    label: 'Below NGN 50M',
    min: 0,
    max: 50_000_000,
    approvalLevel: 'Departmental / Internal Threshold',
    timeline: '30 - 45 days',
    requiresBpp: false,
    escalation: 'Escalates to board route if amount exceeds delegated authority.',
    steps: ['Requisition Review', 'Procurement Processing', 'Approval']
  },
  {
    id: '50m-100m',
    label: 'NGN 50M - 100M',
    min: 50_000_000,
    max: 100_000_000,
    approvalLevel: 'Immigration Tender Board',
    timeline: '45 - 60 days',
    requiresBpp: false,
    escalation: 'Board review required before award publication.',
    steps: ['Requisition Review', 'Evaluation', 'Tender Board Review']
  },
  {
    id: '100m-250m',
    label: 'NGN 100M - 250M',
    min: 100_000_000,
    max: 250_000_000,
    approvalLevel: 'Accounting Officer + BPP',
    timeline: '60 - 90 days',
    requiresBpp: true,
    escalation: 'No-objection review required before final approval.',
    steps: ['Requisition Review', 'Evaluation', 'Board Review', 'BPP No Objection']
  },
  {
    id: '250m-plus',
    label: 'NGN 250M+',
    min: 250_000_000,
    max: Number.POSITIVE_INFINITY,
    approvalLevel: 'Federal Executive Council',
    timeline: '90 - 120 days',
    requiresBpp: true,
    escalation: 'BPP no-objection and FEC escalation required.',
    steps: ['Requisition Review', 'Evaluation', 'Board Review', 'BPP No Objection', 'FEC Approval']
  }
];
