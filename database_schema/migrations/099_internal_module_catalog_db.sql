-- Migration 099: Move Internal Module Catalog to Database
BEGIN;

-- 1. Create Internal Modules Table
CREATE TABLE IF NOT EXISTS identity.internal_modules (
    module_id VARCHAR(120) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    section VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    microservice VARCHAR(150) NOT NULL,
    control_purpose TEXT NOT NULL,
    actions TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Allowed Roles Table (Default Permissions)
CREATE TABLE IF NOT EXISTS identity.internal_module_allowed_roles (
    module_id VARCHAR(120) NOT NULL REFERENCES identity.internal_modules(module_id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (module_id, role_name)
);

-- 3. Seed Module Definitions
INSERT INTO identity.internal_modules (module_id, title, section, description, microservice, control_purpose, actions)
VALUES
    ('workflow-blueprint', 'Procurement Workflow Blueprint', 'Governance and Planning', 'Review the end-to-end APP, threshold, procurement, and oversight flow.', 'Workflow Blueprint Service', 'Single source of truth for statutory routing and responsibilities.', ARRAY['workflow_blueprint.view']),
    ('create-requisition', 'Create Requisition', 'Requisitioning Departments', 'Initiate departmental procurement requests with budget and requirement metadata.', 'Requisition Service', 'Controlled initiation of procurement.', ARRAY['requisition.create']),
    ('requisition-history', 'Requisition History', 'Requisitioning Departments', 'View historical department requests and current workflow states.', 'Requisition Service', 'Visibility without unauthorized control.', ARRAY['requisition.view']),
    ('requisition-tracking', 'Requisition Tracking', 'Requisitioning Departments', 'Track routing progress across procurement, evaluation, and approvals.', 'Audit and Compliance Service', 'Read-only timeline for accountable traceability.', ARRAY['requisition.track']),
    ('requisition-management', 'Requisition Management', 'Governance & Oversight', 'Administrative control over all departmental procurement requests, including hard deletion and state overrides.', 'Requisition Service', 'Ultimate administrative control over requisition lifecycle.', ARRAY['requisition.delete', 'requisition.view.all', 'requisition.update', 'requisition.view']),
    ('budget-workspace', 'Budget Workspace', 'Governance and Planning', 'Review budget alignment, appropriations, releases, commitments, and funding readiness for procurement workflow.', 'Budget Governance Service', 'Budget control before planning and approval progression.', ARRAY['budget.view', 'budget.confirm']),
    ('procurement-planning-committee', 'Planning Committee Review', 'Procurement Planning Committee', 'Review APP assumptions across planning, finance, legal, and procurement members.', 'Procurement Planning Service', 'Section 21 planning committee visibility and pre-tender discipline.', ARRAY['planning_committee.view']),
    ('needs-collection', 'Needs Collection', 'Procurement Planning', 'Collect and endorse procurement needs from formations and departments.', 'Procurement Planning Service', 'Pre-requisition needs identification and assessment.', ARRAY['needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate']),
    ('annual-procurement-plan', 'Annual Procurement Plan (APP)', 'Procurement Unit', 'Create and maintain planning items aligned to statutory thresholds.', 'Procurement Planning Service', 'Legal planning compliance and budget discipline.', ARRAY['procurement_plan.manage']),
    ('procurement-method-determination', 'Procurement Method Determination', 'Procurement Unit', 'Determine low-value procurement method and raise late method-change exceptions where required.', 'Workflow Orchestration Service', 'Controlled low-value method selection and exception governance.', ARRAY['method.determine']),
    ('create-tender', 'Tender Management', 'Procurement Unit', 'Create tender drafts from approved requisitions and publish draft tenders from one workspace.', 'Tender Management Service', 'Tender drafting, routing, and publication control.', ARRAY['tender.manage']),
    ('bid-opening-session', 'Bid Opening Session', 'Procurement Unit', 'Open bids at scheduled deadlines with committee-level controls.', 'Bid Opening Service', 'Timed and committee-controlled opening.', ARRAY['bid_opening.manage', 'bid_opening.view_detail', 'bid_opening.financial_view']),
    ('assigned-tenders', 'Assigned Tenders', 'Evaluation Committees', 'List tenders assigned to the current committee for scoring.', 'Evaluation Service', 'Controlled assignment and access.', ARRAY['evaluation.actions']),
    ('technical-evaluation', 'Technical Evaluation', 'Evaluation Committees', 'Score technical compliance against objective criteria.', 'Evaluation Service', 'Objective technical scoring controls.', ARRAY['evaluation.actions']),
    ('financial-evaluation', 'Financial Evaluation', 'Evaluation Committees', 'Validate arithmetic accuracy and commercial competitiveness.', 'Evaluation Service', 'Arithmetic and price validation.', ARRAY['evaluation.actions']),
    ('evaluation-report', 'Evaluation Report', 'Evaluation Committees', 'Generate structured recommendations for approval workflows.', 'Evaluation Service', 'Consolidated evaluation record.', ARRAY['evaluation_report.view']),
    ('tender-review', 'Tender Review', 'NIS Tenders Board and CGIS Approvals', 'Review committee outputs, clarifications, and exceptions for the NIS Tenders Board chaired by CGIS.', 'Approval Workflow Service', 'Threshold-based approval governance.', ARRAY['approval.review']),
    ('approval-rejection', 'Approval or Rejection', 'NIS Tenders Board and CGIS Approvals', 'Record board outcomes with mandatory rationale under the chairmanship of CGIS.', 'Approval Workflow Service', 'Non-repudiable approval decisions.', ARRAY['approval.decide']),
    ('high-value-tenders', 'High-Value Tenders', 'CGIS', 'Review tenders above delegated thresholds.', 'Approval Workflow Service', 'CGIS authority for high-value spend.', ARRAY['high_value_tenders.review']),
    ('cgis-approval', 'CGIS Approval', 'CGIS', 'Review departmental plans and other routed cases awaiting CGIS approval.', 'Approval Workflow Service', 'CGIS approval checkpoint before procurement can proceed.', ARRAY['high_value_tenders.review']),
    ('bpp-escalation', 'BPP Escalation', 'CGIS', 'Escalate required cases for no-objection workflows.', 'BPP Integration Service', 'Regulatory compliance and external traceability.', ARRAY['bpp.create', 'bpp.review']),
    ('administrative-review', 'Administrative Review', 'Administrative Review', 'Track complaints, review petitions, and challenge resolution records.', 'Audit and Compliance Service', 'Section 54 bidder review visibility and accountable resolution.', ARRAY['administrative_review.create', 'administrative_review.view', 'administrative_review.update', 'administrative_review.resolve']),
    ('contract-award', 'Contract Award', 'Post-Award Management', 'Publish award notices and transition to delivery controls.', 'Contract Management Service', 'Award legality and contract traceability.', ARRAY['contract_award.publish', 'contract_award.view']),
    ('contract-management', 'Contract Management', 'Post-Award Management', 'Track milestones, variations, and completion status.', 'Contract Management Service', 'Lifecycle governance and change discipline.', ARRAY['contract_management.manage']),
    ('inspection-acceptance', 'Inspection and Acceptance', 'Post-Award Management', 'Record delivery verification before payment release.', 'Inspection Service', 'Delivery verification and accountability.', ARRAY['inspection.view', 'inspection.update']),
    ('payment-tracking', 'Payment Tracking', 'Post-Award Management', 'Monitor payment milestones against acceptance outcomes.', 'Payment Tracking Service', 'Financial transparency and spend monitoring.', ARRAY['payment_tracking.view', 'closeout.create']),
    ('audit-dashboard', 'Audit Dashboard', 'Audit and Oversight', 'Monitor compliance indicators across procurement lifecycle.', 'Audit and Compliance Service', 'Oversight and investigation visibility.', ARRAY['audit_dashboard.view']),
    ('audit-trail-viewer', 'Audit Trail Viewer', 'Audit and Oversight', 'Review immutable event logs and user action trails.', 'Audit and Compliance Service', 'Immutable evidence for accountability.', ARRAY['audit_trail.view']),
    ('compliance-reports', 'Compliance Reports', 'Audit and Oversight', 'Generate compliance packs for management and regulators.', 'Audit and Compliance Service', 'Formal governance reporting.', ARRAY['compliance_reports.view']),
    ('user-role-management', 'User and Role Management', 'System Administration', 'Provision and maintain role-based access permissions.', 'Identity and Access Service', 'Separation-of-duties enforcement.', ARRAY['admin.manage_roles']),
    ('vendor-registration-approval', 'Vendor Registration Approval', 'System Administration', 'Review vendor onboarding submissions, inspect compliance uploads, and activate approved suppliers.', 'Vendor Sourcing Service', 'Controlled activation of external supplier accounts.', ARRAY['admin.vendor_approval']),
    ('workflow-configuration', 'Workflow Configuration', 'System Administration', 'Configure policy-controlled workflow routes and gates.', 'Workflow Orchestration Service', 'Policy enforcement across process states.', ARRAY['admin.manage_workflows']),
    ('system-monitoring', 'System Monitoring and Health', 'System Administration', 'Track service health, integration failures, and alerts.', 'Monitoring Service', 'Operational oversight and resilience.', ARRAY['admin.monitor']),
    ('user-profile', 'User Profile', 'Account Management', 'View and manage your internal user profile and credentials.', 'Identity Service', 'Personal account management.', ARRAY['profile.view', 'profile.update'])
ON CONFLICT (module_id) DO UPDATE 
SET title = EXCLUDED.title, 
    section = EXCLUDED.section, 
    description = EXCLUDED.description, 
    microservice = EXCLUDED.microservice, 
    control_purpose = EXCLUDED.control_purpose, 
    actions = EXCLUDED.actions;

-- 4. Seed Allowed Roles (Matching InternalModuleCatalog.cs logic)
INSERT INTO identity.internal_module_allowed_roles (module_id, role_name)
VALUES
    ('workflow-blueprint', 'Admin'), ('workflow-blueprint', 'SystemAdministrator'), ('workflow-blueprint', 'RequisitioningOfficer'), ('workflow-blueprint', 'DepartmentHead'),
    ('create-requisition', 'RequisitioningOfficer'), ('create-requisition', 'DepartmentHead'),
    ('requisition-history', 'RequisitioningOfficer'), ('requisition-history', 'DepartmentHead'),
    ('requisition-tracking', 'RequisitioningOfficer'), ('requisition-tracking', 'DepartmentHead'), ('requisition-tracking', 'ComplaintsReviewOfficer'), ('requisition-tracking', 'AuditOfficer'), ('requisition-tracking', 'Admin'),
    ('requisition-management', 'Admin'), ('requisition-management', 'ComptrollerProcurement'),
    ('budget-workspace', 'FinancialUnitOfficer'), ('budget-workspace', 'AccountingOfficer'), ('budget-workspace', 'Admin'),
    ('procurement-planning-committee', 'Admin'), ('procurement-planning-committee', 'ComptrollerProcurement'), ('procurement-planning-committee', 'PlanningStatisticsOfficer'), ('procurement-planning-committee', 'FinancialUnitOfficer'), ('procurement-planning-committee', 'LegalReviewer'), ('procurement-planning-committee', 'DepartmentHead'), ('procurement-planning-committee', 'ProcurementSecretary'),
    ('needs-collection', 'FormationOfficer'), ('needs-collection', 'FormationHead'), ('needs-collection', 'RequisitioningOfficer'), ('needs-collection', 'DepartmentHead'), ('needs-collection', 'ComptrollerProcurement'), ('needs-collection', 'Admin'),
    ('annual-procurement-plan', 'ComptrollerProcurement'), ('annual-procurement-plan', 'ProcurementSecretary'), ('annual-procurement-plan', 'SystemAdministrator'), ('annual-procurement-plan', 'Admin'),
    ('procurement-method-determination', 'ComptrollerProcurement'), ('procurement-method-determination', 'Admin'),
    ('create-tender', 'ComptrollerProcurement'), ('create-tender', 'ProcurementManager'),
    ('bid-opening-session', 'ComptrollerProcurement'), ('bid-opening-session', 'ProcurementManager'), ('bid-opening-session', 'SystemAdministrator'), ('bid-opening-session', 'Admin'), ('bid-opening-session', 'FinancialEvaluator'), ('bid-opening-session', 'TechnicalEvaluator'), ('bid-opening-session', 'EvaluationCommittee'),
    ('assigned-tenders', 'TechnicalEvaluator'), ('assigned-tenders', 'FinancialEvaluator'), ('assigned-tenders', 'EvaluationCommittee'),
    ('technical-evaluation', 'TechnicalEvaluator'), ('technical-evaluation', 'EvaluationCommittee'),
    ('financial-evaluation', 'FinancialEvaluator'), ('financial-evaluation', 'FinancialUnitOfficer'), ('financial-evaluation', 'EvaluationCommittee'),
    ('evaluation-report', 'TechnicalEvaluator'), ('evaluation-report', 'FinancialEvaluator'), ('evaluation-report', 'EvaluationCommittee'), ('evaluation-report', 'TendersBoardMember'), ('evaluation-report', 'TendersBoardSecretary'),
    ('tender-review', 'TendersBoardMember'), ('tender-review', 'TendersBoardSecretary'),
    ('approval-rejection', 'TendersBoardMember'), ('approval-rejection', 'TendersBoardSecretary'),
    ('high-value-tenders', 'AccountingOfficer'),
    ('cgis-approval', 'AccountingOfficer'), ('cgis-approval', 'Admin'),
    ('bpp-escalation', 'AccountingOfficer'), ('bpp-escalation', 'BPPLiaison'), ('bpp-escalation', 'BPPReviewer'),
    ('administrative-review', 'ComplaintsReviewOfficer'), ('administrative-review', 'AccountingOfficer'), ('administrative-review', 'BPPReviewer'), ('administrative-review', 'AuditOfficer'), ('administrative-review', 'ComptrollerProcurement'), ('administrative-review', 'TechnicalEvaluator'), ('administrative-review', 'FinancialEvaluator'), ('administrative-review', 'EvaluationCommittee'),
    ('contract-award', 'ComptrollerProcurement'), ('contract-award', 'ProcurementManager'), ('contract-award', 'AccountingOfficer'), ('contract-award', 'ContractManager'),
    ('contract-management', 'ComptrollerProcurement'), ('contract-management', 'ProcurementManager'), ('contract-management', 'AccountingOfficer'), ('contract-management', 'ContractManager'),
    ('inspection-acceptance', 'ComptrollerProcurement'), ('inspection-acceptance', 'InspectionOfficer'), ('inspection-acceptance', 'AuditOfficer'),
    ('payment-tracking', 'AccountingOfficer'), ('payment-tracking', 'PaymentOfficer'), ('payment-tracking', 'AuditOfficer'),
    ('audit-dashboard', 'Admin'), ('audit-dashboard', 'ComplaintsReviewOfficer'), ('audit-dashboard', 'AuditOfficer'),
    ('audit-trail-viewer', 'Admin'), ('audit-trail-viewer', 'BPPLiaison'), ('audit-trail-viewer', 'BPPReviewer'), ('audit-trail-viewer', 'ComplaintsReviewOfficer'), ('audit-trail-viewer', 'AuditOfficer'),
    ('compliance-reports', 'Admin'), ('compliance-reports', 'BPPLiaison'), ('compliance-reports', 'BPPReviewer'), ('compliance-reports', 'ComplaintsReviewOfficer'), ('compliance-reports', 'AuditOfficer'),
    ('user-role-management', 'Admin'), ('user-role-management', 'SystemAdministrator'),
    ('vendor-registration-approval', 'Admin'), ('vendor-registration-approval', 'SystemAdministrator'),
    ('workflow-configuration', 'Admin'), ('workflow-configuration', 'SystemAdministrator'),
    ('system-monitoring', 'Admin'), ('system-monitoring', 'SystemAdministrator'),
    ('user-profile', 'Admin'), ('user-profile', 'SystemAdministrator'), ('user-profile', 'RequisitioningOfficer'), ('user-profile', 'DepartmentHead'), ('user-profile', 'ComptrollerProcurement'), ('user-profile', 'ProcurementManager'), ('user-profile', 'PlanningStatisticsOfficer'), ('user-profile', 'FinancialUnitOfficer'), ('user-profile', 'ProcurementSecretary'), ('user-profile', 'LegalReviewer'), ('user-profile', 'TechnicalEvaluator'), ('user-profile', 'FinancialEvaluator'), ('user-profile', 'EvaluationCommittee'), ('user-profile', 'TendersBoardMember'), ('user-profile', 'TendersBoardSecretary'), ('user-profile', 'AccountingOfficer'), ('user-profile', 'BPPLiaison'), ('user-profile', 'BPPReviewer'), ('user-profile', 'ComplaintsReviewOfficer'), ('user-profile', 'ContractManager'), ('user-profile', 'InspectionOfficer'), ('user-profile', 'PaymentOfficer'), ('user-profile', 'AuditOfficer'), ('user-profile', 'FormationOfficer'), ('user-profile', 'FormationHead')
ON CONFLICT (module_id, role_name) DO NOTHING;

COMMIT;
