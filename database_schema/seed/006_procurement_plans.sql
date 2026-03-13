-- Seed procurement plans (PostgreSQL)
INSERT INTO procurement_workflow.procurement_plans (
    plan_id,
    plan_title,
    department,
    fiscal_year,
    status,
    total_budget,
    notes,
    submitted_at,
    approved_at,
    created_by,
    updated_by
)
SELECT *
FROM (
    VALUES
        (
            '5f1d9d1a-2d6f-4c7d-9c1a-9d5c8e6a1a11'::UUID,
            'Annual Procurement Plan - HQ Operations',
            'Headquarters Operations',
            2026,
            'Approved',
            185000000.00,
            'Approved by accounting officer after compliance review.',
            NOW() - INTERVAL '40 days',
            NOW() - INTERVAL '25 days',
            'seed',
            'seed'
        ),
        (
            '9c33df2b-6a18-4a4f-9e90-2b4f89c2b102'::UUID,
            'Annual Procurement Plan - Border Control',
            'Border Control Directorate',
            2026,
            'Submitted',
            92000000.00,
            'Awaiting tenders board review.',
            NOW() - INTERVAL '18 days',
            NULL,
            'seed',
            'seed'
        ),
        (
            'c5b2f0d1-7a4a-4b3f-8e22-31c6e3e4d233'::UUID,
            'Annual Procurement Plan - ICT Modernization',
            'ICT Directorate',
            2026,
            'Draft',
            64000000.00,
            'Draft plan for data center refresh and endpoint security.',
            NULL,
            NULL,
            'seed',
            'seed'
        ),
        (
            '1a9f2e4e-6b24-4b6e-9a1f-0b7a9e2c4f44'::UUID,
            'Annual Procurement Plan - Training & Capacity',
            'Training and Capacity Building',
            2025,
            'Approved',
            27500000.00,
            'Approved with phased disbursement.',
            NOW() - INTERVAL '420 days',
            NOW() - INTERVAL '390 days',
            'seed',
            'seed'
        ),
        (
            '7d2a1e3b-9f64-4f31-8a3f-5b9d0d1e9f55'::UUID,
            'Annual Procurement Plan - Facilities Maintenance',
            'Facilities Management',
            2025,
            'Submitted',
            31000000.00,
            'Pending final approval after site audits.',
            NOW() - INTERVAL '360 days',
            NULL,
            'seed',
            'seed'
        ),
        (
            '3a8b5f1d-4c2e-4a6f-8d4e-6f1b2c3d4e66'::UUID,
            'Annual Procurement Plan - Legal Services',
            'Legal and Compliance',
            2026,
            'Draft',
            18000000.00,
            'Contract reviews and regulatory filings.',
            NULL,
            NULL,
            'seed',
            'seed'
        ),
        (
            '8e9f7c6d-5b4a-4c3d-9e2f-1a0b9c8d7e77'::UUID,
            'Annual Procurement Plan - Medical Services',
            'Medical Services Unit',
            2026,
            'Submitted',
            54000000.00,
            'Awaiting clinical procurement committee review.',
            NOW() - INTERVAL '12 days',
            NULL,
            'seed',
            'seed'
        ),
        (
            '4d3c2b1a-9f8e-4d7c-8b6a-5c4d3e2f1a88'::UUID,
            'Annual Procurement Plan - Vehicle Fleet Renewal',
            'Transport and Logistics',
            2026,
            'Approved',
            125000000.00,
            'Approved for phased vehicle replacement.',
            NOW() - INTERVAL '65 days',
            NOW() - INTERVAL '50 days',
            'seed',
            'seed'
        ),
        (
            'f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e99'::UUID,
            'Annual Procurement Plan - Border Surveillance',
            'Border Intelligence',
            2026,
            'Draft',
            210000000.00,
            'UAV and sensor network upgrades pending budget release.',
            NULL,
            NULL,
            'seed',
            'seed'
        ),
        (
            'aa11bb22-cc33-4d44-8e55-ff6677889900'::UUID,
            'Annual Procurement Plan - Records Digitization',
            'Records and Archives',
            2026,
            'Submitted',
            36000000.00,
            'Vendor shortlisting ongoing.',
            NOW() - INTERVAL '20 days',
            NULL,
            'seed',
            'seed'
        ),
        (
            'bb22cc33-dd44-4e55-8f66-001122334455'::UUID,
            'Annual Procurement Plan - Staff Housing',
            'Human Resources',
            2025,
            'Approved',
            98000000.00,
            'Approved with phased mobilization.',
            NOW() - INTERVAL '410 days',
            NOW() - INTERVAL '380 days',
            'seed',
            'seed'
        ),
        (
            'cc33dd44-ee55-4f66-8a77-112233445566'::UUID,
            'Annual Procurement Plan - Training Simulation Labs',
            'Training and Capacity Building',
            2026,
            'Submitted',
            47000000.00,
            'Awaiting vendor demonstrations.',
            NOW() - INTERVAL '8 days',
            NULL,
            'seed',
            'seed'
        ),
        (
            'dd44ee55-ff66-4a77-8b88-223344556677'::UUID,
            'Annual Procurement Plan - Energy Optimization',
            'Facilities Management',
            2026,
            'Draft',
            26000000.00,
            'Energy audit underway; scope still in review.',
            NULL,
            NULL,
            'seed',
            'seed'
        ),
        (
            'ee55ff66-aa77-4b88-8c99-334455667788'::UUID,
            'Annual Procurement Plan - Emergency Response',
            'Operations Command',
            2026,
            'Approved',
            73000000.00,
            'Approved for rapid response equipment refresh.',
            NOW() - INTERVAL '55 days',
            NOW() - INTERVAL '40 days',
            'seed',
            'seed'
        ),
        (
            'ff66aa77-bb88-4c99-8d00-445566778899'::UUID,
            'Annual Procurement Plan - Data Center Continuity',
            'ICT Directorate',
            2025,
            'Submitted',
            82000000.00,
            'Pending final risk assessment sign-off.',
            NOW() - INTERVAL '330 days',
            NULL,
            'seed',
            'seed'
        )
) AS seed_rows (
    plan_id,
    plan_title,
    department,
    fiscal_year,
    status,
    total_budget,
    notes,
    submitted_at,
    approved_at,
    created_by,
    updated_by
)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.procurement_plans p
    WHERE p.plan_title = seed_rows.plan_title
      AND p.department = seed_rows.department
      AND p.fiscal_year = seed_rows.fiscal_year
);
