BEGIN;

UPDATE identity.internal_users iu
SET service_number = 'TMP-' || replace(iu.internal_user_id::text, '-', ''),
    updated_at = NOW()
WHERE lower(iu.email) IN (
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

WITH profile_map AS (
    SELECT *
    FROM (
        VALUES
            ('admin@nis.gov.ng', 'admin', 'System', NULL::VARCHAR(100), 'Administrator', 'NIS-00001'),
            ('procurement@nis.gov.ng', 'procurement', 'Procurement', NULL::VARCHAR(100), 'Officer', 'NIS-00002'),
            ('finance@nis.gov.ng', 'finance', 'Finance', NULL::VARCHAR(100), 'Officer', 'NIS-00003'),
            ('audit@nis.gov.ng', 'audit', 'Audit', NULL::VARCHAR(100), 'Officer', 'NIS-00004'),
            ('ict@nis.gov.ng', 'ict', 'ICT', NULL::VARCHAR(100), 'Administrator', 'NIS-00005'),
            ('requisitioningofficer@nis.gov.ng', 'requisitioningofficer', 'Requisitioning', NULL::VARCHAR(100), 'Officer', 'NIS-00006'),
            ('departmenthead@nis.gov.ng', 'departmenthead', 'Department', NULL::VARCHAR(100), 'Head', 'NIS-00007'),
            ('procurementmanager@nis.gov.ng', 'procurementmanager', 'Procurement', NULL::VARCHAR(100), 'Manager', 'NIS-00008'),
            ('technicalevaluator@nis.gov.ng', 'technicalevaluator', 'Technical', NULL::VARCHAR(100), 'Evaluator', 'NIS-00009'),
            ('financialevaluator@nis.gov.ng', 'financialevaluator', 'Financial', NULL::VARCHAR(100), 'Evaluator', 'NIS-00010'),
            ('tendersboardmember@nis.gov.ng', 'tendersboardmember', 'Tenders', NULL::VARCHAR(100), 'Board Member', 'NIS-00011'),
            ('tendersboardsecretary@nis.gov.ng', 'tendersboardsecretary', 'Tenders', NULL::VARCHAR(100), 'Board Secretary', 'NIS-00012'),
            ('accountingofficer@nis.gov.ng', 'accountingofficer', 'Accounting', NULL::VARCHAR(100), 'Officer', 'NIS-00013'),
            ('bppliaison@nis.gov.ng', 'bppliaison', 'BPP', NULL::VARCHAR(100), 'Liaison', 'NIS-00014'),
            ('contractmanager@nis.gov.ng', 'contractmanager', 'Contract', NULL::VARCHAR(100), 'Manager', 'NIS-00015'),
            ('inspectionofficer@nis.gov.ng', 'inspectionofficer', 'Inspection', NULL::VARCHAR(100), 'Officer', 'NIS-00016')
    ) AS value_map(email, username, first_name, middle_name, surname, service_number)
)
UPDATE identity.internal_users iu
SET
    username = pm.username,
    first_name = pm.first_name,
    middle_name = pm.middle_name,
    surname = pm.surname,
    service_number = pm.service_number,
    updated_at = NOW()
FROM profile_map pm
WHERE lower(iu.email) = lower(pm.email);

COMMIT;
