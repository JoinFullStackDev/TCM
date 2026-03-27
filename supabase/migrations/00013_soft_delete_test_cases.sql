-- Migration: Soft Delete for Test Cases
-- Safe for live DB — all ADD COLUMN operations use IF NOT EXISTS.
-- NOTE: CREATE INDEX CONCURRENTLY statements are intentionally placed OUTSIDE
-- any transaction block (see below). They must be run separately after applying
-- this migration if using a migration runner that wraps in a transaction.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add soft-delete / restore tracking columns to test_cases
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by    UUID        DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restored_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS restored_by   UUID        DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Add snapshot columns to run_test_cases for run isolation
--    The run engine reads these columns at run-start and never re-queries live
--    test_cases during execution.
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE test_run_cases
  ADD COLUMN IF NOT EXISTS snapshot_title TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS snapshot_steps JSONB        DEFAULT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Audit log table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_case_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID        NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL CHECK (action IN ('deleted', 'restored')),
  actor_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_log_test_case
  ON test_case_audit_log (test_case_id, occurred_at DESC);

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Partial indexes (MUST be outside any transaction block)
--    If your migration runner wraps everything in a transaction, execute these
--    two statements manually in a separate session after the migration runs.
-- ──────────────────────────────────────────────────────────────────────────────

-- Active test cases (the hot path — almost every query uses this)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_cases_active
  ON test_cases (id) WHERE deleted_at IS NULL;

-- Deleted test cases (trash view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_cases_deleted
  ON test_cases (deleted_at DESC) WHERE deleted_at IS NOT NULL;
