-- Password Audit Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.password_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_user_id UUID NOT NULL REFERENCES identity.internal_users(internal_user_id),
    action VARCHAR(50) NOT NULL, -- 'admin_reset', 'self_change', 'expired'
    changed_by UUID NULL REFERENCES identity.internal_users(internal_user_id),
    ip_address INET NULL,
    user_agent TEXT NULL,
    -- Audit fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries by user
CREATE INDEX IF NOT EXISTS idx_password_audit_user ON identity.password_audit(internal_user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_action ON identity.password_audit(action);
CREATE INDEX IF NOT EXISTS idx_password_audit_created_at ON identity.password_audit(created_at);
