BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_complaints (
    complaint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_reference VARCHAR(80) NOT NULL UNIQUE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    stage_key_at_filing VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Filed',
    subject VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    details TEXT NOT NULL,
    complaint_channel VARCHAR(80) NULL,
    requested_remedy TEXT NULL,
    filed_by VARCHAR(255) NULL,
    assigned_to VARCHAR(255) NULL,
    reviewed_by VARCHAR(255) NULL,
    resolution_outcome VARCHAR(80) NULL,
    resolution_stage_key VARCHAR(80) NULL,
    resolution_notes TEXT NULL,
    filed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_procurement_complaints_stage
        FOREIGN KEY (stage_key_at_filing)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_complaints_resolution_stage
        FOREIGN KEY (resolution_stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE SET NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_complaints_status_chk'
          AND conrelid = 'procurement_workflow.procurement_complaints'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_complaints
            ADD CONSTRAINT procurement_complaints_status_chk
            CHECK (status IN ('Filed', 'In Review', 'Escalated', 'Resolved', 'Rejected', 'Closed'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_complaints_resolution_outcome_chk'
          AND conrelid = 'procurement_workflow.procurement_complaints'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_complaints
            ADD CONSTRAINT procurement_complaints_resolution_outcome_chk
            CHECK (
                resolution_outcome IS NULL
                OR resolution_outcome IN (
                    'Resume Procurement',
                    'Modify Decision',
                    'Escalate To BPP',
                    'Terminate Procurement',
                    'Dismiss Complaint'
                )
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_procurement_complaints_entity
    ON procurement_workflow.procurement_complaints (entity_type, entity_id, filed_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_complaints_status
    ON procurement_workflow.procurement_complaints (status, filed_at DESC);

CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_closeouts (
    closeout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closeout_reference VARCHAR(80) NOT NULL UNIQUE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Archived',
    record_title VARCHAR(255) NULL,
    summary TEXT NOT NULL,
    archive_location TEXT NULL,
    final_acceptance_completed BOOLEAN NOT NULL DEFAULT FALSE,
    final_payment_completed BOOLEAN NOT NULL DEFAULT FALSE,
    archived_by VARCHAR(255) NULL,
    archived_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT procurement_closeouts_entity_ux UNIQUE (entity_type, entity_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_closeouts_status_chk'
          AND conrelid = 'procurement_workflow.procurement_closeouts'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_closeouts
            ADD CONSTRAINT procurement_closeouts_status_chk
            CHECK (status IN ('Submitted', 'Archived', 'Reopened'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_procurement_closeouts_status
    ON procurement_workflow.procurement_closeouts (status, archived_at DESC);

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        ('administrative_review', 'solicitation', 'Complaint resolved and procurement resumes from solicitation.'),
        ('administrative_review', 'evaluation', 'Complaint resolved and procurement returns to evaluation.'),
        ('administrative_review', 'award_and_publication', 'Complaint resolved and procurement returns to award stage.'),
        ('administrative_review', 'bpp_no_objection', 'Complaint outcome escalates case for BPP prior review.'),
        ('administrative_review', 'closeout_and_audit', 'Complaint outcome terminates procurement and archives the file.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
      AND existing.transition_condition = seed.transition_condition
);

COMMIT;
