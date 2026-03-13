-- Seed post-award inspections (PostgreSQL)
INSERT INTO post_award.inspections (
    inspection_id,
    inspection_code,
    contract_code,
    tender_title,
    vendor_name,
    status,
    scheduled_date,
    completed_date,
    inspector_name,
    outcome,
    location,
    notes,
    created_by,
    updated_by
)
SELECT *
FROM (
    VALUES
        (
            '8a1b2c3d-4e5f-4a6b-9c7d-0e1f2a3b4c01'::UUID,
            'INSP-2026-0009',
            'CON-2026-0104',
            'Training Simulation Labs',
            'SimuEdge Learning',
            'Scheduled',
            DATE '2026-03-10',
            NULL,
            'Ifeoma Okoro',
            'Pending',
            'Training Directorate - Lab 2',
            'Initial inspection planned with IT and training leads.',
            'seed',
            'seed'
        ),
        (
            '9b2c3d4e-5f60-4b7c-8d9e-1f2a3b4c5d02'::UUID,
            'INSP-2026-0014',
            'CON-2026-0112',
            'HQ Network Refresh',
            'NetCore Technologies',
            'In Progress',
            DATE '2026-03-04',
            NULL,
            'Chidi Nwankwo',
            'Pending',
            'HQ ICT Core Room',
            'Physical site walk-through and cabling checks ongoing.',
            'seed',
            'seed'
        ),
        (
            '0c3d4e5f-6071-4c8d-9e0f-2a3b4c5d6e03'::UUID,
            'INSP-2026-0019',
            'CON-2026-0120',
            'Vehicle Fleet Maintenance',
            'AutoShield Services',
            'Accepted',
            DATE '2026-02-18',
            DATE '2026-02-20',
            'Amina Yusuf',
            'Accepted',
            'Operations Fleet Yard',
            'Service completion verified; documentation archived.',
            'seed',
            'seed'
        ),
        (
            '1d4e5f60-7182-4d9e-0f1a-3b4c5d6e7f04'::UUID,
            'INSP-2026-0023',
            'CON-2026-0127',
            'Border Surveillance Sensor Maintenance',
            'Orion Security Systems Ltd',
            'Rejected',
            DATE '2026-03-01',
            DATE '2026-03-02',
            'Musa Ibrahim',
            'Rejected',
            'North Sector Surveillance Site',
            'Calibration report missing; re-inspection required.',
            'seed',
            'seed'
        )
) AS seed_rows (
    inspection_id,
    inspection_code,
    contract_code,
    tender_title,
    vendor_name,
    status,
    scheduled_date,
    completed_date,
    inspector_name,
    outcome,
    location,
    notes,
    created_by,
    updated_by
)
WHERE NOT EXISTS (
    SELECT 1
    FROM post_award.inspections i
    WHERE i.inspection_code = seed_rows.inspection_code
);
