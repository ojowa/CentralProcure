-- Seed requisitions (PostgreSQL)
INSERT INTO procurement_workflow.requisitions (
    requisition_id,
    title,
    department,
    status,
    priority,
    procurement_type,
    funding_source,
    budget_code,
    project_code,
    required_by,
    delivery_location,
    justification,
    risk_notes,
    total_estimate,
    current_stage,
    created_by,
    created_at,
    updated_by,
    updated_at
)
SELECT *
FROM (
    VALUES
        (
            'b3f5a4d1-3c2a-4f8b-9f1a-01f2c3d4e501'::UUID,
            'Emergency Communication Radios',
            'Operations Command',
            'Submitted',
            'Urgent',
            'Goods',
            'Operational Budget FY2026',
            'OPS-EMR-26',
            'COMMS-REFRESH',
            NOW() + INTERVAL '21 days',
            'Operations Command Warehouse - HQ',
            'Replace end-of-life radios to maintain field coverage.',
            'Delays will reduce response readiness for border teams.',
            518000.00,
            procurement_workflow.resolve_requisition_stage('Submitted'),
            'seed',
            NOW() - INTERVAL '12 days',
            'seed',
            NOW() - INTERVAL '10 days'
        ),
        (
            'c4e7b2f0-7d39-4b1c-9e2d-02a3b4c5d602'::UUID,
            'Data Center Backup Storage Expansion',
            'ICT Directorate',
            'Draft',
            'Strategic',
            'Goods',
            'Capital Budget FY2026',
            'ICT-DC-26',
            'STOR-EXP',
            NOW() + INTERVAL '60 days',
            'Primary Data Center - Abuja',
            'Support increased backup retention and disaster recovery.',
            'Storage shortfall may impact compliance retention windows.',
            443000.00,
            procurement_workflow.resolve_requisition_stage('Draft'),
            'seed',
            NOW() - INTERVAL '6 days',
            'seed',
            NOW() - INTERVAL '6 days'
        ),
        (
            'd5a8c3e1-8e4a-4d2b-8f3e-03b4c5d6e703'::UUID,
            'Border Surveillance Sensor Maintenance',
            'Border Intelligence',
            'Evaluation',
            'Normal',
            'Services',
            'Security Operations',
            'BI-SENS-26',
            'SENS-MAINT',
            NOW() + INTERVAL '30 days',
            'Border Surveillance Sites - North Sector',
            'Maintain sensor uptime and calibration during peak season.',
            'Service gaps will increase false alerts and downtime.',
            340000.00,
            procurement_workflow.resolve_requisition_stage('Evaluation'),
            'seed',
            NOW() - INTERVAL '20 days',
            'seed',
            NOW() - INTERVAL '15 days'
        ),
        (
            'e6b9d4f2-9f5b-4e3c-7a4f-04c5d6e7f804'::UUID,
            'Headquarters HVAC Overhaul',
            'Facilities Management',
            'Approved',
            'Strategic',
            'Works',
            'Facilities Renewal',
            'FAC-HVAC-26',
            'HVAC-OVER',
            NOW() + INTERVAL '120 days',
            'HQ Campus - Main Building',
            'Replace failing HVAC systems to reduce outages.',
            'Failure to execute may cause operational disruptions.',
            900000.00,
            procurement_workflow.resolve_requisition_stage('Approved'),
            'seed',
            NOW() - INTERVAL '35 days',
            'seed',
            NOW() - INTERVAL '22 days'
        ),
        (
            'f7c0e5a3-a06c-4f4d-6b5a-05d6e7f8a905'::UUID,
            'Training Lab Workstations',
            'Training and Capacity Building',
            'Under Review',
            'Normal',
            'Goods',
            'Training Budget FY2026',
            'TRN-LAB-26',
            'LAB-PC',
            NOW() + INTERVAL '45 days',
            'Training Directorate - Lab 2',
            'Upgrade end-user devices for simulation labs.',
            'Delays will affect scheduled cohort training.',
            148800.00,
            procurement_workflow.resolve_requisition_stage('Under Review'),
            'seed',
            NOW() - INTERVAL '9 days',
            'seed',
            NOW() - INTERVAL '8 days'
        )
) AS seed_rows (
    requisition_id,
    title,
    department,
    status,
    priority,
    procurement_type,
    funding_source,
    budget_code,
    project_code,
    required_by,
    delivery_location,
    justification,
    risk_notes,
    total_estimate,
    current_stage,
    created_by,
    created_at,
    updated_by,
    updated_at
)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.requisitions r
    WHERE r.title = seed_rows.title
      AND r.department = seed_rows.department
);

-- Seed requisition line items (PostgreSQL)
INSERT INTO procurement_workflow.requisition_line_items (
    requisition_id,
    item_code,
    description,
    unit,
    quantity,
    unit_cost,
    created_at,
    updated_at
)
SELECT *
FROM (
    VALUES
        (
            'b3f5a4d1-3c2a-4f8b-9f1a-01f2c3d4e501'::UUID,
            'RAD-HH-01',
            'Handheld VHF radios',
            'each',
            150.00,
            2100.00,
            NOW() - INTERVAL '12 days',
            NOW() - INTERVAL '10 days'
        ),
        (
            'b3f5a4d1-3c2a-4f8b-9f1a-01f2c3d4e501'::UUID,
            'RAD-RPT-01',
            'Portable repeater kits',
            'each',
            20.00,
            9500.00,
            NOW() - INTERVAL '12 days',
            NOW() - INTERVAL '10 days'
        ),
        (
            'b3f5a4d1-3c2a-4f8b-9f1a-01f2c3d4e501'::UUID,
            'RAD-BAT-01',
            'Spare battery packs',
            'each',
            200.00,
            65.00,
            NOW() - INTERVAL '12 days',
            NOW() - INTERVAL '10 days'
        ),
        (
            'c4e7b2f0-7d39-4b1c-9e2d-02a3b4c5d602'::UUID,
            'STOR-ARR-01',
            'Storage arrays (250TB)',
            'each',
            6.00,
            48000.00,
            NOW() - INTERVAL '6 days',
            NOW() - INTERVAL '6 days'
        ),
        (
            'c4e7b2f0-7d39-4b1c-9e2d-02a3b4c5d602'::UUID,
            'NET-MOD-02',
            'SAN switch modules',
            'each',
            12.00,
            7500.00,
            NOW() - INTERVAL '6 days',
            NOW() - INTERVAL '6 days'
        ),
        (
            'c4e7b2f0-7d39-4b1c-9e2d-02a3b4c5d602'::UUID,
            'PRO-SVC-01',
            'Implementation services',
            'lot',
            1.00,
            65000.00,
            NOW() - INTERVAL '6 days',
            NOW() - INTERVAL '6 days'
        ),
        (
            'd5a8c3e1-8e4a-4d2b-8f3e-03b4c5d6e703'::UUID,
            'SVC-MAINT-01',
            'Annual sensor maintenance service',
            'lot',
            1.00,
            240000.00,
            NOW() - INTERVAL '20 days',
            NOW() - INTERVAL '15 days'
        ),
        (
            'd5a8c3e1-8e4a-4d2b-8f3e-03b4c5d6e703'::UUID,
            'SENS-SPARE-01',
            'Spare ground sensors',
            'each',
            40.00,
            2500.00,
            NOW() - INTERVAL '20 days',
            NOW() - INTERVAL '15 days'
        ),
        (
            'e6b9d4f2-9f5b-4e3c-7a4f-04c5d6e7f804'::UUID,
            'HVAC-CHILL-01',
            'Chiller replacement units',
            'each',
            2.00,
            180000.00,
            NOW() - INTERVAL '35 days',
            NOW() - INTERVAL '22 days'
        ),
        (
            'e6b9d4f2-9f5b-4e3c-7a4f-04c5d6e7f804'::UUID,
            'HVAC-AHU-01',
            'Air handling units',
            'each',
            6.00,
            55000.00,
            NOW() - INTERVAL '35 days',
            NOW() - INTERVAL '22 days'
        ),
        (
            'e6b9d4f2-9f5b-4e3c-7a4f-04c5d6e7f804'::UUID,
            'HVAC-CTRL-01',
            'Controls, ducting, and commissioning',
            'lot',
            1.00,
            210000.00,
            NOW() - INTERVAL '35 days',
            NOW() - INTERVAL '22 days'
        ),
        (
            'f7c0e5a3-a06c-4f4d-6b5a-05d6e7f8a905'::UUID,
            'LAB-WS-01',
            'Training lab workstations',
            'each',
            60.00,
            1850.00,
            NOW() - INTERVAL '9 days',
            NOW() - INTERVAL '8 days'
        ),
        (
            'f7c0e5a3-a06c-4f4d-6b5a-05d6e7f8a905'::UUID,
            'LAB-MON-01',
            '24-inch monitors',
            'each',
            120.00,
            220.00,
            NOW() - INTERVAL '9 days',
            NOW() - INTERVAL '8 days'
        ),
        (
            'f7c0e5a3-a06c-4f4d-6b5a-05d6e7f8a905'::UUID,
            'LAB-CHR-01',
            'Ergonomic chairs',
            'each',
            60.00,
            190.00,
            NOW() - INTERVAL '9 days',
            NOW() - INTERVAL '8 days'
        )
) AS seed_rows (
    requisition_id,
    item_code,
    description,
    unit,
    quantity,
    unit_cost,
    created_at,
    updated_at
)
WHERE EXISTS (
    SELECT 1
    FROM procurement_workflow.requisitions r
    WHERE r.requisition_id = seed_rows.requisition_id
)
AND NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.requisition_line_items li
    WHERE li.requisition_id = seed_rows.requisition_id
      AND li.description = seed_rows.description
);
