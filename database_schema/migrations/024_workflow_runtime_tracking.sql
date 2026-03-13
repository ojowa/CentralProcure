 BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_instances (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    current_stage_key VARCHAR(80) NOT NULL,
    current_status VARCHAR(80) NULL,
    record_title VARCHAR(255) NULL,
    parent_entity_type VARCHAR(80) NULL,
    parent_entity_id UUID NULL,
    amount DECIMAL(18, 2) NULL,
    procurement_type VARCHAR(50) NULL,
    threshold_id UUID NULL,
    last_transition_reason TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workflow_instances_stage
        FOREIGN KEY (current_stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE RESTRICT,
    CONSTRAINT fk_workflow_instances_threshold
        FOREIGN KEY (threshold_id)
        REFERENCES procurement_workflow.approval_thresholds(threshold_id)
        ON DELETE SET NULL,
    CONSTRAINT workflow_instances_entity_ux
        UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_stage
    ON procurement_workflow.workflow_instances (current_stage_key, entity_type);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_parent
    ON procurement_workflow.workflow_instances (parent_entity_type, parent_entity_id);

CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_instance_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL,
    from_stage_key VARCHAR(80) NULL,
    to_stage_key VARCHAR(80) NOT NULL,
    stage_status VARCHAR(80) NULL,
    transition_source VARCHAR(80) NOT NULL,
    transition_reason TEXT NULL,
    actor VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workflow_history_instance
        FOREIGN KEY (instance_id)
        REFERENCES procurement_workflow.workflow_instances(instance_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_workflow_history_from_stage
        FOREIGN KEY (from_stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE SET NULL,
    CONSTRAINT fk_workflow_history_to_stage
        FOREIGN KEY (to_stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_workflow_instance_history_instance
    ON procurement_workflow.workflow_instance_history (instance_id, created_at DESC);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    amount,
    last_transition_reason
)
SELECT
    'procurement_plan',
    p.plan_id,
    CASE
        WHEN p.status = 'Draft' THEN 'department_need_capture'
        WHEN p.status = 'Submitted' THEN 'planning_committee_review'
        ELSE 'app_approval'
    END,
    p.status,
    p.plan_title,
    p.total_budget,
    'Baseline sync from procurement_plans.'
FROM procurement_workflow.procurement_plans p
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'procurement_plan'
      AND wi.entity_id = p.plan_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    last_transition_reason
)
SELECT
    'requisition',
    r.requisition_id,
    CASE
        WHEN r.status = 'Draft' THEN 'procurement_initiation'
        WHEN r.status IN ('Submitted', 'Under Review') THEN 'threshold_resolution'
        WHEN r.status = 'Evaluation' THEN 'evaluation'
        WHEN r.status = 'Board Review' THEN 'tenders_board_review'
        WHEN r.status = 'Approved' THEN 'accounting_officer_review'
        ELSE 'procurement_initiation'
    END,
    r.status,
    r.title,
    CASE WHEN r.app_item_id IS NULL THEN NULL ELSE 'procurement_plan_item' END,
    r.app_item_id,
    r.total_estimate,
    r.procurement_type,
    'Baseline sync from requisitions.'
FROM procurement_workflow.requisitions r
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'requisition'
      AND wi.entity_id = r.requisition_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    amount,
    last_transition_reason
)
SELECT
    'tender',
    t.tender_id,
    CASE
        WHEN t.status = 'Draft' THEN 'method_validation'
        WHEN t.status = 'Published' THEN 'solicitation'
        WHEN t.status = 'Closed' THEN 'bid_opening'
        WHEN t.status = 'Awarded' THEN 'award_and_publication'
        ELSE 'solicitation'
    END,
    t.status,
    t.title,
    t.budget,
    'Baseline sync from tenders.'
FROM vendor_sourcing.tenders t
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'tender'
      AND wi.entity_id = t.tender_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    last_transition_reason
)
SELECT
    'bid_opening_session',
    s.session_id,
    'bid_opening',
    s.status,
    s.session_title,
    'tender',
    s.tender_id,
    'Baseline sync from bid opening sessions.'
FROM vendor_sourcing.bid_opening_sessions s
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'bid_opening_session'
      AND wi.entity_id = s.session_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    last_transition_reason
)
SELECT
    'evaluation_report',
    e.report_id,
    'evaluation',
    e.status,
    e.tender_title,
    'tender',
    e.tender_id,
    'Baseline sync from evaluation reports.'
FROM procurement_workflow.evaluation_reports e
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'evaluation_report'
      AND wi.entity_id = e.report_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    last_transition_reason
)
SELECT
    'bpp_no_objection',
    b.no_objection_id,
    'bpp_no_objection',
    b.status,
    COALESCE(b.reference_code, 'BPP No Objection'),
    CASE
        WHEN b.tender_id IS NOT NULL THEN 'tender'
        WHEN b.requisition_id IS NOT NULL THEN 'requisition'
        ELSE NULL
    END,
    COALESCE(b.tender_id, b.requisition_id),
    b.amount,
    b.procurement_type,
    'Baseline sync from bpp_no_objections.'
FROM procurement_workflow.bpp_no_objections b
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'bpp_no_objection'
      AND wi.entity_id = b.no_objection_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    amount,
    last_transition_reason
)
SELECT
    'contract_award',
    a.award_id,
    'award_and_publication',
    a.status,
    a.tender_title,
    a.award_value,
    'Baseline sync from contract_awards.'
FROM post_award.contract_awards a
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'contract_award'
      AND wi.entity_id = a.award_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    amount,
    last_transition_reason
)
SELECT
    'contract',
    c.contract_id,
    'contract_execution',
    c.status,
    c.tender_title,
    c.contract_value,
    'Baseline sync from contracts.'
FROM post_award.contracts c
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'contract'
      AND wi.entity_id = c.contract_id
);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    last_transition_reason
)
SELECT
    'inspection',
    i.inspection_id,
    'inspection_and_payment',
    i.status,
    i.tender_title,
    'contract',
    c.contract_id,
    'Baseline sync from inspections.'
FROM post_award.inspections i
LEFT JOIN post_award.contracts c
    ON c.contract_code = i.contract_code
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'inspection'
      AND wi.entity_id = i.inspection_id
);

INSERT INTO procurement_workflow.workflow_instance_history (
    instance_id,
    from_stage_key,
    to_stage_key,
    stage_status,
    transition_source,
    transition_reason,
    actor
)
SELECT
    wi.instance_id,
    NULL,
    wi.current_stage_key,
    wi.current_status,
    'migration_backfill',
    COALESCE(wi.last_transition_reason, 'Baseline workflow instance sync.'),
    'migration'
FROM procurement_workflow.workflow_instances wi
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instance_history h
    WHERE h.instance_id = wi.instance_id
);

COMMIT;
