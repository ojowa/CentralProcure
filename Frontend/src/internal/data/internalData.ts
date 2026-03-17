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
    key: 'financial_unit_officer',
    name: 'Budget Officer',
    description: 'Confirms appropriation, releases, and affordability before APP approval.'
  },
  {
    key: 'evaluation_committee',
    name: 'Evaluation Committee',
    description: 'Runs technical and commercial evaluation steps.'
  },
  {
    key: 'tenders_board',
    name: 'Tenders Board',
    description: 'DCG-led NIS Tenders Board that reviews and decides board-routed submissions.'
  },
  {
    key: 'accounting_officer',
    name: 'CGIS',
    description: 'Exercises direct low-value approval authority and accountable executive controls.'
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

const procurementPlanningModules: InternalModule[] = [
  {
    id: 'annual-procurement-plan',
    title: 'Annual Procurement Plan (APP)',
    section: 'Procurement Planning',
    description: 'Manage departmental and agency-wide procurement plans and item ledgers.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Mandatory PPA 2007 baseline for all spending.',
    actions: ['plan.create', 'plan.view', 'plan.update'],
    allowedRoles: ['planning_statistics_officer', 'procurement_officer', 'accounting_officer']
  }
];

const financialControlModules: InternalModule[] = [
  {
    id: 'budget-confirmation',
    title: 'Budget Officer Workspace',
    section: 'Financial Control',
    description: 'Review APP funding readiness, inspect budget lines, and route plans through budget confirmation.',
    microservice: 'Governance Service',
    controlPurpose: 'Distinct budget-gate visibility and funding confirmation before APP approval.',
    actions: ['planning_committee.view', 'budget.confirm'],
    allowedRoles: ['financial_unit_officer', 'accounting_officer']
  }
];

const tenderManagementModules: InternalModule[] = [
  {
    id: 'create-tender',
    title: 'Tender Creation',
    section: 'Tendering & Sourcing',
    description: 'Initialize procurement advertisements and bidding documents.',
    microservice: 'Vendor Sourcing Service',
    controlPurpose: 'Controlled creation of bidding opportunities.',
    actions: ['tender.create'],
    allowedRoles: ['procurement_officer']
  },
  {
    id: 'publish-tender',
    title: 'Publish Tenders',
    section: 'Tendering & Sourcing',
    description: 'Manage advertisement deadlines and push tenders to the public portal.',
    microservice: 'Vendor Sourcing Service',
    controlPurpose: 'Compliance with mandatory advertising periods.',
    actions: ['tender.publish'],
    allowedRoles: ['procurement_officer']
  },
  {
    id: 'bid-opening-session',
    title: 'Bid Opening',
    section: 'Tendering & Sourcing',
    description: 'Control and monitor public bid opening sessions in real-time.',
    microservice: 'Vendor Sourcing Service',
    controlPurpose: 'PPA compliance for transparent bid unlocking.',
    actions: ['bidopening.control', 'bidopening.view'],
    allowedRoles: ['procurement_officer', 'ict_admin']
  }
];

const evaluationModules: InternalModule[] = [
  {
    id: 'technical-evaluation',
    title: 'Technical Evaluation',
    section: 'Evaluation Committee',
    description: 'Score vendor technical bids against eligibility and quality criteria.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Ensure technical compliance before financial opening.',
    actions: ['evaluation.technical.score', 'evaluation.actions'],
    allowedRoles: ['technical_evaluator', 'evaluation_committee']
  },
  {
    id: 'financial-evaluation',
    title: 'Financial Evaluation',
    section: 'Evaluation Committee',
    description: 'Review commercial bids and rank by lowest evaluated responsive cost.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Finalize value-for-money recommendations.',
    actions: ['evaluation.financial.score', 'evaluation.actions'],
    allowedRoles: ['financial_evaluator', 'evaluation_committee']
  }
];

const approvalModules: InternalModule[] = [
  {
    id: 'tenders-board-approval',
    title: 'Tenders Board Approvals',
    section: 'Governance & Approval',
    description: 'Run CGIS direct approvals, DCG-led board decisions, and escalation-ready award reviews.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Statutory oversight and final spending authorization.',
    actions: ['approval.requisition', 'approval.award'],
    allowedRoles: ['tenders_board', 'accounting_officer']
  }
];

const postAwardModules: InternalModule[] = [
  {
    id: 'contract-management',
    title: 'Contracts & Milestones',
    section: 'Post-Award & Execution',
    description: 'Track project execution, log field milestones, and monitor performance.',
    microservice: 'Post-Award Service',
    controlPurpose: 'Ensure value-for-money through physical progress tracking.',
    actions: ['contract.view', 'milestone.log'],
    allowedRoles: ['procurement_officer', 'department_head', 'accounting_officer']
  }
];

const oversightModules: InternalModule[] = [
  {
    id: 'bpp-escalation',
    title: 'BPP No-Objection',
    section: 'External Oversight',
    description: 'Manage board-endorsed projects that exceed agency thresholds and require BPP prior review.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'PPA 2007 mandatory external validation for high-value projects.',
    actions: ['bpp.escalate', 'bpp.view'],
    allowedRoles: ['procurement_officer', 'bpp_liaison']
  },
  {
    id: 'administrative-review',
    title: 'Complaint Handling',
    section: 'Legal & Dispute',
    description: 'Process and resolve formal vendor protests and administrative reviews.',
    microservice: 'Procurement Workflow Service',
    controlPurpose: 'Section 54 compliance for statutory dispute resolution.',
    actions: ['complaint.review', 'complaint.resolve'],
    allowedRoles: ['legal_reviewer', 'complaints_review_officer', 'accounting_officer']
  }
];

const sharedModules: InternalModule[] = [
  {
    id: 'user-profile',
    title: 'User Profile',
    section: 'Account Management',
    description: 'Manage your personal account details, service identity, and security preferences.',
    microservice: 'Identity Service',
    controlPurpose: 'Self-service account management and identity verification.',
    actions: ['profile.view', 'profile.update'],
    allowedRoles: ['admin', 'requisitioning_officer', 'department_head', 'procurement_officer', 'procurement_manager', 'planning_statistics_officer', 'financial_unit_officer', 'legal_reviewer', 'technical_evaluator', 'financial_evaluator', 'evaluation_committee', 'tenders_board', 'tenders_board_secretary', 'accounting_officer', 'bpp_liaison', 'bpp_reviewer', 'complaints_review_officer', 'contract_manager', 'inspection_officer', 'payment_officer', 'audit_oversight', 'ict_admin']
  }
];

export const roleModuleFallbacks: Partial<Record<RoleKey, InternalModule[]>> = {
  requisitioning_officer: [...requisitionDepartmentModules, ...sharedModules],
  department_head: [...requisitionDepartmentModules, ...postAwardModules, ...sharedModules],
  planning_statistics_officer: [...procurementPlanningModules, ...sharedModules],
  financial_unit_officer: [...financialControlModules, ...sharedModules],
  procurement_officer: [...procurementPlanningModules, ...tenderManagementModules, ...postAwardModules, ...oversightModules, ...sharedModules],
  technical_evaluator: [...evaluationModules, ...sharedModules],
  financial_evaluator: [...evaluationModules, ...sharedModules],
  evaluation_committee: [...evaluationModules, ...sharedModules],
  tenders_board: [...approvalModules, ...sharedModules],
  accounting_officer: [...financialControlModules, ...approvalModules, ...postAwardModules, ...oversightModules, ...sharedModules],
  bpp_liaison: [...oversightModules, ...sharedModules],
  legal_reviewer: [...oversightModules, ...sharedModules],
  complaints_review_officer: [...oversightModules, ...sharedModules],
  admin: [...sharedModules],
  ict_admin: [...tenderManagementModules, ...sharedModules]
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
    detail: 'DCG-led NIS Tenders Board reviews and decides board-routed recommendations.'
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
    focus: 'Exercise DCG-led board oversight on cases that fall within NIS Tenders Board authority.',
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
    escalation: 'Board-routed cases are decided by the DCG heads of directorates sitting as the NIS Tenders Board.',
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
