-- Migration 064: Add planning committee-specific roles
BEGIN;

INSERT INTO identity.roles (role_name, description)
VALUES
    ('ProcurementSecretary', 'Planning committee secretary who records decisions and minutes'),
    ('ComptrollerProcurement', 'Chair of the planning committee and head of procurement approval')
ON CONFLICT (role_name) DO NOTHING;

COMMIT;
