CREATE OR REPLACE FUNCTION identity.get_internal_notifications_sp(
    p_user_id character varying,
    p_limit integer DEFAULT 50
)
RETURNS TABLE(
    notification_id uuid,
    title character varying,
    message text,
    notification_type character varying,
    entity_type character varying,
    entity_id character varying,
    is_read boolean,
    created_at timestamp with time zone
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
    LIMIT p_limit;
$$;
