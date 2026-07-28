-- Role Permissions Junction Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.role_permissions (
    role_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES identity.roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES identity.permissions(permission_id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON identity.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON identity.role_permissions(permission_id);
