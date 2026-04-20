-- Migration 097: Internal In-App Notification System
BEGIN;

-- 1. Create Internal Notifications Table
CREATE TABLE IF NOT EXISTS identity.internal_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'System', -- 'System', 'RoleUpdate', 'Workflow', 'Security'
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ NULL,
    action_url TEXT NULL -- Optional URL to navigate to when clicked
);

CREATE INDEX IF NOT EXISTS ix_internal_notifications_recipient 
    ON identity.internal_notifications (recipient_user_id, is_read, created_at DESC);

-- 2. Procedure to create a notification
CREATE OR REPLACE PROCEDURE identity.create_internal_notification_sp(
    IN p_recipient_user_id UUID,
    IN p_title VARCHAR(200),
    IN p_message TEXT,
    IN p_notification_type VARCHAR(50),
    IN p_action_url TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO identity.internal_notifications (
        recipient_user_id,
        title,
        message,
        notification_type,
        action_url
    )
    VALUES (
        p_recipient_user_id,
        p_title,
        p_message,
        p_notification_type,
        p_action_url
    );
END;
$$;

-- 3. Procedure to get notifications for a user
CREATE OR REPLACE PROCEDURE identity.get_internal_notifications_sp(
    IN p_user_id UUID,
    IN p_limit INT DEFAULT 50,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT 
        notification_id,
        title,
        message,
        notification_type,
        is_read,
        created_at,
        read_at,
        action_url
    FROM identity.internal_notifications
    WHERE recipient_user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;

-- 4. Procedure to mark notification as read
CREATE OR REPLACE PROCEDURE identity.mark_notification_as_read_sp(
    IN p_notification_id UUID,
    IN p_user_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE identity.internal_notifications
    SET is_read = TRUE,
        read_at = NOW()
    WHERE notification_id = p_notification_id
      AND recipient_user_id = p_user_id;
END;
$$;

-- 5. Trigger notification on role update
-- We update the update_internal_user_role function to also create a notification
CREATE OR REPLACE FUNCTION identity.update_internal_user_role(
    p_internal_user_id UUID,
    p_role_name VARCHAR(100),
    p_changed_by_user_id UUID
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_role_id UUID;
    v_old_role_name VARCHAR(100);
    v_new_role_id UUID;
    v_new_stamp VARCHAR(36);
BEGIN
    IF p_internal_user_id = p_changed_by_user_id THEN
        RAISE EXCEPTION 'Self-role modification is restricted to prevent administrative lockout.';
    END IF;

    -- Resolve the new role ID
    SELECT r.role_id INTO v_new_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_new_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    -- Capture the current (old) role ID and name for audit/notification
    SELECT iu.role_id, r.role_name INTO v_old_role_id, v_old_role_name
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;

    v_new_stamp := (gen_random_uuid())::text;

    -- Perform the update
    UPDATE identity.internal_users AS iu
    SET role_id = v_new_role_id,
        security_stamp = v_new_stamp,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    -- Record the change in the audit trail
    INSERT INTO identity.user_role_audit (
        target_internal_user_id,
        previous_role_id,
        new_role_id,
        changed_by_user_id,
        change_reason
    )
    VALUES (
        p_internal_user_id,
        v_old_role_id,
        v_new_role_id,
        p_changed_by_user_id,
        'Role updated. Session stamp refreshed to ' || v_new_stamp
    );

    -- Create notification for the user
    INSERT INTO identity.internal_notifications (
        recipient_user_id,
        title,
        message,
        notification_type
    )
    VALUES (
        p_internal_user_id,
        'Role Updated',
        'Your system role has been updated to ' || p_role_name || '. Please log out and back in to apply these changes.',
        'RoleUpdate'
    );

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users AS iu
    JOIN identity.roles AS r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

COMMIT;
