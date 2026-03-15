-- Organizational Units Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.organizational_units (
    unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_code VARCHAR(60) NOT NULL UNIQUE,
    unit_name VARCHAR(150) NOT NULL,
    unit_type VARCHAR(50) NOT NULL,
    parent_unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_assignable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
