-- Migration 140: Recreate identity.user_role_audit table
-- Dropped accidentally in migration 123. The API query endpoint and
-- update_internal_user_role() function both depend on this table.

CREATE TABLE IF NOT EXISTS identity.user_role_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_internal_user_id UUID NOT NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    previous_role_id UUID NULL REFERENCES identity.roles(role_id) ON DELETE SET NULL,
    new_role_id UUID NOT NULL REFERENCES identity.roles(role_id) ON DELETE CASCADE,
    changed_by_user_id UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_user_role_audit_target
    ON identity.user_role_audit (target_internal_user_id);

CREATE INDEX IF NOT EXISTS ix_user_role_audit_changed_at
    ON identity.user_role_audit (changed_at DESC);
