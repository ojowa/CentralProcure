-- ============================================================================
-- Migration 118: Cleanup Orphaned / Duplicate Tables
-- ============================================================================
-- These tables were superseded by newer table definitions and are no longer
-- referenced by any API route. Safe to drop after verification.
--
-- Tables DROPPED:
--   procurement_workflow.need_assessments (098)     → replaced by needs_assessment (104)
--   procurement_workflow.need_assessment_items (098) → replaced by needs_assessment_items (104)
--   procurement_workflow.procurement_method_decisions (090) → replaced by procurement_methods (109)
--   procurement_workflow.procurement_method_change_exceptions (090) → replaced by method_exceptions (109)
--   procurement_workflow.procurement_complaints (025) → replaced by administrative_reviews (117)
--
-- Tables DEPRECATED (kept for reference, comments added):
--   procurement_workflow.closeouts (110) → use procurement_workflow.procurement_closeouts (025)
--   procurement_workflow.budget_appropriations (015) → use post_award.appropriations (103)
--   procurement_workflow.budget_releases (015) → use post_award.releases (103)
--   procurement_workflow.budget_commitments (015) → use post_award.commitments (103)
--   procurement_workflow.budget_expenditures (015) → no replacement needed
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Drop orphaned needs tables (superseded by migration 104)
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS procurement_workflow.need_assessment_items CASCADE;
DROP TABLE IF EXISTS procurement_workflow.need_assessments CASCADE;

-- ─────────────────────────────────────────────
-- 2. Drop orphaned procurement method tables (superseded by migration 109)
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS procurement_workflow.procurement_method_change_exceptions CASCADE;
DROP TABLE IF EXISTS procurement_workflow.procurement_method_decisions CASCADE;

-- ─────────────────────────────────────────────
-- 3. Drop orphaned complaints table (superseded by migration 117)
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS procurement_workflow.procurement_complaints CASCADE;

-- ─────────────────────────────────────────────
-- 4. Add deprecation comments to legacy tables still in schema
-- ─────────────────────────────────────────────
COMMENT ON TABLE procurement_workflow.closeouts IS 'DEPRECATED: Use procurement_workflow.procurement_closeouts instead. This table is retained for backward compatibility only.';

COMMENT ON TABLE procurement_workflow.budget_appropriations IS 'DEPRECATED: Use post_award.appropriations instead. This table is retained for backward compatibility only.';
COMMENT ON TABLE procurement_workflow.budget_releases IS 'DEPRECATED: Use post_award.releases instead. This table is retained for backward compatibility only.';
COMMENT ON TABLE procurement_workflow.budget_commitments IS 'DEPRECATED: Use post_award.commitments instead. This table is retained for backward compatibility only.';
COMMENT ON TABLE procurement_workflow.budget_expenditures IS 'DEPRECATED: No replacement. This table is retained for backward compatibility only.';

COMMIT;
