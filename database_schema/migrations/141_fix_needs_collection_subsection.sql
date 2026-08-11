-- Migration 141: Move needs-collection to 'Needs' subsection under Procurement Operations
UPDATE identity.internal_modules SET sub_section = 'Needs' WHERE module_id = 'needs-collection';
