'use client';

import type { InternalModule, RoleDefinition, RoleKey, UserGroup } from '../types/internal';

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
    description: 'Originates requisitions and confirms APP and budget alignment.',
    group: 'office_formation'
  },
  {
    key: 'formation_officer',
    name: 'Formation Officer',
    description: 'Captures procurement needs and initiates requests at the formation level.',
    group: 'office_formation'
  },
  {
    key: 'formation_head',
    name: 'Formation Head',
    description: 'Reviews and endorses procurement needs for the formation.',
    group: 'office_formation'
  },
  {
    key: 'department_head',
    name: 'Department Head',
    description: 'Confirms business need, scope, and readiness.',
    group: 'office_formation'
  },
  {
    key: 'comptroller_procurement',
    name: 'Comptroller Procurement',
    description: 'Head of the procurement unit who chairs planning committee review and approves the APP.',
    group: 'procurement_staff'
  },
  {
    key: 'financial_unit_officer',
    name: 'Budget Officer',
    description: 'Confirms appropriation, releases, and affordability before APP approval.',
    group: 'procurement_staff'
  },
  {
    key: 'procurement_secretary',
    name: 'Procurement Secretary',
    description: 'Committee secretary who records decisions and keeps the review log.',
    group: 'procurement_staff'
  },
  {
    key: 'evaluation_committee',
    name: 'Evaluation Committee',
    description: 'Runs technical and commercial evaluation steps.',
    group: 'procurement_staff'
  },
  {
    key: 'tenders_board',
    name: 'Tenders Board',
    description: 'NIS Tenders Board chaired by CGIS that reviews and decides board-routed submissions.',
    group: 'procurement_staff'
  },
  {
    key: 'accounting_officer',
    name: 'CGIS',
    description: 'Exercises direct low-value approval authority and accountable executive controls.',
    group: 'procurement_staff'
  },
  {
    key: 'audit_oversight',
    name: 'Audit Oversight',
    description: 'Monitors compliance, traceability, and exceptions.',
    group: 'procurement_staff'
  },
  {
    key: 'ict_admin',
    name: 'ICT Admin',
    description: 'Maintains platform access, routing, and technical integrity.',
    group: 'procurement_staff'
  }
];

const requisitionDepartmentModules: InternalModule[] = [
  {
    id: 'create-requisition',
    title: 'Create Requisition',
    section: 'Requisitions',
    description: 'Initiate departmental procurement requests with budget and requirement metadata.',
    microservice: 'Requisition Service',
    controlPurpose: 'Controlled initiation of procurement.',
    actions: ['requisition.create']
  },
  {
    id: 'requisition-history',
    title: 'Requisition History',
    section: 'Requisitions',
    description: 'View historical department requests and current workflow states.',
    microservice: 'Requisition Service',
    controlPurpose: 'Visibility without unauthorized control.',
    actions: ['requisition.view']
  },
  {
    id: 'requisition-tracking',
    title: 'Requisition Tracking',
    section: 'Requisitions',
    description: 'Track routing progress across procurement, evaluation, and approvals.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Read-only timeline for accountable traceability.',
    actions: ['requisition.track']
  },
  {
    id: 'department-head-review',
    title: 'Department Head Review',
    section: 'Requisitions',
    description: 'Review, endorse, return, or reject departmental requisitions awaiting approval.',
    microservice: 'Requisition Service',
    controlPurpose: 'Department-level validation before procurement processing.',
    actions: ['requisition.endorse', 'requisition.return', 'requisition.reject']
  }
];

const procurementPlanningModules: InternalModule[] = [
  {
    id: 'annual-procurement-plan',
    title: 'Annual Procurement Plan (APP)',
    section: 'Planning & Budget',
    description: 'Manage departmental and agency-wide procurement plans and item ledgers.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Mandatory PPA 2007 baseline for all spending.',
    actions: ['plan.create', 'plan.view', 'plan.update']
  },
  {
    id: 'procurement-planning-committee',
    title: 'Planning Committee Review',
    section: 'Planning & Budget',
    description: 'Link requisitions to APP items and record committee review decisions.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Section 21 planning committee visibility and pre-tender discipline.',
    actions: ['planning_committee.view']
  }
];

const financialControlModules: InternalModule[] = [];

const tenderManagementModules: InternalModule[] = [
  {
    id: 'create-tender',
    title: 'Tender Management',
    section: 'Tendering & Sourcing',
    description: 'Create tender drafts from approved requisitions and publish draft tenders from one workspace.',
    microservice: 'Vendor Sourcing Service',
    controlPurpose: 'Controlled drafting and publication of bidding opportunities.',
    actions: ['tender.create', 'tender.publish']
  },
  {
    id: 'bid-opening-session',
    title: 'Bid Opening',
    section: 'Tendering & Sourcing',
    description: 'Control and monitor public bid opening sessions in real-time.',
    microservice: 'Vendor Sourcing Service',
    controlPurpose: 'PPA compliance for transparent bid unlocking.',
    actions: ['bidopening.control', 'bidopening.view']
  }
];

const evaluationModules: InternalModule[] = [
  {
    id: 'technical-evaluation',
    title: 'Technical Evaluation',
    section: 'Evaluation',
    description: 'Score vendor technical bids against eligibility and quality criteria.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Ensure technical compliance before financial opening.',
    actions: ['evaluation.technical.score', 'evaluation.actions']
  },
  {
    id: 'financial-evaluation',
    title: 'Financial Evaluation',
    section: 'Evaluation',
    description: 'Review commercial bids and rank by lowest evaluated responsive cost.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Finalize value-for-money recommendations.',
    actions: ['evaluation.financial.score', 'evaluation.actions']
  }
];

const approvalModules: InternalModule[] = [
  {
    id: 'cgis-approval',
    title: 'CGIS Approval',
    section: 'Governance & Approval',
    description: 'Executive workspace for low-value procurement approvals and statutory executive decisions.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Direct executive authorization for low-value routes.',
    actions: ['cgis.approve', 'cgis.reject', 'cgis.return', 'cgis.escalate']
  },
  {
    id: 'tenders-board-approval',
    title: 'Tenders Board Approvals',
    section: 'Governance & Approval',
    description: 'Run CGIS direct approvals, board decisions chaired by CGIS, and escalation-ready award reviews.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Statutory oversight and final spending authorization.',
    actions: ['approval.requisition', 'approval.award']
  }
];

const postAwardModules: InternalModule[] = [
  {
    id: 'contract-management',
    title: 'Contracts & Milestones',
    section: 'Post-Award',
    description: 'Track project execution, log field milestones, and monitor performance.',
    microservice: 'Post-Award Service',
    controlPurpose: 'Ensure value-for-money through physical progress tracking.',
    actions: ['contract.view', 'milestone.log']
  }
];

const oversightModules: InternalModule[] = [
  {
    id: 'requisition-management',
    title: 'Requisition Management',
    section: 'Governance & Oversight',
    description: 'Administrative control over all departmental procurement requests, including hard deletion and state overrides.',
    microservice: 'Requisition Service',
    controlPurpose: 'Ultimate administrative control over requisition lifecycle.',
    actions: ['requisition.delete', 'requisition.view.all']
  },
  {
    id: 'threshold-configuration',
    title: 'Threshold Configuration',
    section: 'System Administration',
    description: 'Configure procurement thresholds, approval routes, and governance rules.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Centralized management of threshold bands and approval authorities.',
    actions: ['threshold.view', 'threshold.edit', 'threshold.configure']
  },
  {
    id: 'bpp-escalation',
    title: 'BPP No-Objection',
    section: 'Oversight',
    description: 'Manage board-endorsed projects that exceed agency thresholds and require BPP prior review.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'PPA 2007 mandatory external validation for high-value projects.',
    actions: ['bpp.escalate', 'bpp.view']
  },
  {
    id: 'administrative-review',
    title: 'Complaint Handling',
    section: 'Oversight',
    description: 'Process and resolve formal vendor protests and administrative reviews.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Section 54 compliance for statutory dispute resolution.',
    actions: ['complaint.review', 'complaint.resolve']
  }
];

const sharedModules: InternalModule[] = [
  {
    id: 'user-profile',
    title: 'User Profile',
    section: 'Account',
    description: 'Manage your personal account details, service identity, and security preferences.',
    microservice: 'Identity Service',
    controlPurpose: 'Self-service account management and identity verification.',
    actions: ['profile.view', 'profile.update']
  }
];

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
  'Endorsed',
  'Initial',
  'Under Review',
  'Evaluation',
  'Board Review',
  'Approved',
  'Rejected'
];
export const editableRequisitionStatuses = new Set(['Draft', 'Submitted', 'Endorsed', 'Rejected']);

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
    key: 'comptroller_procurement',
    title: 'Comptroller Procurement',
    status: 'Pending Review',
    detail: 'Head of the procurement unit reviewing specifications, method, threshold routing, and APP approval.'
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
    detail: 'NIS Tenders Board chaired by CGIS reviews and decides board-routed recommendations.'
  },
  {
    key: 'accounting_officer',
    title: 'CGIS Approval',
    status: 'Conditional',
    detail: 'Exercise direct low-value approval authority before award publication.'
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
  department_head: {
    focus: 'Confirm the departmental need is complete, defensible, and ready to enter procurement control.',
    checks: [
      'Validate that scope, timing, and justification are clear enough for procurement processing.',
      'Confirm APP linkage and budget coding before endorsing the request.',
      'Review live routing implications and record a traceable departmental note.'
    ]
  },
  comptroller_procurement: {
    focus: 'Act as head of the procurement unit for completeness review, routing basis, procurement method readiness, and APP approval.',
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
    focus: 'Exercise board oversight under the NIS Tenders Board chaired by CGIS.',
    checks: [
      'Check completeness of supporting documentation.',
      'Confirm that the recommendation basis is defensible.',
      'Record the board decision and any BPP escalation clearly.'
    ]
  },
  accounting_officer: {
    focus: 'Exercise CGIS direct approval on low-value cases and keep the executive decision traceable.',
    checks: [
      'Validate that the threshold route resolves to CGIS direct approval.',
      'Confirm the supporting pack is complete before approval.',
      'Record the executive decision traceably.'
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
    id: 'cgis-direct',
    label: 'Below NGN 50M',
    min: 0,
    max: 50_000_000,
    approvalLevel: 'CGIS Direct Approval',
    timeline: '30 - 45 days',
    requiresBpp: false,
    escalation: 'Low-value cases move from evaluation to CGIS approval before award publication.',
    steps: ['Requisition Review', 'Evaluation', 'CGIS Approval', 'Award Publication']
  },
  {
    id: 'nis-board',
    label: 'NGN 50M - 100M',
    min: 50_000_000,
    max: 100_000_000,
    approvalLevel: 'NIS Tenders Board',
    timeline: '45 - 60 days',
    requiresBpp: false,
    escalation: 'Board-routed cases are decided by the NIS Tenders Board chaired by CGIS.',
    steps: ['Requisition Review', 'Evaluation', 'Tenders Board Review', 'Award Publication']
  },
  {
    id: 'bpp-prior-review',
    label: 'NGN 100M+',
    min: 100_000_000,
    max: Number.POSITIVE_INFINITY,
    approvalLevel: 'NIS Tenders Board + BPP',
    timeline: '60 - 90 days',
    requiresBpp: true,
    escalation: 'High-value cases require board endorsement before BPP no-objection and award publication.',
    steps: ['Requisition Review', 'Evaluation', 'Tenders Board Review', 'BPP No Objection', 'Award Publication']
  }
];
