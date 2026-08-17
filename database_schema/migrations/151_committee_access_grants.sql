-- ============================================================================
-- MIGRATION 151: COMMITTEE ACCESS GRANTS
-- Auto-grant module access when users are added to committees.
-- Also adds user-level grant visibility to get_role_modules.
-- ============================================================================

-- ─────────────────────────────────────────────
-- 1. Update get_role_modules to also check user-level grants
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.get_role_modules(
    p_role_key character varying,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
    module_id character varying,
    title character varying,
    section character varying,
    description text,
    microservice character varying,
    control_purpose text,
    actions text[],
    required_permission character varying
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT m.module_id, m.title, m.section, m.description, m.microservice,
           m.control_purpose, m.actions, m.required_permission
    FROM identity.internal_modules m
    WHERE m.is_active = TRUE
      -- 1. Not explicitly blocked by a role-level disabled grant
      AND NOT EXISTS (
          SELECT 1
          FROM identity.internal_module_grants mg
          JOIN identity.roles r ON r.role_id = mg.role_id
          WHERE r.role_key = p_role_key
            AND r.is_active = TRUE
            AND mg.module_id = m.module_id
            AND mg.is_enabled = FALSE
      )
      -- 2. Enabled role-level grant
      AND EXISTS (
          SELECT 1
          FROM identity.internal_module_grants mg
          JOIN identity.roles r ON r.role_id = mg.role_id
          WHERE r.role_key = p_role_key
            AND r.is_active = TRUE
            AND mg.module_id = m.module_id
            AND mg.is_enabled = TRUE
      )
    ORDER BY m.title;

    -- If a user_id was provided, also return modules with user-level grants
    -- that weren't already returned by the role-level query above.
    IF p_user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT m.module_id, m.title, m.section, m.description, m.microservice,
               m.control_purpose, m.actions, m.required_permission
        FROM identity.internal_modules m
        WHERE m.is_active = TRUE
          AND EXISTS (
              SELECT 1
              FROM identity.internal_module_grants mg
              WHERE mg.internal_user_id = p_user_id
                AND mg.module_id = m.module_id
                AND mg.is_enabled = TRUE
          )
          -- Exclude modules already returned by the role-level query
          AND NOT EXISTS (
              SELECT 1
              FROM identity.internal_module_grants mg
              JOIN identity.roles r ON r.role_id = mg.role_id
              WHERE r.role_key = p_role_key
                AND r.is_active = TRUE
                AND mg.module_id = m.module_id
                AND mg.is_enabled = TRUE
          )
        ORDER BY m.title;
    END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- 2. SP: Grant committee access (user-level module grants)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.grant_committee_access(
    p_user_id UUID,
    p_committee_type VARCHAR,
    p_granted_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_module_ids VARCHAR[] := '{}';
BEGIN
    IF p_committee_type = 'planning' THEN
        v_module_ids := ARRAY['procurement-planning-committee'];
    ELSIF p_committee_type = 'evaluation' THEN
        v_module_ids := ARRAY['assigned-tenders', 'technical-evaluation', 'financial-evaluation', 'evaluation-report'];
    ELSE
        RETURN;
    END IF;

    -- Upsert user-level grants for each module
    FOR i IN 1..array_length(v_module_ids, 1) LOOP
        INSERT INTO identity.internal_module_grants (internal_user_id, module_id, is_enabled, updated_by)
        VALUES (p_user_id, v_module_ids[i], TRUE, p_granted_by)
        ON CONFLICT (internal_user_id, module_id) WHERE internal_user_id IS NOT NULL
        DO UPDATE SET is_enabled = TRUE, updated_by = p_granted_by, updated_at = now();
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. SP: Revoke committee access
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION identity.revoke_committee_access(
    p_user_id UUID,
    p_committee_type VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_module_ids VARCHAR[] := '{}';
    v_has_remaining BOOLEAN;
BEGIN
    IF p_committee_type = 'planning' THEN
        v_module_ids := ARRAY['procurement-planning-committee'];
    ELSIF p_committee_type = 'evaluation' THEN
        v_module_ids := ARRAY['assigned-tenders', 'technical-evaluation', 'financial-evaluation', 'evaluation-report'];
    ELSE
        RETURN;
    END IF;

    -- Only revoke if user has no remaining memberships of this committee type
    SELECT EXISTS(
        SELECT 1 FROM identity.committee_memberships
        WHERE user_id = p_user_id AND committee_type = p_committee_type
    ) INTO v_has_remaining;

    IF v_has_remaining THEN
        RETURN;
    END IF;

    -- Disable user-level grants for each module
    FOR i IN 1..array_length(v_module_ids, 1) LOOP
        UPDATE identity.internal_module_grants
        SET is_enabled = FALSE, updated_at = now()
        WHERE internal_user_id = p_user_id
          AND module_id = v_module_ids[i]
          AND is_enabled = TRUE;
    END LOOP;
END;
$$;
