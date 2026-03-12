-- Seed evaluation reports (PostgreSQL)
INSERT INTO procurement_workflow.evaluation_reports (
    report_id,
    report_code,
    tender_id,
    tender_title,
    committee_lead,
    recommendation,
    score_summary,
    status,
    submitted_at,
    notes,
    created_by,
    updated_by
)
SELECT *
FROM (
    VALUES
        (
            '11aa22bb-33cc-44dd-88ee-99ff0011aa01'::UUID,
            'EVR-2026-0042',
            '4e5c2a1f-8b5f-4c3a-9c2f-1a2b3c4d5e01'::UUID,
            'Border Surveillance Upgrade',
            'Dr. Halima Bello',
            'Recommend Award',
            'Tech 78/100, Financial 85/100',
            'Submitted',
            DATE '2026-02-26',
            'Top vendor met technical thresholds with lowest evaluated cost.',
            'seed',
            'seed'
        ),
        (
            '22bb33cc-44dd-55ee-99ff-0011aa22bb02'::UUID,
            'EVR-2026-0048',
            '7a6b5c4d-3e2f-4a1b-8c7d-6e5f4a3b2c03'::UUID,
            'Passport Printing Supplies',
            'Chinedu Okafor',
            'Recommend Re-Tender',
            'Tech 62/100, Financial 70/100',
            'Returned',
            DATE '2026-02-18',
            'Only one vendor met compliance criteria; board requested re-tender.',
            'seed',
            'seed'
        ),
        (
            '33cc44dd-55ee-66ff-0011-2233aa44bb03'::UUID,
            'EVR-2026-0051',
            '0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c06'::UUID,
            'Border Post Renovation',
            'Amina Yusuf',
            'Recommend Award',
            'Tech 81/100, Financial 79/100',
            'Under Review',
            DATE '2026-02-28',
            'Clarifications pending on site readiness documentation.',
            'seed',
            'seed'
        ),
        (
            '44dd55ee-66ff-7711-2233-3344aa55bb04'::UUID,
            'EVR-2026-0054',
            '4f5e6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a10'::UUID,
            'Training Simulation Labs',
            'Grace Udo',
            'Recommend Award',
            'Tech 88/100, Financial 82/100',
            'Approved',
            DATE '2026-02-12',
            'Board approved with minor contractual clarifications.',
            'seed',
            'seed'
        )
) AS seed_rows (
    report_id,
    report_code,
    tender_id,
    tender_title,
    committee_lead,
    recommendation,
    score_summary,
    status,
    submitted_at,
    notes,
    created_by,
    updated_by
)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.evaluation_reports r
    WHERE r.report_code = seed_rows.report_code
);
