-- Migration 097: Add NIS Formations and Logins
BEGIN;

-- 1. Create Roles if they don't exist
INSERT INTO identity.roles (role_name, description)
VALUES
    ('FormationOfficer', 'Officer responsible for procurement needs at the formation level'),
    ('FormationHead', 'Head of the NIS formation responsible for endorsing needs')
ON CONFLICT (role_name) DO UPDATE
SET description = EXCLUDED.description;

-- 2. Create Parent Units for Formations
DO $$
DECLARE
    v_cgis_id UUID;
    v_formations_id UUID;
BEGIN
    SELECT unit_id INTO v_cgis_id FROM identity.organizational_units WHERE unit_code = 'CGNIS';
    
    INSERT INTO identity.organizational_units (unit_code, unit_name, unit_type, parent_unit_id, sort_order, is_assignable, is_active)
    VALUES ('NIS_FORMATIONS', 'NIS Formations', 'Group', v_cgis_id, 40, FALSE, TRUE)
    ON CONFLICT (unit_code) DO UPDATE SET unit_name = EXCLUDED.unit_name
    RETURNING unit_id INTO v_formations_id;

    -- Categories
    INSERT INTO identity.organizational_units (unit_code, unit_name, unit_type, parent_unit_id, sort_order, is_assignable, is_active)
    VALUES 
        ('FORM_HQ', 'Headquarters', 'Category', v_formations_id, 1, FALSE, TRUE),
        ('FORM_ZONAL', 'Zonal Commands', 'Category', v_formations_id, 2, FALSE, TRUE),
        ('FORM_STATE', 'State Commands', 'Category', v_formations_id, 3, FALSE, TRUE),
        ('FORM_TRAINING', 'Training Institutions', 'Category', v_formations_id, 4, FALSE, TRUE),
        ('FORM_PASSPORT', 'Passport Front Desks', 'Category', v_formations_id, 5, FALSE, TRUE),
        ('FORM_BORDER', 'Air Borders', 'Category', v_formations_id, 6, FALSE, TRUE)
    ON CONFLICT (unit_code) DO NOTHING;
END $$;

-- 3. Insert Formations and Create Users
DO $$
DECLARE
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK'; -- "Password123"
    v_off_role_id UUID;
    v_head_role_id UUID;
    v_formations JSONB := '[
        {"cat": "Headquarters", "name": "Service Headquarters", "loc": "Abuja", "code": "NIS_SHQ"},
        {"cat": "Zonal Command", "name": "Bauchi Zonal Command", "loc": "Bauchi", "code": "ZONAL_BAUCHI"},
        {"cat": "Zonal Command", "name": "Benin Zonal Command", "loc": "Benin", "code": "ZONAL_BENIN"},
        {"cat": "Zonal Command", "name": "Ibadan Zonal Command", "loc": "Ibadan", "code": "ZONAL_IBADAN"},
        {"cat": "Zonal Command", "name": "Kaduna Zonal Command", "loc": "Kaduna", "code": "ZONAL_KADUNA"},
        {"cat": "Zonal Command", "name": "Lagos Zonal Command", "loc": "Lagos", "code": "ZONAL_LAGOS"},
        {"cat": "Zonal Command", "name": "Makurdi Zonal Command", "loc": "Makurdi", "code": "ZONAL_MAKURDI"},
        {"cat": "Zonal Command", "name": "Minna Zonal Command", "loc": "Minna", "code": "ZONAL_MINNA"},
        {"cat": "Zonal Command", "name": "Owerri Zonal Command", "loc": "Owerri", "code": "ZONAL_OWERRI"},
        {"cat": "State Command", "name": "Abia State Command", "loc": "Abia", "code": "STATE_ABIA"},
        {"cat": "State Command", "name": "Adamawa State Command", "loc": "Adamawa", "code": "STATE_ADAMAWA"},
        {"cat": "State Command", "name": "Akwa Ibom State Command", "loc": "Akwa Ibom", "code": "STATE_AKWAIBOM"},
        {"cat": "State Command", "name": "Anambra State Command", "loc": "Anambra", "code": "STATE_ANAMBRA"},
        {"cat": "State Command", "name": "Bauchi State Command", "loc": "Bauchi", "code": "STATE_BAUCHI"},
        {"cat": "State Command", "name": "Bayelsa State Command", "loc": "Bayelsa", "code": "STATE_BAYELSA"},
        {"cat": "State Command", "name": "Benue State Command", "loc": "Benue", "code": "STATE_BENUE"},
        {"cat": "State Command", "name": "Borno State Command", "loc": "Borno", "code": "STATE_BORNO"},
        {"cat": "State Command", "name": "Cross River State Command", "loc": "Cross River", "code": "STATE_CROSSRIVER"},
        {"cat": "State Command", "name": "Delta State Command", "loc": "Delta", "code": "STATE_DELTA"},
        {"cat": "State Command", "name": "Ebonyi State Command", "loc": "Ebonyi", "code": "STATE_EBONYI"},
        {"cat": "State Command", "name": "Edo State Command", "loc": "Edo", "code": "STATE_EDO"},
        {"cat": "State Command", "name": "Ekiti State Command", "loc": "Ekiti", "code": "STATE_EKITI"},
        {"cat": "State Command", "name": "Enugu State Command", "loc": "Enugu", "code": "STATE_ENUGU"},
        {"cat": "State Command", "name": "Gombe State Command", "loc": "Gombe", "code": "STATE_GOMBE"},
        {"cat": "State Command", "name": "Imo State Command", "loc": "Imo", "code": "STATE_IMO"},
        {"cat": "State Command", "name": "Jigawa State Command", "loc": "Jigawa", "code": "STATE_JIGAWA"},
        {"cat": "State Command", "name": "Kaduna State Command", "loc": "Kaduna", "code": "STATE_KADUNA"},
        {"cat": "State Command", "name": "Kano State Command", "loc": "Kano", "code": "STATE_KANO"},
        {"cat": "State Command", "name": "Katsina State Command", "loc": "Katsina", "code": "STATE_KATSINA"},
        {"cat": "State Command", "name": "Kebbi State Command", "loc": "Kebbi", "code": "STATE_KEBBI"},
        {"cat": "State Command", "name": "Kogi State Command", "loc": "Kogi", "code": "STATE_KOGI"},
        {"cat": "State Command", "name": "Kwara State Command", "loc": "Kwara", "code": "STATE_KWARA"},
        {"cat": "State Command", "name": "Lagos State Command", "loc": "Lagos", "code": "STATE_LAGOS"},
        {"cat": "State Command", "name": "Nasarawa State Command", "loc": "Nasarawa", "code": "STATE_NASARAWA"},
        {"cat": "State Command", "name": "Niger State Command", "loc": "Niger", "code": "STATE_NIGER"},
        {"cat": "State Command", "name": "Ogun State Command", "loc": "Ogun", "code": "STATE_OGUN"},
        {"cat": "State Command", "name": "Ondo State Command", "loc": "Ondo", "code": "STATE_ONDO"},
        {"cat": "State Command", "name": "Osun State Command", "loc": "Osun", "code": "STATE_OSUN"},
        {"cat": "State Command", "name": "Oyo State Command", "loc": "Oyo", "code": "STATE_OYO"},
        {"cat": "State Command", "name": "Plateau State Command", "loc": "Plateau", "code": "STATE_PLATEAU"},
        {"cat": "State Command", "name": "Rivers State Command", "loc": "Rivers", "code": "STATE_RIVERS"},
        {"cat": "State Command", "name": "Sokoto State Command", "loc": "Sokoto", "code": "STATE_SOKOTO"},
        {"cat": "State Command", "name": "Taraba State Command", "loc": "Taraba", "code": "STATE_TARABA"},
        {"cat": "State Command", "name": "Yobe State Command", "loc": "Yobe", "code": "STATE_YOBE"},
        {"cat": "State Command", "name": "Zamfara State Command", "loc": "Zamfara", "code": "STATE_ZAMFARA"},
        {"cat": "State Command", "name": "FCT Command", "loc": "Abuja", "code": "STATE_FCT"},
        {"cat": "Training Institution", "name": "Immigration Training School Kano", "loc": "Kano", "code": "TRAIN_KANO"},
        {"cat": "Training Institution", "name": "Immigration Training School Sokoto", "loc": "Sokoto", "code": "TRAIN_SOKOTO"},
        {"cat": "Training Institution", "name": "Immigration Training School Rivers", "loc": "Rivers", "code": "TRAIN_RIVERS"},
        {"cat": "Training Institution", "name": "Immigration Training School Imo", "loc": "Imo", "code": "TRAIN_IMO"},
        {"cat": "Passport Front Desk", "name": "State House Desk", "loc": "Abuja", "code": "PPORT_STATEHOUSE"},
        {"cat": "Passport Front Desk", "name": "National Assembly Desk", "loc": "Abuja", "code": "PPORT_NASS"},
        {"cat": "Passport Front Desk", "name": "Ministry of Foreign Affairs Desk", "loc": "Abuja", "code": "PPORT_MFA"},
        {"cat": "Air Border", "name": "Abuja Airport Command", "loc": "Abuja", "code": "BORDER_ABUJA"},
        {"cat": "Air Border", "name": "Lagos Airport Command", "loc": "Lagos", "code": "BORDER_LAGOS"},
        {"cat": "Air Border", "name": "Kano Airport Command", "loc": "Kano", "code": "BORDER_KANO"},
        {"cat": "Air Border", "name": "Port Harcourt Airport Command", "loc": "Port Harcourt", "code": "BORDER_PH"},
        {"cat": "Air Border", "name": "Enugu Airport Command", "loc": "Enugu", "code": "BORDER_ENUGU"}
    ]';
    v_form RECORD;
    v_cat_unit_id UUID;
    v_unit_id UUID;
    v_slug TEXT;
    v_service_num_idx INT := 2000;
BEGIN
    SELECT role_id INTO v_off_role_id FROM identity.roles WHERE role_name = 'FormationOfficer';
    SELECT role_id INTO v_head_role_id FROM identity.roles WHERE role_name = 'FormationHead';

    FOR v_form IN SELECT * FROM jsonb_to_recordset(v_formations) AS x(cat TEXT, name TEXT, loc TEXT, code TEXT)
    LOOP
        -- Find parent category unit
        SELECT unit_id INTO v_cat_unit_id 
        FROM identity.organizational_units 
        WHERE unit_name = CASE 
            WHEN v_form.cat = 'Headquarters' THEN 'Headquarters'
            WHEN v_form.cat = 'Zonal Command' THEN 'Zonal Commands'
            WHEN v_form.cat = 'State Command' THEN 'State Commands'
            WHEN v_form.cat = 'Training Institution' THEN 'Training Institutions'
            WHEN v_form.cat = 'Passport Front Desk' THEN 'Passport Front Desks'
            WHEN v_form.cat = 'Air Border' THEN 'Air Borders'
            ELSE 'NIS Formations'
        END;

        -- Insert Formation Unit
        INSERT INTO identity.organizational_units (unit_code, unit_name, unit_type, parent_unit_id, sort_order, is_assignable, is_active)
        VALUES (v_form.code, v_form.name, 'Formation', v_cat_unit_id, 100, TRUE, TRUE)
        ON CONFLICT (unit_code) DO UPDATE SET unit_name = EXCLUDED.unit_name
        RETURNING unit_id INTO v_unit_id;

        v_slug := lower(replace(replace(v_form.code, '_', ''), ' ', ''));

        -- Formation Officer
        INSERT INTO identity.internal_users (email, username, first_name, surname, service_number, unit_id, password_hash, role_id, status)
        VALUES (
            v_slug || '@nis.gov.ng',
            v_slug,
            'Officer',
            v_form.name,
            'NIS/FORM/OFF/' || v_service_num_idx,
            v_unit_id,
            v_password_hash,
            v_off_role_id,
            'Active'
        ) ON CONFLICT (email) DO UPDATE SET unit_id = EXCLUDED.unit_id, role_id = EXCLUDED.role_id;

        -- Formation Head
        INSERT INTO identity.internal_users (email, username, first_name, surname, service_number, unit_id, password_hash, role_id, status)
        VALUES (
            'head.' || v_slug || '@nis.gov.ng',
            'head_' || v_slug,
            'Head',
            v_form.name,
            'NIS/FORM/HEAD/' || v_service_num_idx,
            v_unit_id,
            v_password_hash,
            v_head_role_id,
            'Active'
        ) ON CONFLICT (email) DO UPDATE SET unit_id = EXCLUDED.unit_id, role_id = EXCLUDED.role_id;

        v_service_num_idx := v_service_num_idx + 1;
    END LOOP;
END $$;

COMMIT;
