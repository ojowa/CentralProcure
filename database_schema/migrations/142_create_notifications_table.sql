-- Migration 142: Create real notifications table and update SP
-- The previous SP was a hardcoded stub returning a single fake "Welcome" row.

CREATE TABLE IF NOT EXISTS identity.internal_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'info',
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_notifications_user ON identity.internal_notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION identity.get_internal_notifications_sp(p_user_id character varying)
RETURNS TABLE(
    notification_id uuid,
    title character varying,
    message text,
    notification_type character varying,
    entity_type character varying,
    entity_id character varying,
    is_read boolean,
    created_at timestamp without time zone
)
LANGUAGE sql STABLE
AS $$
    SELECT
        n.notification_id,
        n.title,
        n.message,
        n.notification_type,
        n.entity_type,
        n.entity_id,
        n.is_read,
        n.created_at
    FROM identity.internal_notifications n
    WHERE n.user_id::text = p_user_id
    ORDER BY n.created_at DESC
    LIMIT 50;
$$;
