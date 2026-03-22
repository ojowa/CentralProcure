-- Seed default internal roles (PostgreSQL)
INSERT INTO identity.roles (role_name, description)
VALUES
    ('Admin', 'System administrator'),
    ('RequisitioningOfficer', 'Initiates and tracks requisitions'),
    ('DepartmentHead', 'Approves departmental requisitions'),
    ('ComptrollerProcurement', 'Maintains APP, creates and publishes tenders, manages bid opening'),
    ('ProcurementManager', 'Oversees procurement operations and compliance'),
    ('TechnicalEvaluator', 'Performs technical evaluation only'),
    ('FinancialEvaluator', 'Performs financial evaluation only'),
    ('TendersBoardMember', 'Reviews evaluation outcomes and approves/rejects'),
    ('TendersBoardSecretary', 'Manages board records and submissions'),
    ('AccountingOfficer', 'Final approval for high-value procurements'),
    ('BPPLiaison', 'Manages BPP No-Objection submissions'),
    ('BPPReviewer', 'Reviews no-objection submissions and regulatory escalations'),
    ('PlanningStatisticsOfficer', 'Reviews procurement planning assumptions and annual plan coherence'),
    ('FinancialUnitOfficer', 'Validates budget readiness and financial control requirements'),
    ('LegalReviewer', 'Reviews legal compliance, bidding documents, and contract terms'),
    ('ProcurementSecretary', 'Planning committee secretary who records decisions and minutes'),
    ('ComptrollerProcurement', 'Chair of the planning committee and head of procurement approval'),
    ('ComplaintsReviewOfficer', 'Handles administrative review and bidder complaints'),
    ('ContractManager', 'Manages awards and contract administration'),
    ('InspectionOfficer', 'Records inspection and acceptance'),
    ('PaymentOfficer', 'Tracks payment status post-acceptance'),
    ('AuditOfficer', 'Read-only audit and compliance access'),
    ('SystemAdministrator', 'User, role, and system configuration management')
ON CONFLICT (role_name) DO NOTHING;

