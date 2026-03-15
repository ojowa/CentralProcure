BEGIN;

CREATE TABLE IF NOT EXISTS identity.organizational_positions (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_code VARCHAR(80) NOT NULL UNIQUE,
    position_title VARCHAR(160) NOT NULL,
    unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL,
    reports_to_position_id UUID NULL REFERENCES identity.organizational_positions(position_id) ON DELETE SET NULL,
    is_executive BOOLEAN NOT NULL DEFAULT FALSE,
    is_board_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_organizational_positions_unit_id
    ON identity.organizational_positions (unit_id);

CREATE TABLE IF NOT EXISTS procurement_workflow.governance_bodies (
    body_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    body_code VARCHAR(80) NOT NULL UNIQUE,
    body_name VARCHAR(160) NOT NULL,
    body_type VARCHAR(80) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_workflow.governance_body_memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    body_id UUID NOT NULL REFERENCES procurement_workflow.governance_bodies(body_id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES identity.organizational_positions(position_id) ON DELETE CASCADE,
    membership_role VARCHAR(80) NOT NULL,
    voting_order INTEGER NOT NULL DEFAULT 0,
    is_voting_member BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT governance_body_membership_ux UNIQUE (body_id, position_id)
);

CREATE INDEX IF NOT EXISTS ix_governance_body_memberships_body_id
    ON procurement_workflow.governance_body_memberships (body_id, is_active, voting_order);

ALTER TABLE procurement_workflow.approval_thresholds
    ADD COLUMN IF NOT EXISTS approval_authority_code VARCHAR(80) NOT NULL DEFAULT 'GENERIC_ROUTE',
    ADD COLUMN IF NOT EXISTS approval_authority_label VARCHAR(160) NOT NULL DEFAULT 'Threshold authority',
    ADD COLUMN IF NOT EXISTS requires_cgis_approval BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS governance_body_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'approval_thresholds_governance_body_fk'
          AND conrelid = 'procurement_workflow.approval_thresholds'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.approval_thresholds
            ADD CONSTRAINT approval_thresholds_governance_body_fk
            FOREIGN KEY (governance_body_id)
            REFERENCES procurement_workflow.governance_bodies(body_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS approval_thresholds_governance_body_idx
    ON procurement_workflow.approval_thresholds (governance_body_id, status);

INSERT INTO identity.organizational_positions (
    position_code,
    position_title,
    unit_id,
    reports_to_position_id,
    is_executive,
    is_board_eligible,
    is_active
)
VALUES
    (
        'CGIS',
        'Comptroller General, Nigeria Immigration Service',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'CGNIS'),
        NULL,
        TRUE,
        FALSE,
        TRUE
    )
ON CONFLICT (position_code) DO UPDATE
SET
    position_title = EXCLUDED.position_title,
    unit_id = EXCLUDED.unit_id,
    reports_to_position_id = EXCLUDED.reports_to_position_id,
    is_executive = EXCLUDED.is_executive,
    is_board_eligible = EXCLUDED.is_board_eligible,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO identity.organizational_positions (
    position_code,
    position_title,
    unit_id,
    reports_to_position_id,
    is_executive,
    is_board_eligible,
    is_active
)
VALUES
    (
        'DCG_HRM',
        'Deputy Comptroller General, Human Resources Management',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'HRM'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_FINACC',
        'Deputy Comptroller General, Finance and Accounts',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'FINACC'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_PRS',
        'Deputy Comptroller General, Planning, Research and Statistics',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'PRS'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_PPTD',
        'Deputy Comptroller General, Passport and Other Travel Documents',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'PPTD'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_INVCOMP',
        'Deputy Comptroller General, Investigation and Compliance',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'INVCOMP'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_BORDER',
        'Deputy Comptroller General, Border Management',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'BORDER'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_MIGRATION',
        'Deputy Comptroller General, Migration',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'MIGRATION'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_VISA',
        'Deputy Comptroller General, Visa and Residency',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'VISA'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_WORKLOG',
        'Deputy Comptroller General, Works and Logistics',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'WORKLOG'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'DCG_ICTCYBER',
        'Deputy Comptroller General, ICT and Cyber Security',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'ICTCYBER'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        TRUE,
        TRUE,
        TRUE
    ),
    (
        'TENDERS_BOARD_SECRETARY',
        'Tenders Board Secretary',
        (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'PROC'),
        (SELECT position_id FROM identity.organizational_positions WHERE position_code = 'CGIS'),
        FALSE,
        FALSE,
        TRUE
    )
ON CONFLICT (position_code) DO UPDATE
SET
    position_title = EXCLUDED.position_title,
    unit_id = EXCLUDED.unit_id,
    reports_to_position_id = EXCLUDED.reports_to_position_id,
    is_executive = EXCLUDED.is_executive,
    is_board_eligible = EXCLUDED.is_board_eligible,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO procurement_workflow.governance_bodies (
    body_code,
    body_name,
    body_type,
    description,
    is_active
)
VALUES (
    'NIS_TENDERS_BOARD',
    'NIS Tenders Board',
    'TendersBoard',
    'NIS Tenders Board composed of DCG heads of directorates, with the Procurement unit serving board secretariat support.',
    TRUE
)
ON CONFLICT (body_code) DO UPDATE
SET
    body_name = EXCLUDED.body_name,
    body_type = EXCLUDED.body_type,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO procurement_workflow.governance_body_memberships (
    body_id,
    position_id,
    membership_role,
    voting_order,
    is_voting_member,
    is_active
)
SELECT
    body.body_id,
    position.position_id,
    CASE
        WHEN position.position_code = 'TENDERS_BOARD_SECRETARY' THEN 'Secretary'
        ELSE 'Member'
    END,
    CASE position.position_code
        WHEN 'DCG_HRM' THEN 10
        WHEN 'DCG_FINACC' THEN 20
        WHEN 'DCG_PRS' THEN 30
        WHEN 'DCG_PPTD' THEN 40
        WHEN 'DCG_INVCOMP' THEN 50
        WHEN 'DCG_BORDER' THEN 60
        WHEN 'DCG_MIGRATION' THEN 70
        WHEN 'DCG_VISA' THEN 80
        WHEN 'DCG_WORKLOG' THEN 90
        WHEN 'DCG_ICTCYBER' THEN 100
        ELSE 999
    END,
    position.position_code <> 'TENDERS_BOARD_SECRETARY',
    TRUE
FROM procurement_workflow.governance_bodies body
JOIN identity.organizational_positions position
    ON position.position_code IN (
        'DCG_HRM',
        'DCG_FINACC',
        'DCG_PRS',
        'DCG_PPTD',
        'DCG_INVCOMP',
        'DCG_BORDER',
        'DCG_MIGRATION',
        'DCG_VISA',
        'DCG_WORKLOG',
        'DCG_ICTCYBER',
        'TENDERS_BOARD_SECRETARY'
    )
WHERE body.body_code = 'NIS_TENDERS_BOARD'
ON CONFLICT (body_id, position_id) DO UPDATE
SET
    membership_role = EXCLUDED.membership_role,
    voting_order = EXCLUDED.voting_order,
    is_voting_member = EXCLUDED.is_voting_member,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

UPDATE procurement_workflow.approval_thresholds
SET
    approval_route = 'CGIS Direct Approval',
    approval_authority_code = 'CGIS_DIRECT_APPROVAL',
    approval_authority_label = 'CGIS Direct Approval',
    requires_cgis_approval = TRUE,
    requires_board = FALSE,
    requires_bpp = FALSE,
    governance_body_id = NULL,
    notes = COALESCE(notes, 'Low-value procurement routed for direct CGIS approval.')
WHERE status = 'Active'
  AND min_amount < 50000000;

UPDATE procurement_workflow.approval_thresholds
SET
    approval_route = 'NIS Tenders Board Review',
    approval_authority_code = 'NIS_TENDERS_BOARD',
    approval_authority_label = 'NIS Tenders Board (DCG Heads of Directorates)',
    requires_cgis_approval = FALSE,
    requires_board = TRUE,
    requires_bpp = FALSE,
    governance_body_id = (
        SELECT body_id
        FROM procurement_workflow.governance_bodies
        WHERE body_code = 'NIS_TENDERS_BOARD'
    ),
    notes = COALESCE(notes, 'Board-value procurement routed to the NIS Tenders Board for final internal decision.')
WHERE status = 'Active'
  AND min_amount >= 50000000
  AND min_amount < 100000000;

UPDATE procurement_workflow.approval_thresholds
SET
    approval_route = 'NIS Tenders Board + BPP No Objection',
    approval_authority_code = 'BPP_PRIOR_REVIEW',
    approval_authority_label = 'NIS Tenders Board + BPP No Objection',
    requires_cgis_approval = FALSE,
    requires_board = TRUE,
    requires_bpp = TRUE,
    governance_body_id = (
        SELECT body_id
        FROM procurement_workflow.governance_bodies
        WHERE body_code = 'NIS_TENDERS_BOARD'
    ),
    notes = COALESCE(notes, 'High-value procurement requires NIS Tenders Board review before BPP no-objection.')
WHERE status = 'Active'
  AND min_amount >= 100000000;

INSERT INTO procurement_workflow.approval_thresholds (
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    status,
    notes
)
SELECT
    NULL,
    seed.min_amount,
    seed.max_amount,
    seed.approval_route,
    seed.approval_authority_code,
    seed.approval_authority_label,
    seed.requires_cgis_approval,
    seed.requires_board,
    seed.requires_bpp,
    CASE
        WHEN seed.requires_board THEN (
            SELECT body_id
            FROM procurement_workflow.governance_bodies
            WHERE body_code = 'NIS_TENDERS_BOARD'
        )
        ELSE NULL
    END,
    'Active',
    seed.notes
FROM (
    VALUES
        (0::DECIMAL(18, 2), 50000000::DECIMAL(18, 2), 'CGIS Direct Approval', 'CGIS_DIRECT_APPROVAL', 'CGIS Direct Approval', TRUE, FALSE, FALSE, 'Low-value procurement routed for direct CGIS approval.'),
        (50000000::DECIMAL(18, 2), 100000000::DECIMAL(18, 2), 'NIS Tenders Board Review', 'NIS_TENDERS_BOARD', 'NIS Tenders Board (DCG Heads of Directorates)', FALSE, TRUE, FALSE, 'Board-value procurement routed to the NIS Tenders Board for final internal decision.'),
        (100000000::DECIMAL(18, 2), NULL::DECIMAL(18, 2), 'NIS Tenders Board + BPP No Objection', 'BPP_PRIOR_REVIEW', 'NIS Tenders Board + BPP No Objection', FALSE, TRUE, TRUE, 'High-value procurement requires NIS Tenders Board review before BPP no-objection.')
) AS seed (
    min_amount,
    max_amount,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    notes
)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.approval_thresholds existing
    WHERE existing.status = 'Active'
);

WITH ranked_generic_thresholds AS (
    SELECT
        threshold_id,
        ROW_NUMBER() OVER (
            ORDER BY min_amount ASC, COALESCE(max_amount, 999999999999.99) ASC, threshold_id
        ) AS band_no
    FROM procurement_workflow.approval_thresholds
    WHERE status = 'Active'
      AND procurement_type IS NULL
)
UPDATE procurement_workflow.approval_thresholds threshold
SET
    min_amount = CASE ranked.band_no
        WHEN 1 THEN 0::DECIMAL(18, 2)
        WHEN 2 THEN 50000000.01::DECIMAL(18, 2)
        ELSE 100000000.01::DECIMAL(18, 2)
    END,
    max_amount = CASE ranked.band_no
        WHEN 1 THEN 50000000.00::DECIMAL(18, 2)
        WHEN 2 THEN 100000000.00::DECIMAL(18, 2)
        ELSE NULL
    END,
    approval_route = CASE ranked.band_no
        WHEN 1 THEN 'CGIS Direct Approval'
        WHEN 2 THEN 'NIS Tenders Board Review'
        ELSE 'NIS Tenders Board + BPP No Objection'
    END,
    approval_authority_code = CASE ranked.band_no
        WHEN 1 THEN 'CGIS_DIRECT_APPROVAL'
        WHEN 2 THEN 'NIS_TENDERS_BOARD'
        ELSE 'BPP_PRIOR_REVIEW'
    END,
    approval_authority_label = CASE ranked.band_no
        WHEN 1 THEN 'CGIS Direct Approval'
        WHEN 2 THEN 'NIS Tenders Board (DCG Heads of Directorates)'
        ELSE 'NIS Tenders Board + BPP No Objection'
    END,
    requires_cgis_approval = ranked.band_no = 1,
    requires_board = ranked.band_no >= 2,
    requires_bpp = ranked.band_no >= 3,
    governance_body_id = CASE
        WHEN ranked.band_no >= 2 THEN (
            SELECT body_id
            FROM procurement_workflow.governance_bodies
            WHERE body_code = 'NIS_TENDERS_BOARD'
        )
        ELSE NULL
    END,
    notes = CASE ranked.band_no
        WHEN 1 THEN 'Low-value procurement routed for direct CGIS approval.'
        WHEN 2 THEN 'Board-value procurement routed to the NIS Tenders Board for final internal decision.'
        ELSE 'High-value procurement requires NIS Tenders Board review before BPP no-objection.'
    END,
    updated_at = NOW()
FROM ranked_generic_thresholds ranked
WHERE threshold.threshold_id = ranked.threshold_id
  AND ranked.band_no <= 3;

WITH ranked_generic_thresholds AS (
    SELECT
        threshold_id,
        ROW_NUMBER() OVER (
            ORDER BY min_amount ASC, COALESCE(max_amount, 999999999999.99) ASC, threshold_id
        ) AS band_no
    FROM procurement_workflow.approval_thresholds
    WHERE status = 'Active'
      AND procurement_type IS NULL
)
UPDATE procurement_workflow.approval_thresholds threshold
SET
    status = 'Inactive',
    notes = COALESCE(threshold.notes, '') ||
        CASE
            WHEN COALESCE(threshold.notes, '') = '' THEN ''
            ELSE E'\n'
        END ||
        'Superseded by canonical CGIS/Board/BPP threshold normalization.',
    updated_at = NOW()
FROM ranked_generic_thresholds ranked
WHERE threshold.threshold_id = ranked.threshold_id
  AND ranked.band_no > 3;

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Tenders Board Review',
    stage_description = 'NIS Tenders Board review led by DCG heads of directorates, with the board secretary maintaining the decision record.',
    updated_at = NOW()
WHERE stage_key = 'tenders_board_review';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'CGIS Approval',
    stage_description = 'CGIS exercises the direct low-value approval authority before award publication.',
    updated_at = NOW()
WHERE stage_key = 'accounting_officer_review';

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE (from_stage_key = 'tenders_board_review' AND to_stage_key = 'accounting_officer_review')
   OR (from_stage_key = 'accounting_officer_review' AND to_stage_key = 'bpp_no_objection');

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT seed.from_stage_key, seed.to_stage_key, seed.transition_condition
FROM (
    VALUES
        ('evaluation', 'tenders_board_review', 'Board review applies within board or BPP threshold.'),
        ('tenders_board_review', 'award_and_publication', 'Board decision is final within threshold.'),
        ('accounting_officer_review', 'award_and_publication', 'CGIS direct approval is complete.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
);

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        ('evaluation', 'accounting_officer_review', 'CGIS direct approval applies within low-value threshold.'),
        ('tenders_board_review', 'bpp_no_objection', 'BPP prior review applies after board endorsement.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
      AND existing.transition_condition = seed.transition_condition
);

UPDATE procurement_workflow.workflow_stage_transitions
SET transition_condition = 'Board review applies within board or BPP threshold.'
WHERE from_stage_key = 'evaluation'
  AND to_stage_key = 'tenders_board_review';

UPDATE procurement_workflow.workflow_stage_transitions
SET transition_condition = 'Board decision is final within threshold.'
WHERE from_stage_key = 'tenders_board_review'
  AND to_stage_key = 'award_and_publication';

UPDATE procurement_workflow.workflow_stage_transitions
SET transition_condition = 'CGIS direct approval is complete.'
WHERE from_stage_key = 'accounting_officer_review'
  AND to_stage_key = 'award_and_publication';

UPDATE procurement_workflow.workflow_role_tasks
SET
    display_name = 'NIS Tenders Board',
    task_description = 'Approve, reject, or escalate recommendation as the DCG-led NIS Tenders Board.',
    expected_outcome = 'Board decision is recorded with traceable governance rationale.'
WHERE role_key = 'tenders_board'
  AND stage_key = 'tenders_board_review';

UPDATE procurement_workflow.workflow_role_tasks
SET
    display_name = 'CGIS',
    task_description = 'Exercise direct low-value approval authority.',
    expected_outcome = 'CGIS approval decision is recorded before award publication.'
WHERE role_key = 'accounting_officer'
  AND stage_key = 'accounting_officer_review';

COMMIT;
