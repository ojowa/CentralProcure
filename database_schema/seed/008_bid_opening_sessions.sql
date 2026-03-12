-- Seed bid opening sessions (PostgreSQL)
INSERT INTO vendor_sourcing.bid_opening_sessions (
    session_id,
    tender_id,
    session_title,
    location,
    scheduled_at,
    status,
    opened_at,
    closed_at,
    notes,
    created_by,
    updated_by
)
SELECT *
FROM (
    VALUES
        (
            '11111111-1111-4111-8111-111111111111'::UUID,
            '4e5c2a1f-8b5f-4c3a-9c2f-1a2b3c4d5e01'::UUID,
            'Border Surveillance Bid Opening',
            'Abuja HQ - Main Hall',
            NOW() + INTERVAL '5 days',
            'Scheduled',
            NULL,
            NULL,
            'Committee to convene 30 minutes before.',
            'seed',
            'seed'
        ),
        (
            '22222222-2222-4222-8222-222222222222'::UUID,
            '6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b02'::UUID,
            'HQ Network Refresh Opening',
            'ICT Board Room',
            NOW() + INTERVAL '12 days',
            'Scheduled',
            NULL,
            NULL,
            'Awaiting tender publication.',
            'seed',
            'seed'
        ),
        (
            '33333333-3333-4333-8333-333333333333'::UUID,
            '7a6b5c4d-3e2f-4a1b-8c7d-6e5f4a3b2c03'::UUID,
            'Passport Supplies Opening Session',
            'Procurement Room 2',
            NOW() - INTERVAL '1 day',
            'Open',
            NOW() - INTERVAL '23 hours',
            NULL,
            'Bids are being opened by committee.',
            'seed',
            'seed'
        ),
        (
            '44444444-4444-4444-8444-444444444444'::UUID,
            '8c9d0e1f-2a3b-4c5d-8e9f-0a1b2c3d4e04'::UUID,
            'Vehicle Fleet Maintenance Opening',
            'Operations Wing',
            NOW() - INTERVAL '90 days',
            'Closed',
            NOW() - INTERVAL '89 days 22 hours',
            NOW() - INTERVAL '89 days 20 hours',
            'Opening concluded, evaluation underway.',
            'seed',
            'seed'
        ),
        (
            '55555555-5555-4555-8555-555555555555'::UUID,
            '9d8c7b6a-5f4e-4d3c-8b2a-1c0d9e8f7a05'::UUID,
            'Data Center UPS Bid Opening',
            'ICT Conference Room',
            NOW() - INTERVAL '130 days',
            'Closed',
            NOW() - INTERVAL '129 days 22 hours',
            NOW() - INTERVAL '129 days 20 hours',
            'Session closed and archived.',
            'seed',
            'seed'
        ),
        (
            '66666666-6666-4666-8666-666666666666'::UUID,
            '0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06'::UUID,
            'Border Post Renovation Opening',
            'Kaduna Regional Office',
            NOW() + INTERVAL '9 days',
            'Scheduled',
            NULL,
            NULL,
            'Regional procurement leads to attend.',
            'seed',
            'seed'
        ),
        (
            '77777777-7777-4777-8777-777777777777'::UUID,
            '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d07'::UUID,
            'Biometric Kits Opening',
            'Training Hall',
            NOW() + INTERVAL '20 days',
            'Cancelled',
            NULL,
            NULL,
            'Tender deferred pending budget review.',
            'seed',
            'seed'
        ),
        (
            '88888888-8888-4888-8888-888888888888'::UUID,
            '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e08'::UUID,
            'Energy Optimization Opening',
            'Facilities Office',
            NOW() - INTERVAL '170 days',
            'Cancelled',
            NULL,
            NULL,
            'Project cancelled by management.',
            'seed',
            'seed'
        ),
        (
            '99999999-9999-4999-8999-999999999999'::UUID,
            '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f09'::UUID,
            'Patrol Boats Opening',
            'Marine Operations Hub',
            NOW() - INTERVAL '2 days',
            'Open',
            NOW() - INTERVAL '1 day 20 hours',
            NULL,
            'Committee currently reviewing bids.',
            'seed',
            'seed'
        ),
        (
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::UUID,
            '4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10'::UUID,
            'Training Labs Opening',
            'Training Directorate Hall',
            NOW() + INTERVAL '6 days',
            'Scheduled',
            NULL,
            NULL,
            'Invite evaluation committee members.',
            'seed',
            'seed'
        )
) AS seed_rows (
    session_id,
    tender_id,
    session_title,
    location,
    scheduled_at,
    status,
    opened_at,
    closed_at,
    notes,
    created_by,
    updated_by
)
WHERE NOT EXISTS (
    SELECT 1
    FROM vendor_sourcing.bid_opening_sessions s
    WHERE s.session_title = seed_rows.session_title
      AND s.tender_id = seed_rows.tender_id
);
