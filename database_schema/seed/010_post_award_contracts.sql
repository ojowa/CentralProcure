-- Seed post-award contracts and awards (PostgreSQL)
INSERT INTO post_award.contract_awards (
    award_id,
    award_code,
    tender_title,
    vendor_name,
    award_value,
    status,
    award_date,
    contract_start,
    contract_end,
    funding_source,
    notes,
    published_at,
    created_by,
    updated_by
)
SELECT *
FROM (
    VALUES
        (
            '0d5f8f38-5f67-4a6d-a7f1-3f6af401c201'::UUID,
            'AWD-2026-0012',
            'Border Surveillance Sensor Maintenance',
            'Orion Security Systems Ltd',
            340000000.00,
            'Pending Approval',
            DATE '2026-02-16',
            DATE '2026-03-15',
            DATE '2027-03-14',
            'Security Operations',
            'Awaiting accounting officer approval and BPP filing.',
            NULL,
            'seed',
            'seed'
        ),
        (
            '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02'::UUID,
            'AWD-2026-0021',
            'HQ Network Refresh',
            'NetCore Technologies',
            90000000.00,
            'Approved',
            DATE '2026-02-05',
            DATE '2026-03-01',
            DATE '2026-09-01',
            'Capital Budget FY2026',
            'Ready for publication to vendor portal.',
            NULL,
            'seed',
            'seed'
        ),
        (
            '2b3c4d5e-6f70-4b8c-9d0e-1f2a3b4c5d03'::UUID,
            'AWD-2026-0027',
            'Training Simulation Labs',
            'SimuEdge Learning',
            47000000.00,
            'Published',
            DATE '2026-01-24',
            DATE '2026-02-20',
            DATE '2026-08-20',
            'Training Budget FY2026',
            'Mobilization underway; delivery kickoff scheduled.',
            NOW() - INTERVAL '15 days',
            'seed',
            'seed'
        ),
        (
            '3c4d5e6f-7081-4c9d-a0e1-2f3a4b5c6d04'::UUID,
            'AWD-2026-0033',
            'Vehicle Fleet Maintenance',
            'AutoShield Services',
            42000000.00,
            'Draft',
            DATE '2026-02-27',
            DATE '2026-04-01',
            DATE '2027-04-01',
            'Transport & Logistics',
            'Draft award notice pending internal review.',
            NULL,
            'seed',
            'seed'
        )
) AS seed_rows (
    award_id,
    award_code,
    tender_title,
    vendor_name,
    award_value,
    status,
    award_date,
    contract_start,
    contract_end,
    funding_source,
    notes,
    published_at,
    created_by,
    updated_by
)
WHERE NOT EXISTS (
    SELECT 1
    FROM post_award.contract_awards a
    WHERE a.award_code = seed_rows.award_code
);

INSERT INTO post_award.contracts (
    contract_id,
    contract_code,
    tender_title,
    vendor_name,
    contract_value,
    status,
    start_date,
    end_date,
    progress,
    contract_manager,
    notes,
    created_by,
    updated_by
)
SELECT *
FROM (
    VALUES
        (
            '4d5e6f70-8192-4d0e-b1f2-3a4b5c6d7e05'::UUID,
            'CON-2026-0104',
            'Training Simulation Labs',
            'SimuEdge Learning',
            47000000.00,
            'Active',
            DATE '2026-02-20',
            DATE '2026-08-20',
            38,
            'Amina Yusuf',
            'Phase 1 hardware delivery completed; software licensing in progress.',
            'seed',
            'seed'
        ),
        (
            '5e6f7081-92a3-4e1f-b2c3-4d5e6f708f06'::UUID,
            'CON-2026-0112',
            'HQ Network Refresh',
            'NetCore Technologies',
            90000000.00,
            'On Hold',
            DATE '2026-03-01',
            DATE '2026-09-01',
            22,
            'Chinedu Okafor',
            'Hold placed pending revised cabling scope approval.',
            'seed',
            'seed'
        ),
        (
            '6f708192-a3b4-4f20-b3d4-5e6f70819207'::UUID,
            'CON-2026-0120',
            'Vehicle Fleet Maintenance',
            'AutoShield Services',
            42000000.00,
            'Completed',
            DATE '2025-04-01',
            DATE '2026-04-01',
            100,
            'Grace Udo',
            'All service milestones completed and accepted.',
            'seed',
            'seed'
        ),
        (
            '708192a3-b4c5-4021-b4e5-6f708192a308'::UUID,
            'CON-2026-0127',
            'Border Surveillance Sensor Maintenance',
            'Orion Security Systems Ltd',
            340000000.00,
            'Active',
            DATE '2026-03-15',
            DATE '2027-03-14',
            12,
            'Ibrahim Musa',
            'Mobilization underway; preventive maintenance schedule agreed.',
            'seed',
            'seed'
        )
) AS seed_rows (
    contract_id,
    contract_code,
    tender_title,
    vendor_name,
    contract_value,
    status,
    start_date,
    end_date,
    progress,
    contract_manager,
    notes,
    created_by,
    updated_by
)
WHERE NOT EXISTS (
    SELECT 1
    FROM post_award.contracts c
    WHERE c.contract_code = seed_rows.contract_code
);
