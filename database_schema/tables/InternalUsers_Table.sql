-- Internal Users Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.internal_users (
    internal_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    surname VARCHAR(100) NOT NULL,
    service_number VARCHAR(100) UNIQUE NOT NULL,
    unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES identity.roles(role_id),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    last_login TIMESTAMP WITHOUT TIME ZONE NULL,
    is_active BOOLEAN DEFAULT TRUE,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
