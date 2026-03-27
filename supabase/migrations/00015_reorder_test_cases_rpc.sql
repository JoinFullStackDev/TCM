-- Migration: Atomic reorder_test_cases RPC
-- ============================================================
-- Replaces the parallel per-row position updates in the reorder
-- route with a single PL/pgSQL function that runs entirely inside
-- one transaction, eliminating transient (suite_id, position)
-- unique-constraint violations.
--
-- The function:
--   1. Assigns position = ordinal (1-based) for every active
--      (deleted_at IS NULL) test case whose ID appears in the
--      ordered array, scoped to the given suite.
--   2. Increments suites.reorder_version atomically in the same
--      transaction.
--   3. Returns the new reorder_version to the caller.

CREATE OR REPLACE FUNCTION reorder_test_cases(
  p_suite_id    uuid,
  p_ordered_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_version integer;
BEGIN
  -- Assign 1-based positions from the ordered array in a single UPDATE
  UPDATE test_cases tc
     SET position = ord.ordinal
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
   WHERE tc.id        = ord.id
     AND tc.suite_id  = p_suite_id
     AND tc.deleted_at IS NULL;

  -- Increment reorder_version and capture the new value
  UPDATE suites
     SET reorder_version = reorder_version + 1
   WHERE id = p_suite_id
  RETURNING reorder_version INTO v_new_version;

  RETURN COALESCE(v_new_version, 0);
END;
$$;
