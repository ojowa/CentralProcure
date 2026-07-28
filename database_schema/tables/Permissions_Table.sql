-- Permissions Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(150) UNIQUE NOT NULL,
    module VARCHAR(80) NOT NULL,
    action VARCHAR(80) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (module, action)
);
