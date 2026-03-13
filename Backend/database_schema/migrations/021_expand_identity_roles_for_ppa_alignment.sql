-- Migration 021: Expand identity roles for PPA-aligned workflow actors (PostgreSQL)
BEGIN;

INSERT INTO identity.roles (role_name, description)
VALUES
    ('PlanningStatisticsOfficer', 'Reviews procurement planning assumptions and annual plan coherence'),
    ('FinancialUnitOfficer', 'Validates budget readiness and financial control requirements'),
    ('LegalReviewer', 'Reviews legal compliance, bidding documents, and contract terms'),
    ('BPPReviewer', 'Reviews no-objection submissions and regulatory escalations'),
    ('ComplaintsReviewOfficer', 'Handles administrative review and bidder complaints')
ON CONFLICT (role_name) DO UPDATE
SET description = EXCLUDED.description;

COMMIT;
