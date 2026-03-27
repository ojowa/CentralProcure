UPDATE identity.roles
SET role_name = 'CGIS',
    description = 'Comptroller General of Immigration Service approval authority for direct CGIS approval and related executive decisions.'
WHERE role_name = 'AccountingOfficer';
