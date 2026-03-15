CREATE TABLE IF NOT EXISTS identity.organizational_positions (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_code VARCHAR(80) NOT NULL UNIQUE,
    position_title VARCHAR(160) NOT NULL,
    unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL,
    reports_to_position_id UUID NULL REFERENCES identity.organizational_positions(position_id) ON DELETE SET NULL,
    is_executive BOOLEAN NOT NULL DEFAULT FALSE,
    is_board_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_organizational_positions_unit_id
    ON identity.organizational_positions (unit_id);
