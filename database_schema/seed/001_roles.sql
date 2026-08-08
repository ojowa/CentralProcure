-- Seed default internal roles (PostgreSQL)
-- role_key is the single source of truth used across the app and workflow
-- tables; role_name is the display label. The system-administrator role is
-- unified into a single "Admin" role.
INSERT INTO identity.roles (role_name, role_key, description)
VALUES
    ('Admin', 'admin', 'System administrator'),
    ('DepartmentHead', 'department_head', 'Reviews and endorses departmental procurement needs'),
    ('Head of Procurement', 'comptroller_procurement', 'Chairs planning committee review, approves the APP, and leads procurement execution controls'),
    ('ProcurementManager', 'procurement_manager', 'Oversees procurement operations and compliance'),
    ('PlanningStatisticsOfficer', 'planning_statistics_officer', 'Reviews procurement planning assumptions and annual plan coherence'),
    ('FinancialUnitOfficer', 'financial_unit_officer', 'Validates budget readiness and financial control requirements'),
    ('ProcurementSecretary', 'procurement_secretary', 'Planning committee secretary who records decisions and minutes'),
    ('LegalReviewer', 'legal_reviewer', 'Reviews legal compliance, bidding documents, and contract terms'),
    ('TechnicalEvaluator', 'technical_evaluator', 'Performs technical evaluation only'),
    ('FinancialEvaluator', 'financial_evaluator', 'Performs financial evaluation only'),
    ('TendersBoardMember', 'tenders_board', 'Reviews evaluation outcomes and approves/rejects'),
    ('TendersBoardSecretary', 'tenders_board_secretary', 'Manages board records and submissions'),
    ('CGIS', 'accounting_officer', 'Comptroller General of Immigration Service approval authority for direct CGIS approval and related executive decisions'),
    ('BPPLiaison', 'bpp_liaison', 'Manages BPP No-Objection submissions'),
    ('BPPReviewer', 'bpp_reviewer', 'Reviews no-objection submissions and regulatory escalations'),
    ('FormationHead', 'formation_head', 'Head of the NIS formation responsible for endorsing needs'),
    ('FormationOfficer', 'formation_officer', 'Officer responsible for procurement needs at the formation level'),
    ('ComplaintsReviewOfficer', 'complaints_review_officer', 'Handles administrative review and bidder complaints'),
    ('ContractManager', 'contract_manager', 'Manages awards and contract administration'),
    ('InspectionOfficer', 'inspection_officer', 'Records inspection and acceptance'),
    ('PaymentOfficer', 'payment_officer', 'Tracks payment status post-acceptance'),
    ('AuditOfficer', 'audit_oversight', 'Read-only audit and compliance access')
ON CONFLICT (role_name) DO NOTHING;