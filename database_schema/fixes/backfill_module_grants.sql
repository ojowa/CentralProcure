DO $$
DECLARE
  v_role_id uuid;
BEGIN
  -- audit_oversight: audit modules
  SELECT role_id INTO v_role_id FROM identity.roles WHERE role_key = 'audit_oversight';
  INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
  SELECT v_role_id, m.module_id, true
  FROM identity.internal_modules m
  WHERE m.module_id IN ('audit-dashboard', 'audit-trail-viewer', 'compliance-reports')
    AND NOT EXISTS (SELECT 1 FROM identity.internal_module_grants mg WHERE mg.role_id = v_role_id AND mg.module_id = m.module_id);

  -- planning_officer: planning and budget modules
  SELECT role_id INTO v_role_id FROM identity.roles WHERE role_key = 'planning_officer';
  INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
  SELECT v_role_id, m.module_id, true
  FROM identity.internal_modules m
  WHERE m.module_id IN ('annual-procurement-plan', 'budget-workspace', 'procurement-planning-committee', 'threshold-configuration')
    AND NOT EXISTS (SELECT 1 FROM identity.internal_module_grants mg WHERE mg.role_id = v_role_id AND mg.module_id = m.module_id);

  -- user-profile for all active roles
  INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
  SELECT r.role_id, 'user-profile', true
  FROM identity.roles r
  WHERE r.is_active = true
    AND NOT EXISTS (SELECT 1 FROM identity.internal_module_grants mg WHERE mg.role_id = r.role_id AND mg.module_id = 'user-profile');
END;
$$;
