-- User Login Security Table (PostgreSQL)
-- Tracks failed login attempts and lockouts for Internal Users.
CREATE TABLE IF NOT EXISTS identity.user_login_security (
    internal_user_id UUID PRIMARY KEY REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    failed_login_attempts INT DEFAULT 0,
    lockout_until TIMESTAMP WITHOUT TIME ZONE NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
