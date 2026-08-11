DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT internal_user_id FROM identity.internal_users
  LOOP
    INSERT INTO identity.internal_notifications (user_id, title, message, notification_type, entity_type, entity_id)
    VALUES
      (v_user.internal_user_id, 'System Active', 'eProcurement platform is operational. All services running.', 'info', 'system', 'system-health'),
      (v_user.internal_user_id, 'Threshold Configuration', '9 active procurement thresholds are configured. Review in Threshold Configuration module.', 'info', 'config', 'thresholds'),
      (v_user.internal_user_id, 'Workflow Status', 'No pending approvals require your attention at this time.', 'success', 'workflow', 'workflow-status');
  END LOOP;
END;
$$;
