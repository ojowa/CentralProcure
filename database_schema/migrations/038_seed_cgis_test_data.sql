-- Migration 038: Seed CGIS Test Data (PostgreSQL)
BEGIN;

-- 1. Create a Vendor
INSERT INTO identity.vendors (
    vendor_id,
    company_name,
    registration_number,
    tax_id,
    contact_person,
    email,
    phone_number,
    company_address,
    password_hash,
    is_active,
    vendor_status
)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Global Tech Solutions Ltd',
    'RC12345678',
    'TIN12345678',
    'John Doe',
    'john.doe@globaltech.com',
    '08012345678',
    '123 Main Street, Abuja',
    'hashed_password', 
    true,
    'Active'
) ON CONFLICT (vendor_id) DO NOTHING;

-- 2. Create Compliance Documents for the Vendor
INSERT INTO identity.compliance_documents (
    document_id,
    vendor_id,
    document_type,
    document_url,
    verification_status,
    expiry_date
)
VALUES
(gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Tax Clearance Certificate', 'https://example.com/tcc.pdf', 'Approved', NOW() + INTERVAL '1 year'),
(gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'PENCOM Certificate', 'https://example.com/pencom.pdf', 'Approved', NOW() + INTERVAL '1 year'),
(gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ITF Certificate', 'https://example.com/itf.pdf', 'Approved', NOW() + INTERVAL '1 year')
ON CONFLICT DO NOTHING;

-- 3. Create a Tender in 'Published' status
INSERT INTO vendor_sourcing.tenders (
    tender_id,
    title,
    description,
    category,
    status,
    budget,
    department,
    created_at
)
VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'Supply of 50 High-Performance Laptops',
    'Procurement of 50 laptops for the new ICT center.',
    'Goods',
    'Published', 
    15000000.00, 
    'ICT Department',
    NOW() - INTERVAL '5 days'
) ON CONFLICT (tender_id) DO NOTHING;

-- 4. Create a Recommended Bid for the Tender
INSERT INTO vendor_sourcing.bids (
    bid_id,
    tender_id,
    vendor_id,
    bid_amount,
    technical_proposal_url,
    status,
    submission_date
)
VALUES (
    gen_random_uuid(),
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    14500000.00, 
    'https://example.com/proposal.pdf',
    'Recommended',
    NOW() - INTERVAL '2 days'
) ON CONFLICT DO NOTHING;

-- 5. Create Workflow Instance in 'accounting_officer_review' with correct threshold
WITH target_threshold AS (
    SELECT threshold_id 
    FROM procurement_workflow.approval_thresholds 
    WHERE min_amount = 0 AND max_amount = 50000000 
    LIMIT 1
)
INSERT INTO procurement_workflow.workflow_instances (
    instance_id,
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    amount,
    procurement_type,
    threshold_id,
    created_at
)
SELECT
    gen_random_uuid(),
    'tender',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'accounting_officer_review',
    'Pending Approval',
    'Supply of 50 High-Performance Laptops',
    14500000.00,
    'Goods',
    threshold_id,
    NOW() - INTERVAL '1 day'
FROM target_threshold
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET current_stage_key = 'accounting_officer_review',
    current_status = 'Pending Approval',
    threshold_id = EXCLUDED.threshold_id;

COMMIT;
