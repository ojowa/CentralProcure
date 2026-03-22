-- Migration 066: Audit trail for internal module access changes
CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.internal_module_grant_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('role', 'user')),
    role_id UUID NULL REFERENCES identity.roles(role_id) ON DELETE SET NULL,
    internal_user_id UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    module_id VARCHAR(120) NOT NULL,
    previous_state BOOLEAN NULL,
    new_state BOOLEAN NULL,
    changed_by UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    change_source VARCHAR(40) NOT NULL DEFAULT 'manual',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_internal_module_grant_audit_changed_at
    ON identity.internal_module_grant_audit (changed_at DESC);

CREATE INDEX IF NOT EXISTS ix_internal_module_grant_audit_role
    ON identity.internal_module_grant_audit (role_id);

CREATE INDEX IF NOT EXISTS ix_internal_module_grant_audit_user
    ON identity.internal_module_grant_audit (internal_user_id);
