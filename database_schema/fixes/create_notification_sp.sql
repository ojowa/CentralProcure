CREATE OR REPLACE FUNCTION identity.create_notification(
    p_user_id uuid,
    p_title varchar(200),
    p_message text,
    p_notification_type varchar(50) DEFAULT 'info',
    p_entity_type varchar(100) DEFAULT NULL,
    p_entity_id varchar(255) DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO identity.internal_notifications (user_id, title, message, notification_type, entity_type, entity_id)
    VALUES (p_user_id, p_title, p_message, p_notification_type, p_entity_type, p_entity_id)
    RETURNING notification_id INTO v_id;
    RETURN v_id;
END;
$$;
