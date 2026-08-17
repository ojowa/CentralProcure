-- Migration 150: Committee memberships + evaluation assignment fixes
--
-- 1. Creates identity.committee_memberships so committee role assignment
--    is separate from the user's global system role.
-- 2. Ensures planning_committee_configuration has a UNIQUE index on
--    committee_code (already PK but the ON CONFLICT in the API assumes it).

BEGIN;

-- ── 1. Committee memberships ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity.committee_memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    committee_type VARCHAR(50) NOT NULL,          -- 'planning' | 'evaluation'
    role_key      VARCHAR(100) NOT NULL,          -- e.g. 'planning_statistics_officer', 'financial_evaluator'
    assigned_by   VARCHAR(255),
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_committee_membership_user_type_role UNIQUE (user_id, committee_type, role_key)
);

CREATE INDEX IF NOT EXISTS ix_committee_memberships_type ON identity.committee_memberships (committee_type);
CREATE INDEX IF NOT EXISTS ix_committee_memberships_user  ON identity.committee_memberships (user_id);

-- ── 2. Helper: get committee members ──────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.get_committee_members(p_committee_type VARCHAR)
RETURNS TABLE (
    membership_id UUID,
    user_id UUID,
    email VARCHAR,
    username VARCHAR,
    first_name VARCHAR,
    surname VARCHAR,
    role_key VARCHAR,
    role_name VARCHAR,
    unit_name VARCHAR,
    assigned_by VARCHAR,
    assigned_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        cm.membership_id,
        cm.user_id,
        iu.email,
        iu.username,
        iu.first_name,
        iu.surname,
        cm.role_key,
        r.role_name,
        ou.unit_name,
        cm.assigned_by,
        cm.assigned_at
    FROM identity.committee_memberships cm
    JOIN identity.internal_users iu ON iu.internal_user_id = cm.user_id
    LEFT JOIN identity.roles r ON lower(r.role_key) = lower(cm.role_key)
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE cm.committee_type = p_committee_type
    ORDER BY cm.role_key, iu.surname, iu.first_name;
$$;

COMMIT;