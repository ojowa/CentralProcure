-- Migration 138: Add department_officer role
-- Department-level procurement operations and needs submission.
-- Mirrors formation_officer permissions at department level.

INSERT INTO identity.roles (role_key, role_name, description, is_active, "group")
VALUES ('department_officer', 'Department Officer', 'Department-level procurement operations and needs submission', true, 'Operations')
ON CONFLICT (role_key) DO UPDATE SET is_active = true, description = EXCLUDED.description, "group" = EXCLUDED."group";

-- Copy formation_officer permissions
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
  (SELECT role_id FROM identity.roles WHERE role_key = 'department_officer'),
  rp.permission_id,
  true
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'formation_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Copy formation_officer module grants
INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled)
SELECT
  (SELECT role_id FROM identity.roles WHERE role_key = 'department_officer'),
  mg.module_id,
  true
FROM identity.internal_module_grants mg
JOIN identity.roles r ON r.role_id = mg.role_id
WHERE r.role_key = 'formation_officer'
  AND NOT EXISTS (
    SELECT 1 FROM identity.internal_module_grants x
    WHERE x.role_id = (SELECT role_id FROM identity.roles WHERE role_key = 'department_officer')
      AND x.module_id = mg.module_id
  );
