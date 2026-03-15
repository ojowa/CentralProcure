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
