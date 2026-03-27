-- Migration: Position Renormalization + Hard Delete Support
-- ============================================================
-- 1. Backfill test_cases.position per suite using ROW_NUMBER(),
--    preserving relative order by existing position then created_at ASC.
-- 2. Add UNIQUE partial index on (suite_id, position) for active records.
-- 3. Add reorder_version INTEGER to suites for optimistic concurrency.
--
-- Safe for live DB — all operations are additive or backfill-only.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill positions for active (non-deleted) test cases per suite
--    Assign sequential 1-based positions ordered by current position, then
--    created_at to break ties.
-- ─────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY suite_id
           ORDER BY COALESCE(position, 0) ASC, created_at ASC
         ) AS new_pos
  FROM test_cases
  WHERE deleted_at IS NULL
)
UPDATE test_cases tc
   SET position = r.new_pos
  FROM ranked r
 WHERE tc.id = r.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add reorder_version to suites for optimistic concurrency on reorder ops
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE suites
  ADD COLUMN IF NOT EXISTS reorder_version INTEGER NOT NULL DEFAULT 0;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Partial unique index: (suite_id, position) for active test cases only
--    Archived records are excluded so they don't violate uniqueness.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_cases_suite_position_unique
  ON test_cases (suite_id, position)
  WHERE deleted_at IS NULL;
