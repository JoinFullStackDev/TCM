-- Migration: Fix reorder_test_cases unique constraint violation on position
-- ============================================================
-- The partial unique index idx_test_cases_suite_position_unique enforces
-- (suite_id, position) uniqueness for active (deleted_at IS NULL) records.
-- PostgreSQL evaluates this constraint row-by-row during a bulk UPDATE —
-- if a new position value collides with an existing row's position before
-- that row is updated, a 23505 duplicate key error is raised.
--
-- Example: suite has positions [1,2,3,4,5,6,7]. Reordering SDO-1 to last:
--   new order → [2,3,4,5,6,7,1] (new positions [1,2,3,4,5,6,7])
--   row with old position 6 gets assigned new position 6 — fine
--   row with old position 7 gets assigned new position 7 — fine
--   BUT row with old position 1 gets assigned new position 7... wait,
--   some intermediate assignment hits a row that already has that position.
-- PostgreSQL doesn't defer row-level checks within a single statement unless
-- the constraint is declared DEFERRABLE.
--
-- Fix: Use a two-pass approach identical to the display_id renaming pattern:
--   Pass 1: Set all positions to large negative temp values (-(ordinal))
--           to vacate all positions without any uniqueness conflict.
--   Pass 2: Set final positions (ordinal).
--
-- The constraint is PARTIAL (WHERE deleted_at IS NULL), so negative values
-- are fine since they're temporary and won't conflict with real positions.

CREATE OR REPLACE FUNCTION reorder_test_cases(
  p_suite_id    uuid,
  p_ordered_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_version  integer;
  v_has_cicd     boolean;
  v_suite_prefix text;
BEGIN
  -- Check if any active test case in this suite is in_cicd
  SELECT EXISTS (
    SELECT 1
      FROM test_cases
     WHERE suite_id          = p_suite_id
       AND deleted_at        IS NULL
       AND automation_status = 'in_cicd'
  ) INTO v_has_cicd;

  -- Pass 1: Set positions to temp negative values to vacate all positions
  --         without triggering the (suite_id, position) unique constraint.
  UPDATE test_cases tc
     SET position = -(ord.ordinal)
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
   WHERE tc.id        = ord.id
     AND tc.suite_id  = p_suite_id
     AND tc.deleted_at IS NULL;

  -- Pass 2: Set final 1-based positions.
  UPDATE test_cases tc
     SET position = ord.ordinal
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
   WHERE tc.id        = ord.id
     AND tc.suite_id  = p_suite_id
     AND tc.deleted_at IS NULL;

  IF NOT v_has_cicd THEN
    -- Fetch the suite prefix for display_id construction
    SELECT prefix INTO v_suite_prefix
      FROM suites
     WHERE id = p_suite_id;

    -- First pass: stamp temp display_ids to clear the non-deferrable UNIQUE constraint
    UPDATE test_cases tc
       SET display_id = '__tmp__' || tc.id::text
      FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
     WHERE tc.id       = ord.id
       AND tc.suite_id = p_suite_id
       AND tc.deleted_at IS NULL;

    -- Second pass: assign final display_id and sequence_number based on new ordinal
    UPDATE test_cases tc
       SET display_id      = v_suite_prefix || '-' || ord.ordinal,
           sequence_number = ord.ordinal
      FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
     WHERE tc.id       = ord.id
       AND tc.suite_id = p_suite_id
       AND tc.deleted_at IS NULL;

    -- Keep next_sequence one ahead of the highest assigned ordinal
    UPDATE suites
       SET next_sequence = array_length(p_ordered_ids, 1) + 1
     WHERE id = p_suite_id;
  END IF;

  -- Increment reorder_version and capture the new value
  UPDATE suites
     SET reorder_version = reorder_version + 1
   WHERE id = p_suite_id
  RETURNING reorder_version INTO v_new_version;

  RETURN COALESCE(v_new_version, 0);
END;
$$;
