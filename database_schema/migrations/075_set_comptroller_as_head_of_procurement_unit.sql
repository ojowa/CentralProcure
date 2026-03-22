BEGIN;

UPDATE identity.roles
SET description = 'Head of the procurement unit who chairs planning committee review, approves the APP, and leads procurement execution controls.'
WHERE LOWER(REGEXP_REPLACE(role_name, '[^a-zA-Z0-9]+', '', 'g')) = 'comptrollerprocurement';

COMMIT;
