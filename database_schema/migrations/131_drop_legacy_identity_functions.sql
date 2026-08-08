-- Migration 131: drop dead identity functions that target the legacy
-- identity."InternalUsers" / identity."InternalUserRoleAudit" tables.
--
-- Those tables were never created in this schema (they belong to an older
-- camel-case design). The live app uses internal_users + roles via the
-- role_key-based functions, and nothing calls these legacy functions, so they
-- are dropped as dead weight.
BEGIN;

DROP FUNCTION IF EXISTS identity.create_internal_user(character varying, character varying, character varying, character varying, text);
DROP FUNCTION IF EXISTS identity.create_internal_user(uuid, character varying, character varying, character varying, character varying, character varying, text);
DROP FUNCTION IF EXISTS identity.get_internal_user_by_email(character varying);
DROP FUNCTION IF EXISTS identity.list_internal_user_role_audit(integer);
DROP FUNCTION IF EXISTS identity.list_internal_users();
DROP FUNCTION IF EXISTS identity.ensure_internal_user_seed();

COMMIT;