-- Migration 126: Unify system-administrator roles into a single role.
-- The database previously carried two overlapping admin roles ("Admin" with
-- role_key "admin" and "SystemAdministrator" with role_key "ict_admin").
-- This merges SystemAdministrator into Admin so a single true role exists,
-- then rewrites the legacy "ict_admin" key used in the workflow catalog.
BEGIN;

-- Capture the role ids.
DO $$
DECLARE
    v_admin_role_id UUID;
    v_sysadmin_role_id UUID;
BEGIN
    SELECT role_id INTO v_sysadmin_role_id FROM identity.roles WHERE role_name = 'SystemAdministrator';
    SELECT role_id INTO v_admin_role_id FROM identity.roles WHERE role_name = 'Admin';

    IF v_sysadmin_role_id IS NULL THEN
        RAISE NOTICE 'SystemAdministrator role not present; nothing to merge.';
        RETURN;
    END IF;

    IF v_admin_role_id IS NULL THEN
        -- No Admin role to merge into; rename SystemAdministrator to Admin instead.
        UPDATE identity.roles
        SET role_name = 'Admin',
            role_key = 'admin',
            updated_at = NOW()
        WHERE role_id = v_sysadmin_role_id;
        RETURN;
    END IF;

    -- 1. Union permissions: give Admin every permission SystemAdministrator held.
    INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
    SELECT v_admin_role_id, rp.permission_id, rp.is_enabled
    FROM identity.role_permissions rp
    WHERE rp.role_id = v_sysadmin_role_id
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- 2. Union module grants.
    INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled, updated_by, created_at, updated_at)
    SELECT v_admin_role_id, g.module_id, g.is_enabled, g.updated_by, g.created_at, g.updated_at
    FROM identity.internal_module_grants g
    WHERE g.role_id = v_sysadmin_role_id
    ON CONFLICT (role_id, module_id) WHERE role_id IS NOT NULL DO NOTHING;

    -- 3. Move users from SystemAdministrator to the unified Admin role.
    UPDATE identity.internal_users
    SET role_id = v_admin_role_id,
        updated_at = NOW()
    WHERE role_id = v_sysadmin_role_id;

    -- 4. Drop the now-empty SystemAdministrator role (FKs cascade).
    DELETE FROM identity.roles
    WHERE role_id = v_sysadmin_role_id;
END
$$;

-- 5. Rewrite workflow catalog rows that referenced the legacy ict_admin key.
--    There is already an "admin" row on bid_opening; keep the more granular
--    access-control task as the dedicated admin task.
DELETE FROM procurement_workflow.workflow_role_tasks
WHERE role_key = 'admin'
  AND stage_key = 'bid_opening'
  AND task_description = 'Provide administrative oversight for bid opening access and control.';

UPDATE procurement_workflow.workflow_role_tasks
SET role_key = 'admin'
WHERE role_key = 'ict_admin';

UPDATE procurement_workflow.workflow_stage_catalog
SET primary_owner_role = 'admin'
WHERE primary_owner_role = 'ict_admin';

COMMIT;