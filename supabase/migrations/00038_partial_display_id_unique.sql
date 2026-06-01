-- Migration 00038: Replace table-wide display_id unique constraint with partial index
-- ==================================================================================
-- Root cause of reorder regression (Issue #56):
--   test_cases.display_id has a table-wide UNIQUE NOT NULL constraint
--   (added in 00001_initial_schema.sql:183). Soft-deleted rows retain their
--   display_id values. When reorder_test_cases RPC reassigns display IDs in
--   Pass 2, it only vacates active rows in Pass 1. If a deleted row holds a
--   display_id that would be assigned to an active row (e.g. DIC-5 is deleted
--   but the suite now has 5+ active cases), PostgreSQL raises 23505 on the
--   table-wide constraint. The RPC transaction rolls back. Positions are
--   unchanged. The frontend fetches the unmodified server order and the grid
--   snaps back — exactly the reported symptom.
--
-- Fix:
--   Drop the table-wide unique constraint and replace it with a partial unique
--   index that only enforces uniqueness among active (non-deleted) rows.
--   Soft-deleted rows logically no longer compete for display IDs. The RPC's
--   two-pass approach continues to work correctly without any code changes.
--
-- Impact:
--   - No changes to application code or the RPC required.
--   - Trash view is unaffected: deleted rows still carry their original
--     display_id for reference; they just no longer block active renumbering.
--   - The existing idx_test_cases_display_id index (non-unique) is preserved.

BEGIN;

-- Drop the table-wide unique constraint
ALTER TABLE test_cases DROP CONSTRAINT test_cases_display_id_key;

-- Add partial unique index: only active rows must have unique display_ids
CREATE UNIQUE INDEX test_cases_display_id_active_unique
  ON test_cases (display_id)
  WHERE deleted_at IS NULL;

COMMIT;
