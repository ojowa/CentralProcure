BEGIN;

DO $$
DECLARE
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
    UPDATE identity.internal_users
    SET password_hash = v_password_hash,
        status = 'Active',
        updated_at = NOW()
    WHERE lower(email) IN (
        'admin@nis.gov.ng',
        'procurement@nis.gov.ng',
        'finance@nis.gov.ng',
        'audit@nis.gov.ng',
        'ict@nis.gov.ng',
        'requisitioningofficer@nis.gov.ng',
        'departmenthead@nis.gov.ng',
        'procurementmanager@nis.gov.ng',
        'technicalevaluator@nis.gov.ng',
        'financialevaluator@nis.gov.ng',
        'tendersboardmember@nis.gov.ng',
        'tendersboardsecretary@nis.gov.ng',
        'accountingofficer@nis.gov.ng',
        'bppliaison@nis.gov.ng',
        'contractmanager@nis.gov.ng',
        'inspectionofficer@nis.gov.ng'
    );

    UPDATE identity.user_login_security uls
    SET failed_login_attempts = 0,
        lockout_until = NULL,
        updated_at = NOW()
    FROM identity.internal_users iu
    WHERE iu.internal_user_id = uls.internal_user_id
      AND lower(iu.email) IN (
        'admin@nis.gov.ng',
        'procurement@nis.gov.ng',
        'finance@nis.gov.ng',
        'audit@nis.gov.ng',
        'ict@nis.gov.ng',
        'requisitioningofficer@nis.gov.ng',
        'departmenthead@nis.gov.ng',
        'procurementmanager@nis.gov.ng',
        'technicalevaluator@nis.gov.ng',
        'financialevaluator@nis.gov.ng',
        'tendersboardmember@nis.gov.ng',
        'tendersboardsecretary@nis.gov.ng',
        'accountingofficer@nis.gov.ng',
        'bppliaison@nis.gov.ng',
        'contractmanager@nis.gov.ng',
        'inspectionofficer@nis.gov.ng'
    );

    UPDATE identity.vendors
    SET password_hash = v_password_hash,
        vendor_status = 'Active',
        updated_at = NOW()
    WHERE lower(email) IN (
        'vendor1@example.com',
        'vendor2@example.com'
    );
END;
$$;

COMMIT;
