import { InternalModule, RoleDefinition } from '../types/internal';

export const roles: RoleDefinition[] = [
  {
    key: 'admin',
    name: 'Admin',
    description: 'Provides top-level administrative oversight across access control, workflow governance, and compliance visibility.'
  },
  {
    key: 'requisitioning_officer',
    name: 'Requisitioning Officer',
    description: 'Initiates and tracks requisitions within approved departmental workflow.'
  },
  {
    key: 'department_head',
    name: 'Department Head',
    description: 'Reviews departmental requests, monitors readiness, and coordinates internal escalation.'
  },
  {
    key: 'procurement_officer',
    name: 'Procurement Unit',
    description: 'Manages planning, tender creation, publication, and opening.'
  },
  {
    key: 'procurement_manager',
    name: 'Procurement Manager',
    description: 'Oversees procurement operations, tender controls, and compliance execution.'
  },
  {
    key: 'planning_statistics_officer',
    name: 'Planning, Research and Statistics',
    description: 'Reviews procurement planning assumptions, demand timing, and annual plan coherence.'
  },
  {
    key: 'financial_unit_officer',
    name: 'Financial Unit',
    description: 'Verifies budget availability, cash discipline, and financial readiness for procurement.'
  },
  {
    key: 'legal_reviewer',
    name: 'Legal Unit',
    description: 'Reviews procurement documentation, contract terms, and statutory compliance exposure.'
  },
  {
    key: 'technical_evaluator',
    name: 'Technical Evaluator',
    description: 'Performs technical scoring and subject-matter evaluation for tenders.'
  },
  {
    key: 'financial_evaluator',
    name: 'Financial Evaluator',
    description: 'Performs commercial and arithmetic review of responsive bids.'
  },
  {
    key: 'evaluation_committee',
    name: 'Evaluation Committee',
    description: 'Performs technical and financial evaluations and reports.'
  },
  {
    key: 'tenders_board',
    name: 'Immigration Tender Board',
    description: 'Reviews recommendations and approves or rejects tenders.'
  },
  {
    key: 'tenders_board_secretary',
    name: 'Tenders Board Secretary',
    description: 'Coordinates board submissions, maintains records, and prepares decision documentation.'
  },
  {
    key: 'accounting_officer',
    name: 'Accounting Officer',
    description: 'Handles high-value tender decisions and BPP escalation.'
  },
  {
    key: 'bpp_liaison',
    name: 'BPP Liaison',
    description: 'Coordinates no-objection submissions, intake records, and regulator-facing escalation packs.'
  },
  {
    key: 'bpp_reviewer',
    name: 'BPP Reviewer',
    description: 'Reviews no-objection submissions and records regulatory decisions and remarks.'
  },
  {
    key: 'complaints_review_officer',
    name: 'Administrative Review Officer',
    description: 'Handles bidder complaints, review requests, and challenge documentation.'
  },
  {
    key: 'contract_manager',
    name: 'Contract Manager',
    description: 'Owns post-award performance monitoring, milestones, and contract records.'
  },
  {
    key: 'inspection_officer',
    name: 'Inspection Officer',
    description: 'Records delivery inspection, acceptance evidence, and performance observations.'
  },
  {
    key: 'payment_officer',
    name: 'Payment Officer',
    description: 'Tracks payment readiness and disbursement milestones after acceptance.'
  },
  {
    key: 'audit_oversight',
    name: 'Audit and Oversight',
    description: 'Reviews immutable audit trails and compliance reporting.'
  },
  {
    key: 'ict_admin',
    name: 'System Administration',
    description: 'Manages users, roles, workflow policy, and platform health.'
  }
];

export const internalModules: InternalModule[] = [
  {
    id: 'workflow-blueprint',
    title: 'Procurement Workflow Blueprint',
    section: 'Governance and Planning',
    description: 'Review the end-to-end APP, threshold, procurement, and oversight flow.',
    microservice: 'Workflow Blueprint Service',
    controlPurpose: 'Single source of truth for statutory routing and responsibilities.',
    allowedRoles: roles.map((role) => role.key)
  },
  {
    id: 'create-requisition',
    title: 'Create Requisition',
    section: 'Requisitioning Departments',
    description: 'Submit procurement requests with budget and justification metadata.',
    microservice: 'Requisition Service',
    controlPurpose: 'Controlled initiation of procurement.',
    allowedRoles: ['requisitioning_officer', 'department_head']
  },
  {
    id: 'requisition-history',
    title: 'Requisition History',
    section: 'Requisitioning Departments',
    description: 'View historical department requests and current workflow states.',
    microservice: 'Requisition Service',
    controlPurpose: 'Visibility without unauthorized control.',
    allowedRoles: ['requisitioning_officer', 'department_head']
  },
  {
    id: 'requisition-tracking',
    title: 'Requisition Tracking',
    section: 'Requisitioning Departments',
    description: 'Track routing progress across procurement, evaluation, and approvals.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Read-only timeline for accountable traceability.',
    allowedRoles: ['requisitioning_officer', 'department_head', 'complaints_review_officer', 'audit_oversight', 'admin']
  },
  {
    id: 'procurement-planning-committee',
    title: 'Planning Committee Review',
    section: 'Procurement Planning Committee',
    description: 'Review APP assumptions across planning, finance, legal, and procurement members.',
    microservice: 'Procurement Planning Service',
    controlPurpose: 'Section 21 planning committee visibility and pre-tender discipline.',
    allowedRoles: ['procurement_officer', 'procurement_manager', 'planning_statistics_officer', 'financial_unit_officer', 'legal_reviewer']
  },
  {
    id: 'annual-procurement-plan',
    title: 'Annual Procurement Plan (APP)',
    section: 'Procurement Unit',
    description: 'Create and maintain planning items aligned to statutory thresholds.',
    microservice: 'Procurement Planning Service',
    controlPurpose: 'Legal planning compliance and budget discipline.',
    allowedRoles: ['procurement_officer', 'procurement_manager', 'ict_admin', 'admin']
  },
  {
    id: 'create-tender',
    title: 'Create Tender',
    section: 'Procurement Unit',
    description: 'Draft tender packages, methods, and timelines before publication.',
    microservice: 'Tender Management Service',
    controlPurpose: 'Method and threshold enforcement.',
    allowedRoles: ['procurement_officer', 'procurement_manager']
  },
  {
    id: 'publish-tender',
    title: 'Publish Tender',
    section: 'Procurement Unit',
    description: 'Release approved tenders to the public portal at scheduled windows.',
    microservice: 'Tender Management Service',
    controlPurpose: 'Controlled public disclosure.',
    allowedRoles: ['procurement_officer', 'procurement_manager']
  },
  {
    id: 'bid-opening-session',
    title: 'Bid Opening Session',
    section: 'Procurement Unit',
    description: 'Open bids at scheduled deadlines with committee-level controls.',
    microservice: 'Bid Opening Service',
    controlPurpose: 'Timed and committee-controlled opening.',
    allowedRoles: ['procurement_officer', 'procurement_manager', 'technical_evaluator', 'financial_evaluator', 'evaluation_committee']
  },
  {
    id: 'assigned-tenders',
    title: 'Assigned Tenders',
    section: 'Evaluation Committees',
    description: 'List tenders assigned to the current committee for scoring.',
    microservice: 'Evaluation Service',
    controlPurpose: 'Controlled assignment and access.',
    allowedRoles: ['technical_evaluator', 'financial_evaluator', 'evaluation_committee']
  },
  {
    id: 'technical-evaluation',
    title: 'Technical Evaluation',
    section: 'Evaluation Committees',
    description: 'Score technical compliance against objective criteria.',
    microservice: 'Evaluation Service',
    controlPurpose: 'Objective technical scoring controls.',
    allowedRoles: ['technical_evaluator', 'evaluation_committee']
  },
  {
    id: 'financial-evaluation',
    title: 'Financial Evaluation',
    section: 'Evaluation Committees',
    description: 'Validate arithmetic accuracy and commercial competitiveness.',
    microservice: 'Evaluation Service',
    controlPurpose: 'Arithmetic and price validation.',
    allowedRoles: ['financial_evaluator', 'financial_unit_officer', 'evaluation_committee']
  },
  {
    id: 'evaluation-report',
    title: 'Evaluation Report',
    section: 'Evaluation Committees',
    description: 'Generate structured recommendations for approval workflows.',
    microservice: 'Evaluation Service',
    controlPurpose: 'Consolidated evaluation record.',
    allowedRoles: ['technical_evaluator', 'financial_evaluator', 'evaluation_committee', 'tenders_board', 'tenders_board_secretary']
  },
  {
    id: 'tender-review',
    title: 'Tender Review',
    section: 'Immigration Tender Board and Approvals',
    description: 'Review committee outputs, clarifications, and exceptions.',
    microservice: 'Approval Workflow Service',
    controlPurpose: 'Threshold-based approval governance.',
    allowedRoles: ['tenders_board', 'tenders_board_secretary']
  },
  {
    id: 'approval-rejection',
    title: 'Approval or Rejection',
    section: 'Immigration Tender Board and Approvals',
    description: 'Record board outcomes with mandatory rationale.',
    microservice: 'Approval Workflow Service',
    controlPurpose: 'Non-repudiable approval decisions.',
    allowedRoles: ['tenders_board', 'tenders_board_secretary']
  },
  {
    id: 'high-value-tenders',
    title: 'High-Value Tenders',
    section: 'Accounting Officer',
    description: 'Review tenders above delegated thresholds.',
    microservice: 'Approval Workflow Service',
    controlPurpose: 'Accounting Officer authority for high-value spend.',
    allowedRoles: ['accounting_officer']
  },
  {
    id: 'final-approval',
    title: 'Final Approval',
    section: 'Accounting Officer',
    description: 'Issue final approval for eligible procurements.',
    microservice: 'Approval Workflow Service',
    controlPurpose: 'Final statutory authority checkpoint.',
    allowedRoles: ['accounting_officer']
  },
  {
    id: 'bpp-escalation',
    title: 'BPP Escalation',
    section: 'Accounting Officer',
    description: 'Escalate required cases for no-objection workflows.',
    microservice: 'BPP Integration Service',
    controlPurpose: 'Regulatory compliance and external traceability.',
    allowedRoles: ['accounting_officer', 'bpp_liaison', 'bpp_reviewer']
  },
  {
    id: 'administrative-review',
    title: 'Administrative Review',
    section: 'Administrative Review',
    description: 'Track complaints, review petitions, and challenge resolution records.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Section 54 bidder review visibility and accountable resolution.',
    allowedRoles: ['complaints_review_officer', 'accounting_officer', 'bpp_reviewer', 'audit_oversight']
  },
  {
    id: 'contract-award',
    title: 'Contract Award',
    section: 'Post-Award Management',
    description: 'Publish award notices and transition to delivery controls.',
    microservice: 'Contract Management Service',
    controlPurpose: 'Award legality and contract traceability.',
    allowedRoles: ['procurement_officer', 'procurement_manager', 'accounting_officer', 'contract_manager']
  },
  {
    id: 'contract-management',
    title: 'Contract Management',
    section: 'Post-Award Management',
    description: 'Track milestones, variations, and completion status.',
    microservice: 'Contract Management Service',
    controlPurpose: 'Lifecycle governance and change discipline.',
    allowedRoles: ['procurement_officer', 'procurement_manager', 'accounting_officer', 'contract_manager']
  },
  {
    id: 'inspection-acceptance',
    title: 'Inspection and Acceptance',
    section: 'Post-Award Management',
    description: 'Record delivery verification before payment release.',
    microservice: 'Inspection Service',
    controlPurpose: 'Delivery verification and accountability.',
    allowedRoles: ['procurement_officer', 'inspection_officer', 'audit_oversight']
  },
  {
    id: 'payment-tracking',
    title: 'Payment Tracking',
    section: 'Post-Award Management',
    description: 'Monitor payment milestones against acceptance outcomes.',
    microservice: 'Payment Tracking Service',
    controlPurpose: 'Financial transparency and spend monitoring.',
    allowedRoles: ['accounting_officer', 'payment_officer', 'audit_oversight']
  },
  {
    id: 'audit-dashboard',
    title: 'Audit Dashboard',
    section: 'Audit and Oversight',
    description: 'Monitor compliance indicators across procurement lifecycle.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Oversight and investigation visibility.',
    allowedRoles: ['admin', 'complaints_review_officer', 'audit_oversight']
  },
  {
    id: 'audit-trail-viewer',
    title: 'Audit Trail Viewer',
    section: 'Audit and Oversight',
    description: 'Review immutable event logs and user action trails.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Immutable evidence for accountability.',
    allowedRoles: ['admin', 'bpp_liaison', 'bpp_reviewer', 'complaints_review_officer', 'audit_oversight']
  },
  {
    id: 'compliance-reports',
    title: 'Compliance Reports',
    section: 'Audit and Oversight',
    description: 'Generate compliance packs for management and regulators.',
    microservice: 'Audit and Compliance Service',
    controlPurpose: 'Formal governance reporting.',
    allowedRoles: ['admin', 'bpp_liaison', 'bpp_reviewer', 'complaints_review_officer', 'audit_oversight']
  },
  {
    id: 'user-role-management',
    title: 'User and Role Management',
    section: 'System Administration',
    description: 'Provision and maintain role-based access permissions.',
    microservice: 'Identity and Access Service',
    controlPurpose: 'Separation-of-duties enforcement.',
    allowedRoles: ['admin', 'ict_admin']
  },
  {
    id: 'workflow-configuration',
    title: 'Workflow Configuration',
    section: 'System Administration',
    description: 'Configure policy-controlled workflow routes and gates.',
    microservice: 'Workflow Orchestration Service',
    controlPurpose: 'Policy enforcement across process states.',
    allowedRoles: ['admin', 'ict_admin']
  },
  {
    id: 'system-monitoring',
    title: 'System Monitoring and Health',
    section: 'System Administration',
    description: 'Track service health, integration failures, and alerts.',
    microservice: 'Monitoring Service',
    controlPurpose: 'Operational oversight and resilience.',
    allowedRoles: ['admin', 'ict_admin']
  }
];
