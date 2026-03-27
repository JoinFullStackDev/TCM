-- Migration: Add SECURITY DEFINER to reorder_test_cases RPC
-- ============================================================
-- Without SECURITY DEFINER, the function runs as SECURITY INVOKER and is
-- subject to RLS on test_cases and suites. The UPDATE statements inside the
-- function are silently filtered by the RLS USING clause (auth_role() check),
-- resulting in 0 rows updated — the reorder appears to succeed (returns a
-- version number) but nothing is persisted.
--
-- All other functions that write to test_cases (generate_test_case_id,
-- snapshot_test_case_version, update_test_case_display_ids_on_prefix_change)
-- use SECURITY DEFINER. This migration brings reorder_test_cases in line.
--
-- SET search_path = public prevents search_path injection attacks, consistent
-- with all other SECURITY DEFINER functions in this project.

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
     WHERE suite_id         = p_suite_id
       AND deleted_at       IS NULL
       AND automation_status = 'in_cicd'
  ) INTO v_has_cicd;

  -- Always: assign 1-based positions from the ordered array in a single UPDATE
  UPDATE test_cases tc
     SET position = ord.ordinal
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
   WHERE tc.id       = ord.id
     AND tc.suite_id = p_suite_id
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
