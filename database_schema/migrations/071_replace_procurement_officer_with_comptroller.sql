-- Migration 071: Consolidate procurement chair role to ComptrollerProcurement
BEGIN;

DO $$
DECLARE
    v_old_role_id UUID;
    v_new_role_id UUID;
    v_old_role_name VARCHAR := 'Procurement' || 'Officer';
    v_old_role_key VARCHAR := 'procurement' || '_officer';
BEGIN
    SELECT role_id INTO v_old_role_id
    FROM identity.roles
    WHERE role_name = v_old_role_name
    LIMIT 1;

    SELECT role_id INTO v_new_role_id
    FROM identity.roles
    WHERE role_name = 'ComptrollerProcurement'
    LIMIT 1;

    -- If only the legacy role exists, rename it in-place.
    IF v_old_role_id IS NOT NULL AND v_new_role_id IS NULL THEN
        UPDATE identity.roles
        SET role_name = 'ComptrollerProcurement',
            description = 'Heads the procurement unit and chairs planning committee review and procurement execution controls.'
        WHERE role_id = v_old_role_id;
    END IF;

    -- If both exist, migrate all references from old -> new, then remove old.
    IF v_old_role_id IS NOT NULL AND v_new_role_id IS NOT NULL AND v_old_role_id <> v_new_role_id THEN
        UPDATE identity.internal_users
        SET role_id = v_new_role_id
        WHERE role_id = v_old_role_id;

        UPDATE identity.internal_module_grants target
        SET is_enabled = source.is_enabled,
            updated_by = source.updated_by,
            updated_at = now()
        FROM identity.internal_module_grants source
        WHERE source.role_id = v_old_role_id
          AND target.role_id = v_new_role_id
          AND target.module_id = source.module_id;

        INSERT INTO identity.internal_module_grants (role_id, module_id, is_enabled, updated_by, created_at, updated_at)
        SELECT v_new_role_id, g.module_id, g.is_enabled, g.updated_by, g.created_at, g.updated_at
        FROM identity.internal_module_grants g
        WHERE g.role_id = v_old_role_id
          AND NOT EXISTS (
              SELECT 1
              FROM identity.internal_module_grants existing
              WHERE existing.role_id = v_new_role_id
                AND existing.module_id = g.module_id
          );

        DELETE FROM identity.internal_module_grants
        WHERE role_id = v_old_role_id;

        UPDATE identity.internal_module_grant_audit
        SET role_id = v_new_role_id
        WHERE role_id = v_old_role_id;

        DELETE FROM identity.roles
        WHERE role_id = v_old_role_id;
    END IF;
END $$;

UPDATE procurement_workflow.workflow_role_tasks
SET role_key = 'comptroller_procurement',
    display_name = CASE
        WHEN display_name = 'Comptroller Procurement' THEN display_name
        ELSE 'Comptroller Procurement'
    END
WHERE role_key = ('procurement' || '_officer');

UPDATE procurement_workflow.workflow_stage_catalog
SET primary_owner_role = 'comptroller_procurement'
WHERE primary_owner_role = ('procurement' || '_officer');

UPDATE procurement_workflow.planning_committee_member_reviews
SET reviewer_role = 'comptroller_procurement'
WHERE reviewer_role = ('procurement' || '_officer');

UPDATE procurement_workflow.planning_committee_member_status
SET role_key = 'comptroller_procurement',
    status_label = CASE
        WHEN status_label = 'Comptroller Procurement Reviewed' THEN status_label
        ELSE 'Comptroller Procurement Reviewed'
    END
WHERE role_key = ('procurement' || '_officer');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'procurement_workflow'
          AND table_name = 'requisitions'
          AND column_name = 'assigned_role'
    ) THEN
        EXECUTE $sql$
            UPDATE procurement_workflow.requisitions
            SET assigned_role = 'comptroller_procurement'
            WHERE assigned_role = ('procurement' || '_officer');
        $sql$;
    END IF;
END $$;

COMMIT;
